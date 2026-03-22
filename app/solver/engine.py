from collections import defaultdict

from app.solver.types import ConstraintWeights, SolverBus, SolverGroup, SolverResult


def solve(
    groups: list[SolverGroup],
    buses: list[SolverBus],
    weights: ConstraintWeights,
    preference_weights: dict[tuple[str, str], float] | None = None,
) -> SolverResult:
    pref_weights = preference_weights or {}
    buses_by_day = _group_buses_by_day(buses)
    days_in_order = _order_days_by_constraint_pressure(buses_by_day, groups)

    assignments: dict[tuple[str, str], str] = {}
    for day in days_in_order:
        day_buses = buses_by_day[day]
        day_groups = [g for g in groups if day in g.days]
        day_assignments = _assign_day(day, day_groups, day_buses, assignments, weights, pref_weights)
        assignments.update(day_assignments)

    assignments = _improve_assignments(assignments, groups, buses_by_day, weights, pref_weights)

    unmet = _find_unmet_preferences(assignments, groups)
    score = _compute_score(assignments, groups, buses_by_day, weights, pref_weights)

    return SolverResult(assignments=assignments, score=score, unmet_preferences=unmet)


def _group_buses_by_day(buses: list[SolverBus]) -> dict[str, list[SolverBus]]:
    by_day: dict[str, list[SolverBus]] = defaultdict(list)
    for bus in buses:
        by_day[bus.day].append(bus)
    return dict(by_day)


def _order_days_by_constraint_pressure(
    buses_by_day: dict[str, list[SolverBus]], groups: list[SolverGroup]
) -> list[str]:
    """Process the most constrained day first (highest ratio of people to seats)."""

    def pressure(day: str) -> float:
        total_people = sum(g.day_size(day) for g in groups if day in g.days)
        total_capacity = sum(b.effective_capacity for b in buses_by_day.get(day, []))
        return total_people / total_capacity if total_capacity > 0 else float("inf")

    return sorted(buses_by_day.keys(), key=pressure, reverse=True)


