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
import io
import ipaddress
import json
import os
import socket
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row
import requests

MAX_BYTES = 15 * 1024 * 1024
FIELDS = {
    "external_id", "name", "species", "breed", "age", "sex", "size",
    "description", "city", "country", "postal_code", "latitude", "longitude",
    "shelter", "contact_email", "contact_phone", "image_url", "source_url",
}


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
    mapping = config.get("mapping") or {}
    item = {field: nested(row, mapping.get(field)) for field in FIELDS}
    item["name"] = str(item["name"] or "").strip()[:100]
    item["species"] = canonical_species(item["species"])
    if not item["name"] or not item["species"]:
        return None
    for field in FIELDS - {"latitude", "longitude", "species", "name"}:
        item[field] = str(item[field]).strip() if item[field] not in (None, "") else None
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


def ingest_source(connection: psycopg.Connection, source: dict[str, Any]) -> dict[str, int | str]:
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
        pets = [pet for row in rows if (pet := normalize(row, source))]
        with connection.cursor() as cursor:
            for pet in pets:
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
                      updated_at=now()
                    """,
                    {"source_id": source["id"], **pet},
                )
            cursor.execute(
                """UPDATE ingestion_runs SET status='success', fetched_count=%s,
                   upserted_count=%s, finished_at=now() WHERE id=%s""",
                (len(rows), len(pets), run_id),
            )
            cursor.execute(
                """UPDATE sources SET etag=%s, last_modified=%s, last_run_at=now(),
                   last_success_at=now(), last_error=NULL, updated_at=now() WHERE id=%s""",
                (response.headers.get("ETag"), response.headers.get("Last-Modified"), source["id"]),
            )
        connection.commit()
        return {"source": source["name"], "status": "success", "upserted": len(pets)}
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
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
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
