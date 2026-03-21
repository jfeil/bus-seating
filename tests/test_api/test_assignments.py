class TestFullWorkflow:
    """End-to-end test: create season, days, buses, groups, solve, inspect."""

    def _setup_season(self, client):
        season = client.post("/api/seasons", json={"name": "Winter 2026"}).json()
        sid = season["id"]

        d1 = client.post(f"/api/seasons/{sid}/days", json={"name": "Day 1"}).json()
        d2 = client.post(f"/api/seasons/{sid}/days", json={"name": "Day 2"}).json()

        client.post(f"/api/seasons/{sid}/days/{d1['id']}/buses", json={"name": "A", "capacity": 10})
        client.post(f"/api/seasons/{sid}/days/{d1['id']}/buses", json={"name": "B", "capacity": 10})
        client.post(f"/api/seasons/{sid}/days/{d2['id']}/buses", json={"name": "A", "capacity": 10})
        client.post(f"/api/seasons/{sid}/days/{d2['id']}/buses", json={"name": "B", "capacity": 10})

        g1 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "Familie Mueller",
            "members": [{"name": "Hans"}, {"name": "Anna"}, {"name": "Max"}],
            "register_for_days": [d1["id"], d2["id"]],
        }).json()

        g2 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "Familie Schmidt",
            "members": [{"name": "Peter"}, {"name": "Lisa"}],
            "register_for_days": [d1["id"], d2["id"]],
        }).json()

        g3 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "Instructor Team",
            "members": [{"name": "Klaus", "is_instructor": True}],
            "register_for_days": [d1["id"], d2["id"]],
        }).json()

        return sid, d1, d2, g1, g2, g3

    def test_solve_assigns_all_groups(self, client):
        sid, d1, d2, g1, g2, g3 = self._setup_season(client)

        resp = client.post(f"/api/seasons/{sid}/solve")
        assert resp.status_code == 200
        result = resp.json()

        assert g1["id"] in result["assignments"]
        assert g2["id"] in result["assignments"]
        assert g3["id"] in result["assignments"]

    def test_seating_plan_after_solve(self, client):
        sid, d1, d2, g1, g2, g3 = self._setup_season(client)
        client.post(f"/api/seasons/{sid}/solve")

        resp = client.get(f"/api/seasons/{sid}/days/{d1['id']}/seating-plan")
        assert resp.status_code == 200
        plan = resp.json()

        all_group_ids = []
        for bus_entry in plan:
            assert "bus_name" in bus_entry
            assert "capacity" in bus_entry
            assert "reserved_seats" in bus_entry
            for group in bus_entry["groups"]:
                all_group_ids.append(group["group_id"])
                assert "members" in group

        assert g1["id"] in all_group_ids
        assert g2["id"] in all_group_ids
        assert g3["id"] in all_group_ids

    def test_override_assignment(self, client):
        sid, d1, d2, g1, g2, g3 = self._setup_season(client)
        client.post(f"/api/seasons/{sid}/solve")

        assignments = client.get(f"/api/seasons/{sid}/assignments").json()
        assert len(assignments) > 0

        # Get a bus to move the assignment to
        buses = client.get(f"/api/seasons/{sid}/days/{d1['id']}/buses").json()
        target_bus = buses[0]

        assignment = assignments[0]
        resp = client.put(
            f"/api/seasons/{sid}/assignments/{assignment['id']}",
            json={"bus_id": target_bus["id"]},
        )
        assert resp.status_code == 200
        assert resp.json()["bus_id"] == target_bus["id"]

    def test_clear_assignments(self, client):
        sid, d1, d2, g1, g2, g3 = self._setup_season(client)
        client.post(f"/api/seasons/{sid}/solve")
        assert len(client.get(f"/api/seasons/{sid}/assignments").json()) > 0

        client.delete(f"/api/seasons/{sid}/assignments")
        assert len(client.get(f"/api/seasons/{sid}/assignments").json()) == 0

    def test_re_solve_clears_old_assignments(self, client):
        sid, d1, d2, g1, g2, g3 = self._setup_season(client)
        client.post(f"/api/seasons/{sid}/solve")
        first_count = len(client.get(f"/api/seasons/{sid}/assignments").json())

        client.post(f"/api/seasons/{sid}/solve")
        second_count = len(client.get(f"/api/seasons/{sid}/assignments").json())

        assert first_count == second_count


