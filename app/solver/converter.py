from collections import defaultdict

from app.models.db import Bus, ConstraintConfig, Group, PersonAbsence, PersonPreference, RidePreference
from app.solver.types import ConstraintWeights, SolverBus, SolverGroup


def groups_to_solver(
    groups: list[Group],
    preferences: list[RidePreference],
    person_preferences: list[PersonPreference] | None = None,
    person_absences: list[PersonAbsence] | None = None,
) -> tuple[list[SolverGroup], dict[tuple[str, str], float]]:
    preference_map, weight_map = _build_preference_map(preferences, person_preferences or [])
    absence_map = _build_absence_map(person_absences or [])

    solver_groups = [
        SolverGroup(
            id=group.id,
            size=len(group.members),
            is_instructor_group=any(m.is_instructor for m in group.members),
            days=[reg.ski_day_id for reg in group.registrations],
            preferred_groups=preference_map.get(group.id, []),
            size_by_day=_group_size_by_day(group, absence_map),
        )
        for group in groups
    ]
    return solver_groups, weight_map


def _build_absence_map(absences: list[PersonAbsence]) -> dict[str, set[str]]:
    """Map person_id -> set of day_ids they are absent from."""
    absence_map: dict[str, set[str]] = defaultdict(set)
    for absence in absences:
        absence_map[absence.person_id].add(absence.ski_day_id)
    return dict(absence_map)


def _group_size_by_day(
    group: Group, absence_map: dict[str, set[str]]
) -> dict[str, int]:
    """Compute effective group size per day, only for days where absences apply."""
    size_by_day: dict[str, int] = {}
    for reg in group.registrations:
        day_id = reg.ski_day_id
        absent_count = sum(
            1 for m in group.members if day_id in absence_map.get(m.id, set())
        )
        if absent_count > 0:
            size_by_day[day_id] = len(group.members) - absent_count
    return size_by_day


def _build_preference_map(
    preferences: list[RidePreference],
    person_preferences: list[PersonPreference],
) -> tuple[dict[str, list[str]], dict[tuple[str, str], float]]:
    pref_pairs: set[tuple[str, str]] = set()
    weight_map: dict[tuple[str, str], float] = {}

    for pref in preferences:
        pair = (min(pref.group_a_id, pref.group_b_id), max(pref.group_a_id, pref.group_b_id))
        pref_pairs.add(pair)
        weight_map[pair] = max(weight_map.get(pair, 0), pref.weight)

    # Person preferences translate to group preferences
    for pp in person_preferences:
        group_a_id = pp.person_a.group_id
        group_b_id = pp.person_b.group_id
        if group_a_id != group_b_id:
            pair = (min(group_a_id, group_b_id), max(group_a_id, group_b_id))
            pref_pairs.add(pair)
            weight_map[pair] = max(weight_map.get(pair, 0), pp.weight)

    pref_map: dict[str, list[str]] = {}
    for a, b in pref_pairs:
        pref_map.setdefault(a, []).append(b)
        pref_map.setdefault(b, []).append(a)
    return pref_map, weight_map


def buses_to_solver(buses: list[Bus]) -> list[SolverBus]:
    return [
        SolverBus(
            id=bus.id,
            day=bus.ski_day_id,
            name=bus.name,
            capacity=bus.capacity,
            reserved_seats=bus.reserved_seats,
        )
        for bus in buses
    ]


def config_to_weights(config: ConstraintConfig | None) -> ConstraintWeights:
    if config is None:
        return ConstraintWeights()
    return ConstraintWeights(
        instructor_consistency=config.instructor_consistency,
        passenger_consistency=config.passenger_consistency,
        ride_together=config.ride_together,
        instructor_distribution=config.instructor_distribution,
    )
