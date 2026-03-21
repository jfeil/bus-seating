from pydantic import BaseModel


class PersonCreate(BaseModel):
    name: str
    is_instructor: bool = False


class PersonRead(BaseModel):
    id: str
    name: str
    is_instructor: bool
    group_id: str

    model_config = {"from_attributes": True}


class PersonUpdate(BaseModel):
    name: str | None = None
    is_instructor: bool | None = None


class GroupCreate(BaseModel):
    name: str
    members: list[PersonCreate]
    register_for_days: list[str] | None = None


class GroupUpdate(BaseModel):
    name: str | None = None


class GroupRead(BaseModel):
    id: str
    season_id: str
    name: str
    members: list[PersonRead]

    model_config = {"from_attributes": True}


class RegistrationRead(BaseModel):
    id: str
    group_id: str
    ski_day_id: str

    model_config = {"from_attributes": True}


class RidePreferenceCreate(BaseModel):
    group_a_id: str
    group_b_id: str


class RidePreferenceRead(BaseModel):
    id: str
    season_id: str
    group_a_id: str
    group_b_id: str

    model_config = {"from_attributes": True}


class PersonPreferenceCreate(BaseModel):
    person_a_id: str
    person_b_id: str


class PersonPreferenceRead(BaseModel):
    id: str
    season_id: str
    person_a_id: str
    person_b_id: str
    person_a_name: str
    person_b_name: str
    group_a_name: str
    group_b_name: str
