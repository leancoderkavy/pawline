#!/usr/bin/env python3
"""Import enabled, authorized public JSON/CSV feeds into Pawline.

Each source supplies a parser_config JSON object with a `mapping` whose keys are
Pawline fields and values are source column names (dot paths for JSON). JSON
sources may also provide `records_path`. Google Sheets must be published as CSV.
This importer deliberately does not scrape HTML pages.
"""

from __future__ import annotations

import csv
import hashlib
import html
import io
import ipaddress
import json
import os
import re
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

MAX_BYTES = 15 * 1024 * 1024
FIELDS = {
    "external_id", "name", "species", "breed", "age", "sex", "size",
    "description", "city", "country", "postal_code", "latitude", "longitude",
    "shelter", "contact_email", "contact_phone", "image_url", "source_url",
}
EVENT_FIELDS = {
    "external_id", "title", "description", "venue", "city", "country",
    "starts_at", "ends_at", "source_url", "organizer",
}
HTML_TAG = re.compile(r"<[^>]+>")
REVIEWED_SOURCES_SQL = Path(__file__).resolve().parents[1] / "db" / "public_sources.sql"


def nested(row: dict[str, Any], path: str | None) -> Any:
    value: Any = row
    for part in (path or "").split("."):
        if not part:
            continue
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def safe_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Feed URL must be public HTTPS")
    for info in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(info[4][0])
        if address.is_private or address.is_loopback or address.is_link_local:
            raise ValueError("Feed URL resolves to a non-public address")
    return url


