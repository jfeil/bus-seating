from pydantic import BaseModel, Field


class BusCreate(BaseModel):
    name: str
    capacity: int = Field(gt=0)
    reserved_seats: int = Field(ge=0, default=0)


class BusUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = Field(gt=0, default=None)
    reserved_seats: int | None = Field(ge=0, default=None)


class BusRead(BaseModel):
    id: str
    ski_day_id: str
    name: str
    capacity: int
    reserved_seats: int

    model_config = {"from_attributes": True}


class BusTemplateCreate(BaseModel):
    name: str
    capacity: int = Field(gt=0)
    reserved_seats: int = Field(ge=0, default=0)


class BusTemplateUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = Field(gt=0, default=None)
    reserved_seats: int | None = Field(ge=0, default=None)


class BusTemplateRead(BaseModel):
    id: str
    season_id: str
    name: str
    capacity: int
    reserved_seats: int

    model_config = {"from_attributes": True}
