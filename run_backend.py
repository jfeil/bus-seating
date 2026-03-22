"""Entry point for the bundled backend sidecar."""
import argparse
import os

import uvicorn

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", help="SQLAlchemy database URL")
    args = parser.parse_args()

    if args.db_url:
        os.environ["BUS_SEATING_DATABASE_URL"] = args.db_url

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
