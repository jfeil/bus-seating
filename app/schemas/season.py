from pydantic import BaseModel


class SeasonCreate(BaseModel):
    name: str


class SeasonRead(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}
