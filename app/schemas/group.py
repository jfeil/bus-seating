from pydantic import BaseModel


PERSON_TYPES = ("freifahrer", "skikurs", "lehrteam")


class PersonCreate(BaseModel):
    first_name: str
    last_name: str = ""
    person_type: str = "freifahrer"
    birth_year: int | None = None


class PersonRead(BaseModel):
    id: str
    first_name: str
    last_name: str
    person_type: str
    birth_year: int | None = None
    group_id: str

    model_config = {"from_attributes": True}


class PersonUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    person_type: str | None = None
    birth_year: int | None = None


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


class PersonAbsenceCreate(BaseModel):
    person_id: str
    ski_day_id: str


class PersonAbsenceRead(BaseModel):
    id: str
    person_id: str
    ski_day_id: str
    person_name: str
    day_name: str

    model_config = {"from_attributes": True}


class RidePreferenceCreate(BaseModel):
    group_a_id: str
    group_b_id: str


class RidePreferenceRead(BaseModel):
    id: str
    season_id: str
    group_a_id: str
    group_b_id: str
    weight: float = 1.0

    model_config = {"from_attributes": True}


class RidePreferenceUpdate(BaseModel):
    weight: float


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
    weight: float = 1.0


class PersonPreferenceUpdate(BaseModel):
    weight: float
