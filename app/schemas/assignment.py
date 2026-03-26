from pydantic import BaseModel, Field


class ConstraintConfigRead(BaseModel):
    bus_name_prefix: str
    default_bus_capacity: int
    default_reserved_seats: int
    label_freifahrer: str
    icon_freifahrer: str
    label_skikurs: str
    icon_skikurs: str
    label_lehrteam: str
    icon_lehrteam: str
    instructor_consistency: float
    passenger_consistency: float
    ride_together: float
    instructor_distribution: float

    model_config = {"from_attributes": True}


class ConstraintConfigUpdate(BaseModel):
    bus_name_prefix: str | None = None
    default_bus_capacity: int | None = Field(gt=0, default=None)
    default_reserved_seats: int | None = Field(ge=0, default=None)
    label_freifahrer: str | None = None
    icon_freifahrer: str | None = None
    label_skikurs: str | None = None
    icon_skikurs: str | None = None
    label_lehrteam: str | None = None
    icon_lehrteam: str | None = None
    instructor_consistency: float | None = Field(ge=0, default=None)
    passenger_consistency: float | None = Field(ge=0, default=None)
    ride_together: float | None = Field(ge=0, default=None)
    instructor_distribution: float | None = Field(ge=0, default=None)


class AssignmentRead(BaseModel):
    id: str
    registration_id: str
    bus_id: str

    model_config = {"from_attributes": True}


class AssignmentOverride(BaseModel):
    bus_id: str


class UnmetPreferenceDetail(BaseModel):
    type: str  # "ride" or "person"
    preference_id: str
    group_a_name: str
    group_b_name: str
    weight: float
    details: str  # e.g. person names for person preferences


class SolveResultRead(BaseModel):
    assignments: dict[str, dict[str, str]]  # {group_id: {day_id: bus_name}}
    score: float
    unmet_preferences: list[UnmetPreferenceDetail]


class SeatingPlanEntry(BaseModel):
    bus_name: str
    bus_id: str
    capacity: int
    reserved_seats: int
    groups: list["SeatingPlanGroup"]


class SeatingPlanGroup(BaseModel):
    group_id: str
    group_name: str
    assignment_id: str
    members: list["SeatingPlanPerson"]
    is_instructor_group: bool


class SeatingPlanPerson(BaseModel):
    person_id: str
    person_first_name: str
    person_last_name: str
    person_type: str
    birth_year: int | None = None
