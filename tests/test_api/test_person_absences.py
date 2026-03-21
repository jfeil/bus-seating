class TestPersonAbsences:
    def _setup(self, client):
        """Create a season with a day and a group with two members."""
        season = client.post("/api/seasons", json={"name": "S1"}).json()
        sid = season["id"]
        day = client.post(f"/api/seasons/{sid}/days", json={"name": "Day 1"}).json()
        group = client.post(
            f"/api/seasons/{sid}/groups",
            json={
                "name": "Family",
                "members": [{"name": "Alice"}, {"name": "Bob"}],
                "register_for_days": [day["id"]],
            },
        ).json()
        return sid, day, group

    def test_create_absence(self, client):
        sid, day, group = self._setup(client)
        person = group["members"][0]
        resp = client.post(
            f"/api/seasons/{sid}/person-absences",
            json={"person_id": person["id"], "ski_day_id": day["id"]},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["person_id"] == person["id"]
        assert data["ski_day_id"] == day["id"]
        assert data["person_name"] == person["name"]
        assert data["day_name"] == "Day 1"

    def test_list_absences(self, client):
        sid, day, group = self._setup(client)
        for member in group["members"]:
            client.post(
                f"/api/seasons/{sid}/person-absences",
                json={"person_id": member["id"], "ski_day_id": day["id"]},
            )
        resp = client.get(f"/api/seasons/{sid}/person-absences")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_delete_absence(self, client):
        sid, day, group = self._setup(client)
        person = group["members"][0]
        created = client.post(
            f"/api/seasons/{sid}/person-absences",
            json={"person_id": person["id"], "ski_day_id": day["id"]},
        ).json()
        resp = client.delete(f"/api/seasons/{sid}/person-absences/{created['id']}")
        assert resp.status_code == 204
        assert len(client.get(f"/api/seasons/{sid}/person-absences").json()) == 0

    def test_duplicate_absence_fails(self, client):
        sid, day, group = self._setup(client)
        person = group["members"][0]
        body = {"person_id": person["id"], "ski_day_id": day["id"]}
        client.post(f"/api/seasons/{sid}/person-absences", json=body)
        resp = client.post(f"/api/seasons/{sid}/person-absences", json=body)
        assert resp.status_code == 409

    def test_absence_affects_seating_plan(self, client):
        """Absent members should not appear in the seating plan."""
        sid, day, group = self._setup(client)
        alice = group["members"][0]

        # Add a bus and solve
        client.post(
            f"/api/seasons/{sid}/days/{day['id']}/buses",
            json={"name": "Bus 1", "capacity": 50},
        )
        client.post(f"/api/seasons/{sid}/solve")

        # Before absence: both members in plan
        plan = client.get(f"/api/seasons/{sid}/days/{day['id']}/seating-plan").json()
        members_before = plan[0]["groups"][0]["members"]
        assert len(members_before) == 2

        # Mark Alice absent
        client.post(
            f"/api/seasons/{sid}/person-absences",
            json={"person_id": alice["id"], "ski_day_id": day["id"]},
        )

        # After absence: only Bob in plan
        plan = client.get(f"/api/seasons/{sid}/days/{day['id']}/seating-plan").json()
        members_after = plan[0]["groups"][0]["members"]
        assert len(members_after) == 1
        assert members_after[0]["person_name"] == "Bob"


class TestSolverWithAbsences:
    def test_solver_uses_reduced_group_size(self, client):
        """When a member is absent, the solver should use the reduced group size."""
        season = client.post("/api/seasons", json={"name": "S1"}).json()
        sid = season["id"]
        day = client.post(f"/api/seasons/{sid}/days", json={"name": "Day 1"}).json()

        # Create a group of 3 that exactly fills a bus of capacity 3
        group = client.post(
            f"/api/seasons/{sid}/groups",
            json={
                "name": "Trio",
                "members": [{"name": "A"}, {"name": "B"}, {"name": "C"}],
                "register_for_days": [day["id"]],
            },
        ).json()

        # Mark one person absent
        client.post(
            f"/api/seasons/{sid}/person-absences",
            json={"person_id": group["members"][0]["id"], "ski_day_id": day["id"]},
        )

        # Bus with capacity 2 — should fit the group now (size 2 after absence)
        client.post(
            f"/api/seasons/{sid}/days/{day['id']}/buses",
            json={"name": "Small Bus", "capacity": 2},
        )

        result = client.post(f"/api/seasons/{sid}/solve").json()
        # Group should be assigned (fits in bus with capacity 2)
        assert "Trio" not in str(result.get("unmet_preferences", []))
        assert len(result["assignments"]) > 0
