"""Credential & connection config — loaded from environment / .env.
Never hardcode secrets; this only reads them."""
from __future__ import annotations
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


def postgres_dsn() -> str | None:
    """Return a libpq DSN for Postgres, or None if not configured."""
    dsn = os.environ.get("POSTGRES_DSN", "").strip()
    if dsn:
        return dsn
    host = os.environ.get("POSTGRES_HOST", "").strip()
    if not host:
        return None
    parts = {
        "host": host,
        "port": os.environ.get("POSTGRES_PORT", "5432"),
        "dbname": os.environ.get("POSTGRES_DB", ""),
        "user": os.environ.get("POSTGRES_USER", ""),
        "password": os.environ.get("POSTGRES_PASSWORD", ""),
        "sslmode": os.environ.get("POSTGRES_SSLMODE", "require"),
        "connect_timeout": os.environ.get("POSTGRES_CONNECT_TIMEOUT", "8"),
    }
    return " ".join(f"{k}={v}" for k, v in parts.items() if v)


def clickhouse_config() -> dict | None:
    """Return kwargs for clickhouse_connect.get_client, or None if not configured."""
    host = os.environ.get("CLICKHOUSE_HOST", "").strip()
    if not host:
        return None
    return {
        "host": host,
        "port": int(os.environ.get("CLICKHOUSE_PORT", "8443")),
        "database": os.environ.get("CLICKHOUSE_DB", "freshbus_operations"),
        "username": os.environ.get("CLICKHOUSE_USER", "default"),
        "password": os.environ.get("CLICKHOUSE_PASSWORD", ""),
        "secure": os.environ.get("CLICKHOUSE_SECURE", "true").lower() == "true",
        "connect_timeout": int(os.environ.get("CLICKHOUSE_CONNECT_TIMEOUT", "8")),
        "send_receive_timeout": int(os.environ.get("CLICKHOUSE_QUERY_TIMEOUT", "20")),
    }


def have_postgres() -> bool:  return postgres_dsn() is not None
def have_clickhouse() -> bool: return clickhouse_config() is not None
