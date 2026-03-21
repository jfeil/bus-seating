from pydantic import BaseModel, Field


class ConstraintConfigRead(BaseModel):
    instructor_consistency: float
    passenger_consistency: float
    ride_together: float
    instructor_distribution: float

    model_config = {"from_attributes": True}


class ConstraintConfigUpdate(BaseModel):
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


class SolveResultRead(BaseModel):
    assignments: dict[str, dict[str, str]]  # {group_id: {day_id: bus_name}}
    score: float
    unmet_preferences: list[list[str]]


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
    person_name: str
    is_instructor: bool
