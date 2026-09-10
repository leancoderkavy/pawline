"""Local CLI configuration; secrets remain in ignored environment files."""
from pathlib import Path


def configure():
    from dotenv import load_dotenv
    import truststore

    root = Path(__file__).resolve().parents[1]
    # Explicit shell settings win, followed by the dedicated review environment.
    for path in (root / '.vercel/.env.listing-review', root / '.env.local'):
        load_dotenv(path, override=False)
    # Use the OS trust store, including managed Windows roots; never disable TLS.
    truststore.inject_into_ssl()
