"""Discover public adoption and feed links without importing listings."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests

SITES = [
    ('Best Friends', 'https://bestfriends.org/'),
    ('ASPCA', 'https://www.aspca.org/'),
    ('North Shore Animal League', 'https://www.animalleague.org/'),
    ('PAWS Chicago', 'https://www.pawschicago.org/'),
    ('Austin Pets Alive', 'https://www.austinpetsalive.org/'),
    ('Austin Humane Society', 'https://austinhumanesociety.org/'),
    ('San Diego Humane Society', 'https://www.sdhumane.org/'),
    ('Pasadena Humane', 'https://pasadenahumane.org/'),
    ('Seattle Humane', 'https://www.seattlehumane.org/'),
    ('Oregon Humane Society', 'https://www.oregonhumane.org/'),
    ('Humane Society of Utah', 'https://www.utahhumane.org/'),
    ('Arizona Humane Society', 'https://www.azhumane.org/'),
    ('Dumb Friends League', 'https://www.ddfl.org/'),
    ('SPCA of Texas', 'https://spca.org/'),
    ('Houston SPCA', 'https://houstonspca.org/'),
    ('Atlanta Humane Society', 'https://atlantahumane.org/'),
    ('Humane Rescue Alliance', 'https://www.humanerescuealliance.org/'),
    ('BARCS', 'https://www.barcs.org/'),
    ('Maryland SPCA', 'https://www.mdspca.org/'),
    ('Pennsylvania SPCA', 'https://www.pspca.org/'),
    ('MSPCA', 'https://www.mspca.org/'),
    ('Animal Rescue League of Boston', 'https://www.arlboston.org/'),
    ('Michigan Humane', 'https://www.michiganhumane.org/'),
    ('Wisconsin Humane Society', 'https://www.wihumane.org/'),
    ('Animal Humane Society', 'https://www.animalhumanesociety.org/'),
]
USER_AGENT = 'PawlineDiscovery/1.0'
MAX_BYTES = 2 * 1024 * 1024


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        key = 'src' if tag == 'iframe' else 'href'
        if tag in {'a', 'link', 'iframe'} and values.get(key):
            self.links.append((values[key], values.get('type', '')))


def fetch(url, before_request=None):
    # Validate every redirect target before making another request.
    from scripts.ingest import safe_public_url
    for _ in range(6):
        safe_public_url(url)
        if before_request:
            before_request(url)
        with requests.get(url, headers={'User-Agent': USER_AGENT},
                          timeout=(5, 15), stream=True, allow_redirects=False) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers['Location'])
                continue
            response.raise_for_status()
            body = bytearray()
            for chunk in response.iter_content(65536):
                body.extend(chunk)
                if len(body) > MAX_BYTES:
                    raise ValueError('Page exceeds 2 MB limit')
            return url, body.decode(response.encoding or 'utf-8', errors='replace')
    raise ValueError('Too many redirects')


def discover_site(site):
    name, url = site
    result = {'name': name, 'url': url, 'adoption_links': [], 'feed_links': []}
    try:
        robots_url = urljoin(url, '/robots.txt')
        robots = RobotFileParser()
        try:
            _, rules = fetch(robots_url)
            robots.parse(rules.splitlines())
        except requests.HTTPError as error:
            if error.response.status_code != 404:
                raise
            robots.parse([])
        if not robots.can_fetch(USER_AGENT, url):
            return {**result, 'status': 'blocked_by_robots'}
        final_url, body = fetch(url)
        parser = Links()
        parser.feed(body)
        adoption, feeds = set(), set()
        for href, mime in parser.links:
            target = urljoin(final_url, href).split('#')[0]
            parsed = urlparse(target)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username:
                continue
            lower = target.lower()
            if any(word in lower for word in ('adopt', 'available-pets', 'available-animals')):
                adoption.add(target)
            if (parsed.path.lower().endswith(('.json', '.csv', '.xml'))
                    or any(word in lower for word in ('/feed', '/wp-json', 'shelterluv.com', 'petstablished.com', 'petango.com'))
                    or mime in {'application/json', 'text/csv', 'application/rss+xml', 'application/atom+xml'}):
                feeds.add(target)
        return {**result, 'status': 'checked', 'final_url': final_url,
                'adoption_links': sorted(adoption), 'feed_links': sorted(feeds)}
    except Exception as error:
        return {**result, 'status': 'error', 'error': str(error)}


def discover():
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(discover_site, SITES))
