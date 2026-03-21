from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///data/bus_seating.db"
    debug: bool = False

    model_config = {"env_prefix": "BUS_SEATING_"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
