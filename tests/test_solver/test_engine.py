from app.solver.engine import solve
from app.solver.types import ConstraintWeights, SolverBus, SolverGroup


def make_bus(name: str, day: str, capacity: int, reserved: int = 0) -> SolverBus:
    return SolverBus(
        id=f"{name}_{day}", day=day, name=name, capacity=capacity, reserved_seats=reserved
    )


def make_group(
    id: str,
    size: int,
    days: list[str],
    is_instructor: bool = False,
    preferred: list[str] | None = None,
) -> SolverGroup:
    return SolverGroup(
        id=id,
        size=size,
        is_instructor_group=is_instructor,
        days=days,
        preferred_groups=preferred or [],
    )


class TestSingleDaySingleBus:
    def test_single_group_assigned_to_only_bus(self):
        groups = [make_group("g1", size=3, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=50)]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("g1", "d1")] == "A"

    def test_multiple_groups_fit_into_one_bus(self):
        groups = [
            make_group("g1", size=3, days=["d1"]),
            make_group("g2", size=4, days=["d1"]),
        ]
        buses = [make_bus("A", "d1", capacity=50)]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("g1", "d1")] == "A"
        assert result.assignments[("g2", "d1")] == "A"

    def test_group_too_large_for_bus_is_unassigned(self):
        groups = [make_group("g1", size=10, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=5)]

        result = solve(groups, buses, ConstraintWeights())

        assert ("g1", "d1") not in result.assignments

    def test_reserved_seats_reduce_effective_capacity(self):
        groups = [make_group("g1", size=8, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=10, reserved=3)]

        result = solve(groups, buses, ConstraintWeights())

        # group of 8 doesn't fit in effective capacity of 7
        assert ("g1", "d1") not in result.assignments