def canonical_species(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in {"dog", "dogs", "canine"}:
        return "Dog"
    if normalized in {"cat", "cats", "feline"}:
        return "Cat"
    return None


def clean_text(value: Any, strip_html: bool = False) -> str | None:
    if value in (None, ""):
        return None
    result = str(value)
    if strip_html:
        result = HTML_TAG.sub(" ", result)
        result = html.unescape(result)
        result = re.sub(r"\s+", " ", result)
    return result.strip() or None


def configured_value(row: dict[str, Any], field: str, config: dict[str, Any]) -> Any:
    constants = config.get("constants") or {}
    if field in constants:
        return constants[field]
    value = nested(row, (config.get("mapping") or {}).get(field))
    value_map = (config.get("value_maps") or {}).get(field) or {}
    return value_map.get(str(value), value)


def records_from(response: requests.Response, source: dict[str, Any]) -> list[dict[str, Any]]:
    content = response.content
    if len(content) > MAX_BYTES:
        raise ValueError("Feed exceeds 15 MB limit")
    config = source["parser_config"] or {}
    if source["kind"] in {"csv", "google_sheet"}:
        return list(csv.DictReader(io.StringIO(content.decode(config.get("encoding", "utf-8-sig")))))
    payload: Any = response.json()
    path = config.get("records_path")
    if path:
        payload = nested(payload, path)
    if not isinstance(payload, list) or not all(isinstance(item, dict) for item in payload):
        raise ValueError("JSON records path must resolve to an array of objects")
    return payload


def normalize(row: dict[str, Any], source: dict[str, Any]) -> dict[str, Any] | None:
    config = source["parser_config"] or {}
    item = {field: configured_value(row, field, config) for field in FIELDS}
    item["name"] = str(item["name"] or "").strip()[:100]
    item["species"] = canonical_species(item["species"])
    if not item["name"] or not item["species"]:
        return None
    strip_html_fields = set(config.get("strip_html_fields") or [])
    for field in FIELDS - {"latitude", "longitude", "species", "name"}:
        item[field] = clean_text(item[field], field in strip_html_fields)
    for field in ("latitude", "longitude"):
        try:
            item[field] = float(item[field]) if item[field] not in (None, "") else None
        except (TypeError, ValueError):
            item[field] = None
    identity = item["external_id"] or "|".join(
        str(item.get(key) or "").lower() for key in ("name", "species", "shelter", "city", "country")
    )
    item["fingerprint"] = hashlib.sha256(f'{source["id"]}|{identity}'.encode()).hexdigest()
    item["raw_payload"] = json.dumps(row, default=str)[:100_000]
    return item


def normalize_event(row: dict[str, Any], source: dict[str, Any]) -> dict[str, Any] | None:
    config = source["parser_config"] or {}
    item = {field: configured_value(row, field, config) for field in EVENT_FIELDS}
    strip_html_fields = set(config.get("strip_html_fields") or [])
    for field in EVENT_FIELDS:
        item[field] = clean_text(item[field], field in strip_html_fields)
    searchable = f'{item.get("title") or ""} {item.get("description") or ""}'.lower()
    required_terms = [str(term).lower() for term in config.get("required_terms") or []]
    dog_terms = [str(term).lower() for term in config.get("dog_terms") or []]
    excluded_terms = [str(term).lower() for term in config.get("excluded_terms") or []]
    if not item["external_id"] or not item["title"] or not item["starts_at"]:
        return None
    if required_terms and not all(term in searchable for term in required_terms):
        return None
    if dog_terms and not any(term in searchable for term in dog_terms):
        return None
    if any(term in searchable for term in excluded_terms):
        return None
    try:
        start = datetime.fromisoformat(item["starts_at"].replace("Z", "+00:00"))
        if start.replace(tzinfo=start.tzinfo or timezone.utc) < datetime.now(timezone.utc):
            return None
    except ValueError:
        return None
    item["raw_payload"] = json.dumps(row, default=str)[:100_000]
    return item


def install_reviewed_sources(connection: psycopg.Connection) -> None:
    """Keep code-reviewed public sources synchronized with the live database."""
    with connection.cursor() as cursor:
        cursor.execute(REVIEWED_SOURCES_SQL.read_text(encoding="utf-8"))
    connection.commit()


def ingest_source(connection: psycopg.Connection, source: dict[str, Any]) -> dict[str, int | str]:
    sync_started_at = datetime.now(timezone.utc)
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO ingestion_runs (source_id) VALUES (%s) RETURNING id",
            (source["id"],),
        )
        run_id = cursor.fetchone()["id"]
        connection.commit()
    try:
        headers = {"Accept": "application/json,text/csv;q=0.9,*/*;q=0.1", "User-Agent": "Pawline/1.0"}
        if source.get("etag"):
            headers["If-None-Match"] = source["etag"]
        if source.get("last_modified"):
            headers["If-Modified-Since"] = source["last_modified"]
        response = requests.get(
            safe_public_url(source["url"]),
            headers=headers,
            timeout=(5, 25),
            stream=True,
        )
        if response.status_code == 304:
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE ingestion_runs SET status='unchanged', finished_at=now() WHERE id=%s",
                    (run_id,),
                )
                cursor.execute(
                    "UPDATE sources SET last_run_at=now(), last_success_at=now(), last_error=NULL WHERE id=%s",
                    (source["id"],),
                )
            connection.commit()
            return {"source": source["name"], "status": "unchanged", "upserted": 0}
        response.raise_for_status()
        response.raw.decode_content = True
        response._content = response.raw.read(MAX_BYTES + 1)
        rows = records_from(response, source)
        is_event_source = (source["parser_config"] or {}).get("entity") == "event"
        records = (
            [event for row in rows if (event := normalize_event(row, source))]
            if is_event_source
            else [pet for row in rows if (pet := normalize(row, source))]
        )
        with connection.cursor() as cursor:
            for record in records:
                if is_event_source:
                    cursor.execute(
                        """
                        INSERT INTO adoption_events (
                          source_id, external_id, title, venue, city, country,
                          starts_at, ends_at, source_url, status
                        ) VALUES (
                          %(source_id)s, %(external_id)s, %(title)s, %(venue)s,
                          %(city)s, %(country)s, %(starts_at)s::timestamptz,
                          %(ends_at)s::timestamptz, %(source_url)s, 'published'
                        )
                        ON CONFLICT (source_id, external_id) WHERE
                          source_id IS NOT NULL AND external_id IS NOT NULL
                        DO UPDATE SET
                          title=EXCLUDED.title, venue=EXCLUDED.venue, city=EXCLUDED.city,
                          country=EXCLUDED.country, starts_at=EXCLUDED.starts_at,
                          ends_at=EXCLUDED.ends_at, source_url=EXCLUDED.source_url,
                          status='published', updated_at=now()
                        """,
                        {"source_id": source["id"], **record},
                    )
                    continue
                cursor.execute(
                    """
                    INSERT INTO pets (
                      source_id, external_id, fingerprint, name, species, breed, age, sex, size,
                      description, city, country, postal_code, latitude, longitude, shelter,
                      contact_email, contact_phone, image_url, source_url, status, raw_payload,
                      verified_at
                    ) VALUES (
                      %(source_id)s, %(external_id)s, %(fingerprint)s, %(name)s, %(species)s,
                      %(breed)s, %(age)s, %(sex)s, %(size)s, %(description)s, %(city)s,
                      %(country)s, %(postal_code)s, %(latitude)s, %(longitude)s, %(shelter)s,
                      %(contact_email)s, %(contact_phone)s, %(image_url)s, %(source_url)s,
                      'available', %(raw_payload)s::jsonb, now()
                    )
                    ON CONFLICT (fingerprint) DO UPDATE SET
                      external_id=EXCLUDED.external_id, name=EXCLUDED.name, species=EXCLUDED.species,
                      breed=EXCLUDED.breed, age=EXCLUDED.age, sex=EXCLUDED.sex, size=EXCLUDED.size,
                      description=EXCLUDED.description, city=EXCLUDED.city, country=EXCLUDED.country,
                      postal_code=EXCLUDED.postal_code, latitude=EXCLUDED.latitude,
                      longitude=EXCLUDED.longitude, shelter=EXCLUDED.shelter,
                      contact_email=EXCLUDED.contact_email, contact_phone=EXCLUDED.contact_phone,
                      image_url=EXCLUDED.image_url, source_url=EXCLUDED.source_url,
                      status='available', raw_payload=EXCLUDED.raw_payload, verified_at=now(),
                      missed_syncs=0, updated_at=now()
                    """,
                    {"source_id": source["id"], **record},
                )
            expired_count = 0
            if not is_event_source and records:
                cursor.execute(
                    """
                    UPDATE pets
                    SET missed_syncs=missed_syncs + 1,
                        status=CASE
                          WHEN missed_syncs + 1 >= 2 THEN 'unavailable'
                          ELSE status
                        END,
                        updated_at=now()
                    WHERE source_id=%s
                      AND status='available'
                      AND verified_at < %s
                    """,
                    (source["id"], sync_started_at),
                )
                expired_count = cursor.rowcount
            cursor.execute(
                """UPDATE ingestion_runs SET status='success', fetched_count=%s,
                   upserted_count=%s, finished_at=now() WHERE id=%s""",
                (len(rows), len(records), run_id),
            )
            cursor.execute(
                """UPDATE sources SET etag=%s, last_modified=%s, last_run_at=now(),
                   last_success_at=now(), last_error=NULL, updated_at=now() WHERE id=%s""",
                (response.headers.get("ETag"), response.headers.get("Last-Modified"), source["id"]),
            )
        connection.commit()
        return {
            "source": source["name"],
            "status": "success",
            "upserted": len(records),
            "missing": expired_count,
        }
    except Exception as exc:
        connection.rollback()
        message = str(exc)[:1000]
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE ingestion_runs SET status='error', error=%s, finished_at=now() WHERE id=%s",
                (message, run_id),
            )
            cursor.execute(
                "UPDATE sources SET last_run_at=now(), last_error=%s, updated_at=now() WHERE id=%s",
                (message, source["id"]),
            )
        connection.commit()
        return {"source": source["name"], "status": "error", "error": message}


def run() -> list[dict[str, int | str]]:
    import psycopg
    from psycopg.rows import dict_row

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        install_reviewed_sources(connection)
        with connection.cursor() as cursor:
            cursor.execute(
                """SELECT * FROM sources WHERE enabled=true
                   AND kind IN ('json', 'csv', 'google_sheet') AND url IS NOT NULL
                   ORDER BY name"""
            )
            sources = cursor.fetchall()
        return [ingest_source(connection, source) for source in sources]


if __name__ == "__main__":
    json.dump(
        {"ranAt": datetime.now(timezone.utc).isoformat(), "results": run()},
        sys.stdout,
        indent=2,
    )
    print()