class TestConstraintConfig:
    def test_get_default_config(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        resp = client.get(f"/api/seasons/{season['id']}/config")
        assert resp.status_code == 200
        config = resp.json()
        assert config["instructor_consistency"] == 100.0
        assert config["passenger_consistency"] == 50.0
        assert config["ride_together"] == 10.0
        assert config["instructor_distribution"] == 75.0

    def test_update_config(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        resp = client.put(f"/api/seasons/{season['id']}/config", json={
            "instructor_consistency": 200.0,
            "ride_together": 50.0,
        })
        assert resp.status_code == 200
        config = resp.json()
        assert config["instructor_consistency"] == 200.0
        assert config["ride_together"] == 50.0
        # unchanged fields keep defaults
        assert config["passenger_consistency"] == 50.0

    def test_update_config_preserves_previous_values(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        client.put(f"/api/seasons/{season['id']}/config", json={"ride_together": 99.0})
        client.put(f"/api/seasons/{season['id']}/config", json={"passenger_consistency": 77.0})

        config = client.get(f"/api/seasons/{season['id']}/config").json()
        assert config["ride_together"] == 99.0
        assert config["passenger_consistency"] == 77.0


class TestBusReservedSeats:
    def test_create_bus_with_reserved_seats(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        day = client.post(f"/api/seasons/{season['id']}/days", json={"name": "D1"}).json()
        resp = client.post(
            f"/api/seasons/{season['id']}/days/{day['id']}/buses",
            json={"name": "A", "capacity": 50, "reserved_seats": 5},
        )
        assert resp.status_code == 201
        assert resp.json()["reserved_seats"] == 5

    def test_update_bus_reserved_seats(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        day = client.post(f"/api/seasons/{season['id']}/days", json={"name": "D1"}).json()
        bus = client.post(
            f"/api/seasons/{season['id']}/days/{day['id']}/buses",
            json={"name": "A", "capacity": 50},
        ).json()

        resp = client.put(
            f"/api/seasons/{season['id']}/days/{day['id']}/buses/{bus['id']}",
            json={"reserved_seats": 3},
        )
        assert resp.status_code == 200
        assert resp.json()["reserved_seats"] == 3


class TestRidePreferences:
    def test_create_and_list_preferences(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]
        g1 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "G1", "members": [{"name": "A"}],
        }).json()
        g2 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "G2", "members": [{"name": "B"}],
        }).json()

        resp = client.post(f"/api/seasons/{sid}/ride-preferences", json={
            "group_a_id": g1["id"], "group_b_id": g2["id"],
        })
        assert resp.status_code == 201

        prefs = client.get(f"/api/seasons/{sid}/ride-preferences").json()
        assert len(prefs) == 1
        assert prefs[0]["group_a_id"] == g1["id"]

    def test_delete_preference(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]
        g1 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "G1", "members": [{"name": "A"}],
        }).json()
        g2 = client.post(f"/api/seasons/{sid}/groups", json={
            "name": "G2", "members": [{"name": "B"}],
        }).json()

        pref = client.post(f"/api/seasons/{sid}/ride-preferences", json={
            "group_a_id": g1["id"], "group_b_id": g2["id"],
        }).json()

        resp = client.delete(f"/api/seasons/{sid}/ride-preferences/{pref['id']}")
        assert resp.status_code == 204
        assert len(client.get(f"/api/seasons/{sid}/ride-preferences").json()) == 0


class TestPdfExport:
    def test_export_pdf_after_solve(self, client):
        season = client.post("/api/seasons", json={"name": "Winter 2026"}).json()
        sid = season["id"]
        d1 = client.post(f"/api/seasons/{sid}/days", json={"name": "Day 1"}).json()
        client.post(f"/api/seasons/{sid}/days/{d1['id']}/buses", json={"name": "Bus A", "capacity": 50})
        client.post(f"/api/seasons/{sid}/groups", json={
            "name": "Familie Mueller",
            "members": [{"name": "Hans"}, {"name": "Anna"}],
            "register_for_days": [d1["id"]],
        })
        client.post(f"/api/seasons/{sid}/solve")

        resp = client.get(f"/api/seasons/{sid}/export/pdf")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert b"%PDF" in resp.content

    def test_export_pdf_empty_season(self, client):
        season = client.post("/api/seasons", json={"name": "Empty"}).json()
        resp = client.get(f"/api/seasons/{season['id']}/export/pdf")
        assert resp.status_code == 200
        assert b"%PDF" in resp.content

    def test_export_pdf_not_found(self, client):
        resp = client.get("/api/seasons/nonexistent/export/pdf")
        assert resp.status_code == 404