class TestSingleDayMultipleBuses:
    def test_groups_fill_first_bus_then_overflow_to_second(self):
        groups = [
            make_group("g1", size=5, days=["d1"]),
            make_group("g2", size=5, days=["d1"]),
            make_group("g3", size=5, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # all groups should be assigned
        assert ("g1", "d1") in result.assignments
        assert ("g2", "d1") in result.assignments
        assert ("g3", "d1") in result.assignments
        # at least one bus has 2 groups, filling it as much as possible
        bus_a_groups = [
            g for g in ["g1", "g2", "g3"] if result.assignments[(g, "d1")] == "A"
        ]
        bus_b_groups = [
            g for g in ["g1", "g2", "g3"] if result.assignments[(g, "d1")] == "B"
        ]
        assert (len(bus_a_groups) == 2 and len(bus_b_groups) == 1) or (
            len(bus_a_groups) == 1 and len(bus_b_groups) == 2
        )

    def test_ride_together_preference_respected(self):
        groups = [
            make_group("g1", size=3, days=["d1"], preferred=["g2"]),
            make_group("g2", size=3, days=["d1"], preferred=["g1"]),
            make_group("g3", size=3, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=6),
            make_bus("B", "d1", capacity=6),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # g1 and g2 should be on the same bus
        assert result.assignments[("g1", "d1")] == result.assignments[("g2", "d1")]


class TestMultipleDaysConsistency:
    def test_group_stays_on_same_bus_across_days(self):
        groups = [
            make_group("g1", size=3, days=["d1", "d2"]),
            make_group("g2", size=3, days=["d1", "d2"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
            make_bus("A", "d2", capacity=10),
            make_bus("B", "d2", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # each group should stay on the same bus across days
        assert result.assignments[("g1", "d1")] == result.assignments[("g1", "d2")]
        assert result.assignments[("g2", "d1")] == result.assignments[("g2", "d2")]

    def test_instructor_consistency_prioritized_over_passenger(self):
        """When forced to break consistency for one, prefer keeping instructors stable."""
        instructor = make_group("instructor", size=1, days=["d1", "d2"], is_instructor=True)
        passengers = [
            make_group(f"p{i}", size=2, days=["d1", "d2"]) for i in range(5)
        ]
        groups = [instructor] + passengers
        buses = [
            make_bus("A", "d1", capacity=6),
            make_bus("B", "d1", capacity=6),
            # day 2: bus A is smaller, forcing some reshuffling
            make_bus("A", "d2", capacity=4),
            make_bus("B", "d2", capacity=8),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # instructor should keep the same bus
        assert result.assignments[("instructor", "d1")] == result.assignments[("instructor", "d2")]

    def test_partial_day_signup_only_assigned_on_registered_days(self):
        groups = [
            make_group("g1", size=3, days=["d1"]),
            make_group("g2", size=3, days=["d1", "d2"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("A", "d2", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        assert ("g1", "d1") in result.assignments
        assert ("g1", "d2") not in result.assignments
        assert ("g2", "d1") in result.assignments
        assert ("g2", "d2") in result.assignments


class TestEdgeCases:
    def test_empty_groups_returns_empty_result(self):
        buses = [make_bus("A", "d1", capacity=50)]

        result = solve([], buses, ConstraintWeights())

        assert result.assignments == {}
        assert result.unmet_preferences == []

    def test_empty_buses_returns_empty_result(self):
        groups = [make_group("g1", size=3, days=["d1"])]

        result = solve(groups, [], ConstraintWeights())

        assert result.assignments == {}

    def test_solo_person_is_group_of_one(self):
        groups = [make_group("solo", size=1, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=50)]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("solo", "d1")] == "A"

    def test_exact_capacity_fit(self):
        groups = [make_group("g1", size=10, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=10)]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("g1", "d1")] == "A"

    def test_one_seat_over_capacity_is_rejected(self):
        groups = [make_group("g1", size=11, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=10)]

        result = solve(groups, buses, ConstraintWeights())

        assert ("g1", "d1") not in result.assignments

    def test_all_buses_full_remaining_group_unassigned(self):
        groups = [
            make_group("g1", size=5, days=["d1"]),
            make_group("g2", size=5, days=["d1"]),
            make_group("g3", size=5, days=["d1"]),
        ]
        buses = [make_bus("A", "d1", capacity=10)]

        result = solve(groups, buses, ConstraintWeights())

        assigned = [g for g in ["g1", "g2", "g3"] if (g, "d1") in result.assignments]
        unassigned = [g for g in ["g1", "g2", "g3"] if (g, "d1") not in result.assignments]
        assert len(assigned) == 2
        assert len(unassigned) == 1

    def test_group_with_no_matching_day_buses_is_skipped(self):
        groups = [make_group("g1", size=3, days=["d1"])]
        buses = [make_bus("A", "d2", capacity=50)]

        result = solve(groups, buses, ConstraintWeights())

        assert ("g1", "d1") not in result.assignments


class TestFillStrategy:
    def test_prefers_filling_one_bus_over_spreading(self):
        """Buses should be filled as full as possible, not balanced."""
        groups = [
            make_group("g1", size=3, days=["d1"]),
            make_group("g2", size=3, days=["d1"]),
            make_group("g3", size=3, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=20),
            make_bus("B", "d1", capacity=20),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # all groups should be on the same bus (filling it)
        bus_for = [result.assignments[(f"g{i}", "d1")] for i in range(1, 4)]
        assert len(set(bus_for)) == 1

    def test_large_group_placed_first_then_small_fills_gap(self):
        groups = [
            make_group("small1", size=1, days=["d1"]),
            make_group("small2", size=1, days=["d1"]),
            make_group("large", size=8, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # large group gets placed, smalls fill remaining space on same bus
        large_bus = result.assignments[("large", "d1")]
        small1_bus = result.assignments[("small1", "d1")]
        small2_bus = result.assignments[("small2", "d1")]
        assert small1_bus == large_bus or small2_bus == large_bus


class TestPreferences:
    def test_one_sided_preference_still_respected(self):
        """Even if only one group lists the other, they should end up together."""
        groups = [
            make_group("g1", size=3, days=["d1"], preferred=["g2"]),
            make_group("g2", size=3, days=["d1"]),
            make_group("g3", size=3, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=6),
            make_bus("B", "d1", capacity=6),
        ]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("g1", "d1")] == result.assignments[("g2", "d1")]

    def test_unmet_preference_reported(self):
        """When a preference can't be met, it should appear in unmet_preferences."""
        groups = [
            make_group("g1", size=5, days=["d1"], preferred=["g2"]),
            make_group("g2", size=5, days=["d1"], preferred=["g1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=5),
            make_bus("B", "d1", capacity=5),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # both buses can only hold one group each, so preference can't be met
        assert result.assignments[("g1", "d1")] != result.assignments[("g2", "d1")]
        assert tuple(sorted(["g1", "g2"])) in result.unmet_preferences

    def test_preference_chain_groups_pulled_together(self):
        """g1 wants g2, g2 wants g3 — all three should end up together if possible."""
        groups = [
            make_group("g1", size=2, days=["d1"], preferred=["g2"]),
            make_group("g2", size=2, days=["d1"], preferred=["g3"]),
            make_group("g3", size=2, days=["d1"]),
            make_group("g4", size=2, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=8),
            make_bus("B", "d1", capacity=8),
        ]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("g1", "d1")] == result.assignments[("g2", "d1")]
        assert result.assignments[("g2", "d1")] == result.assignments[("g3", "d1")]

    def test_no_preferences_yields_empty_unmet(self):
        groups = [make_group("g1", size=3, days=["d1"])]
        buses = [make_bus("A", "d1", capacity=50)]

        result = solve(groups, buses, ConstraintWeights())

        assert result.unmet_preferences == []


class TestMultipleDaysComplex:
    def test_four_days_consistency(self):
        """Simulate a realistic 4-day scenario."""
        days = ["d1", "d2", "d3", "d4"]
        groups = [make_group(f"g{i}", size=3, days=days) for i in range(6)]
        buses = []
        for day in days:
            buses.append(make_bus("A", day, capacity=12))
            buses.append(make_bus("B", day, capacity=12))

        result = solve(groups, buses, ConstraintWeights())

        # every group should stay consistent across all 4 days
        for group in groups:
            assigned_buses = {result.assignments[(group.id, d)] for d in days}
            assert len(assigned_buses) == 1, f"{group.id} switched buses: {assigned_buses}"

    def test_late_joiner_does_not_break_existing_consistency(self):
        """A group joining only day 3 shouldn't cause others to shuffle."""
        days = ["d1", "d2", "d3"]
        regulars = [make_group(f"r{i}", size=3, days=days) for i in range(4)]
        late_joiner = make_group("late", size=3, days=["d3"])
        groups = regulars + [late_joiner]
        buses = []
        for day in days:
            buses.append(make_bus("A", day, capacity=10))
            buses.append(make_bus("B", day, capacity=10))

        result = solve(groups, buses, ConstraintWeights())

        # regulars should be consistent across all days
        for group in regulars:
            assigned_buses = {result.assignments[(group.id, d)] for d in days}
            assert len(assigned_buses) == 1, f"{group.id} switched buses: {assigned_buses}"
        # late joiner should be assigned on day 3 only
        assert ("late", "d3") in result.assignments
        assert ("late", "d1") not in result.assignments

    def test_different_bus_counts_per_day(self):
        """Day 1 has 3 buses, day 2 only has 2."""
        groups = [make_group(f"g{i}", size=3, days=["d1", "d2"]) for i in range(5)]
        buses = [
            make_bus("A", "d1", capacity=6),
            make_bus("B", "d1", capacity=6),
            make_bus("C", "d1", capacity=6),
            make_bus("A", "d2", capacity=10),
            make_bus("B", "d2", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # all groups should be assigned on both days
        for i in range(5):
            assert (f"g{i}", "d1") in result.assignments
            assert (f"g{i}", "d2") in result.assignments

    def test_varying_capacity_across_days_still_assigns_all(self):
        """Bus A has 10 seats on day 1 but only 6 on day 2."""
        groups = [
            make_group("g1", size=5, days=["d1", "d2"]),
            make_group("g2", size=4, days=["d1", "d2"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
            make_bus("A", "d2", capacity=6),
            make_bus("B", "d2", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        for gid in ["g1", "g2"]:
            assert (gid, "d1") in result.assignments
            assert (gid, "d2") in result.assignments


class TestConstraintWeights:
    def test_zero_consistency_weight_allows_free_reshuffling(self):
        """With consistency weight at 0, the solver doesn't care about bus-switching."""
        weights = ConstraintWeights(instructor_consistency=0, passenger_consistency=0)
        groups = [
            make_group("g1", size=5, days=["d1", "d2"]),
            make_group("g2", size=5, days=["d1", "d2"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
            make_bus("A", "d2", capacity=10),
            make_bus("B", "d2", capacity=10),
        ]

        result = solve(groups, buses, weights)

        # should still assign everyone (just no consistency guarantee)
        assert ("g1", "d1") in result.assignments
        assert ("g1", "d2") in result.assignments

    def test_high_preference_weight_overrides_fill_strategy(self):
        """With extremely high ride-together weight, preferences beat fill-first."""
        weights = ConstraintWeights(ride_together=10000)
        groups = [
            make_group("g1", size=2, days=["d1"], preferred=["g2"]),
            make_group("g2", size=2, days=["d1"]),
            make_group("g3", size=6, days=["d1"]),
        ]
        buses = [
            make_bus("A", "d1", capacity=8),
            make_bus("B", "d1", capacity=8),
        ]

        result = solve(groups, buses, weights)

        # g1 and g2 should be together despite g3 being large
        assert result.assignments[("g1", "d1")] == result.assignments[("g2", "d1")]


class TestInstructors:
    def test_instructor_placed_before_same_size_passenger(self):
        """Instructors get placement priority at same group size."""
        instructor = make_group("instr", size=3, days=["d1"], is_instructor=True)
        passenger = make_group("pass", size=3, days=["d1"])
        groups = [passenger, instructor]  # passenger listed first
        buses = [make_bus("A", "d1", capacity=3)]

        result = solve(groups, buses, ConstraintWeights())

        # instructor should get the only seat
        assert ("instr", "d1") in result.assignments

    def test_instructor_linked_to_passenger_via_preference(self):
        instructor = make_group("instr", size=1, days=["d1"], is_instructor=True, preferred=["family"])
        family = make_group("family", size=4, days=["d1"])
        other = make_group("other", size=4, days=["d1"])
        groups = [instructor, family, other]
        buses = [
            make_bus("A", "d1", capacity=5),
            make_bus("B", "d1", capacity=5),
        ]

        result = solve(groups, buses, ConstraintWeights())

        assert result.assignments[("instr", "d1")] == result.assignments[("family", "d1")]

    def test_two_instructors_spread_across_two_buses(self):
        instructors = [
            make_group(f"instr{i}", size=1, days=["d1"], is_instructor=True) for i in range(2)
        ]
        passengers = [make_group(f"p{i}", size=4, days=["d1"]) for i in range(4)]
        groups = instructors + passengers
        buses = [
            make_bus("A", "d1", capacity=12),
            make_bus("B", "d1", capacity=12),
        ]

        result = solve(groups, buses, ConstraintWeights())

        bus_a_instr = [i for i in instructors if result.assignments[(i.id, "d1")] == "A"]
        bus_b_instr = [i for i in instructors if result.assignments[(i.id, "d1")] == "B"]
        assert len(bus_a_instr) == 1 and len(bus_b_instr) == 1

    def test_four_instructors_spread_across_three_buses(self):
        instructors = [
            make_group(f"instr{i}", size=1, days=["d1"], is_instructor=True) for i in range(4)
        ]
        passengers = [make_group(f"p{i}", size=3, days=["d1"]) for i in range(6)]
        groups = instructors + passengers
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
            make_bus("C", "d1", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        for bus_name in ["A", "B", "C"]:
            count = sum(
                1 for i in instructors if result.assignments[(i.id, "d1")] == bus_name
            )
            assert count >= 1, f"Bus {bus_name} has no instructors"

    def test_instructor_group_counts_all_members_for_distribution(self):
        """An instructor group of 2 counts as 2 instructors for distribution."""
        instr_group = make_group("instr_pair", size=2, days=["d1"], is_instructor=True)
        solo_instr = make_group("instr_solo", size=1, days=["d1"], is_instructor=True)
        passengers = [make_group(f"p{i}", size=3, days=["d1"]) for i in range(4)]
        groups = [instr_group, solo_instr] + passengers
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=10),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # pair and solo should be on different buses
        assert result.assignments[("instr_pair", "d1")] != result.assignments[("instr_solo", "d1")]

    def test_instructor_spreading_respects_capacity(self):
        """Don't force an instructor onto a bus that can't fit them."""
        instructors = [
            make_group(f"instr{i}", size=1, days=["d1"], is_instructor=True) for i in range(3)
        ]
        passengers = [make_group("big", size=9, days=["d1"])]
        groups = instructors + passengers
        buses = [
            make_bus("A", "d1", capacity=10),
            make_bus("B", "d1", capacity=3),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # all should be assigned
        for g in groups:
            assert (g.id, "d1") in result.assignments

    def test_instructor_spreading_consistent_across_days(self):
        """Instructors should spread AND stay consistent across days."""
        instructors = [
            make_group(f"instr{i}", size=1, days=["d1", "d2"], is_instructor=True)
            for i in range(2)
        ]
        passengers = [make_group(f"p{i}", size=4, days=["d1", "d2"]) for i in range(4)]
        groups = instructors + passengers
        buses = [
            make_bus("A", "d1", capacity=12),
            make_bus("B", "d1", capacity=12),
            make_bus("A", "d2", capacity=12),
            make_bus("B", "d2", capacity=12),
        ]

        result = solve(groups, buses, ConstraintWeights())

        # spread: different buses on each day
        assert result.assignments[("instr0", "d1")] != result.assignments[("instr1", "d1")]
        assert result.assignments[("instr0", "d2")] != result.assignments[("instr1", "d2")]
        # consistent: same bus across days
        for instr in instructors:
            assert result.assignments[(instr.id, "d1")] == result.assignments[(instr.id, "d2")]

    def test_multiple_instructors_on_multiple_days_stay_consistent(self):
        instructors = [
            make_group(f"instr{i}", size=1, days=["d1", "d2"], is_instructor=True)
            for i in range(2)
        ]
        passengers = [make_group(f"p{i}", size=4, days=["d1", "d2"]) for i in range(4)]
        groups = instructors + passengers
        buses = [
            make_bus("A", "d1", capacity=12),
            make_bus("B", "d1", capacity=12),
            make_bus("A", "d2", capacity=12),
            make_bus("B", "d2", capacity=12),
        ]

        result = solve(groups, buses, ConstraintWeights())

        for instr in instructors:
            assert result.assignments[(instr.id, "d1")] == result.assignments[(instr.id, "d2")]