def _assign_day(
    day: str,
    day_groups: list[SolverGroup],
    day_buses: list[SolverBus],
    existing_assignments: dict[tuple[str, str], str],
    weights: ConstraintWeights,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> dict[tuple[str, str], str]:
    sorted_groups = _sort_groups_for_placement(day_groups)
    bus_remaining = {bus.name: bus.effective_capacity for bus in day_buses}
    assignments: dict[tuple[str, str], str] = {}

    for group in sorted_groups:
        best_bus = _find_best_bus(
            group, day, day_buses, bus_remaining, existing_assignments, assignments, weights,
            all_day_groups=day_groups, pref_weights=pref_weights,
        )
        if best_bus is not None:
            assignments[(group.id, day)] = best_bus
            bus_remaining[best_bus] -= group.day_size(day)

    return assignments


def _sort_groups_for_placement(groups: list[SolverGroup]) -> list[SolverGroup]:
    """Instructors first (as bus seeds), then largest groups first."""
    return sorted(groups, key=lambda g: (g.is_instructor_group, g.size), reverse=True)


def _find_best_bus(
    group: SolverGroup,
    day: str,
    day_buses: list[SolverBus],
    bus_remaining: dict[str, int],
    existing_assignments: dict[tuple[str, str], str],
    day_assignments: dict[tuple[str, str], str],
    weights: ConstraintWeights,
    all_day_groups: list[SolverGroup] | None = None,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> str | None:
    best_name = None
    best_score = float("-inf")

    for bus in day_buses:
        if bus_remaining[bus.name] < group.day_size(day):
            continue

        score = _score_bus_for_group(
            group, day, bus, bus_remaining, existing_assignments, day_assignments, weights,
            all_day_groups=all_day_groups, day_buses=day_buses, pref_weights=pref_weights,
        )
        if score > best_score:
            best_score = score
            best_name = bus.name

    return best_name


def _score_bus_for_group(
    group: SolverGroup,
    day: str,
    bus: SolverBus,
    bus_remaining: dict[str, int],
    existing_assignments: dict[tuple[str, str], str],
    day_assignments: dict[tuple[str, str], str],
    weights: ConstraintWeights,
    all_day_groups: list[SolverGroup] | None = None,
    day_buses: list[SolverBus] | None = None,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> float:
    score = 0.0

    # Prefer filling buses (less remaining space = better)
    score -= bus_remaining[bus.name]

    # Consistency: prefer the bus this group was on in already-assigned days
    consistency_weight = (
        weights.instructor_consistency if group.is_instructor_group else weights.passenger_consistency
    )
    for other_day in group.days:
        if other_day == day:
            continue
        prev_bus = existing_assignments.get((group.id, other_day))
        if prev_bus == bus.name:
            score += consistency_weight

    # Ride-together preference: prefer buses where preferred groups already are
    all_assignments = {**existing_assignments, **day_assignments}
    for preferred_id in group.preferred_groups:
        assigned_bus = all_assignments.get((preferred_id, day))
        if assigned_bus == bus.name:
            pair = (min(group.id, preferred_id), max(group.id, preferred_id))
            pw = (pref_weights or {}).get(pair, 1.0)
            score += weights.ride_together * pw

    # Instructor distribution: prefer buses with fewer instructors
    if group.is_instructor_group and day_buses and all_day_groups:
        score += _instructor_distribution_score(
            bus.name, day, all_assignments, all_day_groups, day_buses, weights
        )

    return score


def _instructor_distribution_score(
    bus_name: str,
    day: str,
    assignments: dict[tuple[str, str], str],
    day_groups: list[SolverGroup],
    day_buses: list[SolverBus],
    weights: ConstraintWeights,
) -> float:
    """Penalize placing instructors on buses that already have more than their fair share."""
    instructor_count_per_bus: dict[str, int] = defaultdict(int)
    total_instructors = 0
    for group in day_groups:
        if not group.is_instructor_group:
            continue
        assigned_bus = assignments.get((group.id, day))
        if assigned_bus is not None:
            instructor_count_per_bus[assigned_bus] += group.day_size(day)
        total_instructors += group.day_size(day)

    num_buses = len(day_buses)
    if num_buses == 0:
        return 0.0

    ideal_per_bus = total_instructors / num_buses
    current_on_bus = instructor_count_per_bus.get(bus_name, 0)

    # Negative score for deviation above ideal — the more instructors already on this bus,
    # the less attractive it is for placing another one
    return -weights.instructor_distribution * max(0, current_on_bus - ideal_per_bus + 1)


def _improve_assignments(
    assignments: dict[tuple[str, str], str],
    groups: list[SolverGroup],
    buses_by_day: dict[str, list[SolverBus]],
    weights: ConstraintWeights,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> dict[tuple[str, str], str]:
    """Improve assignments via swaps and moves, considering all constraint weights."""
    assignments = dict(assignments)
    groups_by_id = {g.id: g for g in groups}

    improved = True
    while improved:
        improved = False
        for day, day_buses in buses_by_day.items():
            day_groups = [g for g in groups if (g.id, day) in assignments]

            for i, group_a in enumerate(day_groups):
                for group_b in day_groups[i + 1 :]:
                    if _try_swap(group_a, group_b, day, assignments, groups_by_id, day_buses, day_groups, weights, pref_weights):
                        improved = True

                if _try_move(group_a, day, assignments, groups_by_id, day_buses, day_groups, weights, pref_weights):
                    improved = True

    return assignments


def _compute_group_score(
    group: SolverGroup,
    day: str,
    assignments: dict[tuple[str, str], str],
    all_groups: dict[str, SolverGroup],
    weights: ConstraintWeights,
    day_buses: list[SolverBus] | None = None,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> float:
    """Full score for a group's current placement: consistency + preferences + distribution."""
    score = 0.0

    # Cross-day consistency
    consistency_weight = (
        weights.instructor_consistency if group.is_instructor_group else weights.passenger_consistency
    )
    my_bus = assignments.get((group.id, day))
    for other_day in group.days:
        if other_day == day:
            continue
        other_bus = assignments.get((group.id, other_day))
        if my_bus and other_bus and my_bus == other_bus:
            score += consistency_weight

    # Ride-together preferences
    for preferred_id in group.preferred_groups:
        their_bus = assignments.get((preferred_id, day))
        if my_bus and their_bus and my_bus == their_bus:
            pair = (min(group.id, preferred_id), max(group.id, preferred_id))
            pw = (pref_weights or {}).get(pair, 1.0)
            score += weights.ride_together * pw

    # Instructor distribution
    if group.is_instructor_group and my_bus and day_buses:
        day_groups_list = [all_groups[gid] for gid, d in assignments if d == day and gid in all_groups]
        score += _instructor_distribution_score(
            my_bus, day, assignments, day_groups_list, day_buses, weights
        )

    return score


def _current_bus_loads(
    assignments: dict[tuple[str, str], str],
    day: str,
    groups_by_id: dict[str, SolverGroup],
) -> dict[str, int]:
    loads: dict[str, int] = defaultdict(int)
    for (gid, d), bname in assignments.items():
        if d == day:
            loads[bname] += groups_by_id[gid].day_size(day)
    return loads


def _try_swap(
    group_a: SolverGroup,
    group_b: SolverGroup,
    day: str,
    assignments: dict[tuple[str, str], str],
    groups_by_id: dict[str, SolverGroup],
    day_buses: list[SolverBus],
    day_groups: list[SolverGroup],
    weights: ConstraintWeights,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> bool:
    bus_a = assignments[(group_a.id, day)]
    bus_b = assignments[(group_b.id, day)]
    if bus_a == bus_b:
        return False

    bus_capacities = {b.name: b.effective_capacity for b in day_buses}
    loads = _current_bus_loads(assignments, day, groups_by_id)

    if loads[bus_b] - group_b.day_size(day) + group_a.day_size(day) > bus_capacities[bus_b]:
        return False
    if loads[bus_a] - group_a.day_size(day) + group_b.day_size(day) > bus_capacities[bus_a]:
        return False

    score_before = (
        _compute_group_score(group_a, day, assignments, groups_by_id, weights, day_buses, pref_weights)
        + _compute_group_score(group_b, day, assignments, groups_by_id, weights, day_buses, pref_weights)
    )

    assignments[(group_a.id, day)] = bus_b
    assignments[(group_b.id, day)] = bus_a

    score_after = (
        _compute_group_score(group_a, day, assignments, groups_by_id, weights, day_buses, pref_weights)
        + _compute_group_score(group_b, day, assignments, groups_by_id, weights, day_buses, pref_weights)
    )

    if score_after > score_before:
        return True

    assignments[(group_a.id, day)] = bus_a
    assignments[(group_b.id, day)] = bus_b
    return False


def _try_move(
    group: SolverGroup,
    day: str,
    assignments: dict[tuple[str, str], str],
    groups_by_id: dict[str, SolverGroup],
    day_buses: list[SolverBus],
    day_groups: list[SolverGroup],
    weights: ConstraintWeights,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> bool:
    current_bus = assignments[(group.id, day)]
    score_before = _compute_group_score(group, day, assignments, groups_by_id, weights, day_buses, pref_weights)

    bus_capacities = {b.name: b.effective_capacity for b in day_buses}
    loads = _current_bus_loads(assignments, day, groups_by_id)

    best_bus = None
    best_score = score_before

    for bus in day_buses:
        if bus.name == current_bus:
            continue
        if loads[bus.name] + group.day_size(day) > bus_capacities[bus.name]:
            continue

        assignments[(group.id, day)] = bus.name
        score = _compute_group_score(group, day, assignments, groups_by_id, weights, day_buses, pref_weights)
        if score > best_score:
            best_score = score
            best_bus = bus.name

    if best_bus is not None:
        assignments[(group.id, day)] = best_bus
        return True

    assignments[(group.id, day)] = current_bus
    return False


def _find_unmet_preferences(
    assignments: dict[tuple[str, str], str],
    groups: list[SolverGroup],
) -> list[tuple[str, str]]:
    unmet = []
    for group in groups:
        for preferred_id in group.preferred_groups:
            for day in group.days:
                my_bus = assignments.get((group.id, day))
                their_bus = assignments.get((preferred_id, day))
                if my_bus and their_bus and my_bus != their_bus:
                    pair = tuple(sorted([group.id, preferred_id]))
                    if pair not in unmet:
                        unmet.append(pair)
    return unmet


def _compute_score(
    assignments: dict[tuple[str, str], str],
    groups: list[SolverGroup],
    buses_by_day: dict[str, list[SolverBus]],
    weights: ConstraintWeights,
    pref_weights: dict[tuple[str, str], float] | None = None,
) -> float:
    groups_by_id = {g.id: g for g in groups}
    score = 0.0
    for group in groups:
        for day in group.days:
            if (group.id, day) in assignments:
                score += _compute_group_score(
                    group, day, assignments, groups_by_id, weights,
                    day_buses=buses_by_day.get(day),
                    pref_weights=pref_weights,
                )
    return score
