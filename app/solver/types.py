from dataclasses import dataclass, field


@dataclass(frozen=True)
class SolverGroup:
    id: str
    size: int
    is_instructor_group: bool
    days: list[str]
    preferred_groups: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SolverBus:
    id: str
    day: str
    name: str
    capacity: int
    reserved_seats: int = 0

    @property
    def effective_capacity(self) -> int:
        return self.capacity - self.reserved_seats


@dataclass
class ConstraintWeights:
    instructor_consistency: float = 100.0
    passenger_consistency: float = 50.0
    ride_together: float = 10.0
    instructor_distribution: float = 75.0

    def as_dict(self) -> dict[str, float]:
        return {
            "instructor_consistency": self.instructor_consistency,
            "passenger_consistency": self.passenger_consistency,
            "ride_together": self.ride_together,
            "instructor_distribution": self.instructor_distribution,
        }


@dataclass
class SolverResult:
    # (group_id, day_id) -> bus_name
    assignments: dict[tuple[str, str], str]
    score: float
    unmet_preferences: list[tuple[str, str]] = field(default_factory=list)
