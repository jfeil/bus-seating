import datetime

from pydantic import BaseModel


class SkiDayCreate(BaseModel):
    name: str
    date: datetime.date | None = None


class SkiDayUpdate(BaseModel):
    name: str | None = None
    date: datetime.date | None = None


class SkiDayRead(BaseModel):
    id: str
    season_id: str
    name: str
    date: datetime.date | None

    model_config = {"from_attributes": True}
