CSV_SIMPLE = """\
Name,Type,Tag1,Tag2,Busgruppe
Hans Mueller,Freifahrer,x,x,1
Anna Mueller,Skikurs,x,,1
Peter Trainer,Lehrteam,x,x,
"""

CSV_EXAMPLE = """\
Name,Type,Tag1,Tag2,Tag3,Tag4,Busgruppe
Rose Schwarz,Freifahrer,,x,x,x,1
Sophia Schäfer,Freifahrer,,x,,x,1
Ben Fuchs,Freifahrer,x,x,x,x,1
Zoe Wagner,Skikurs,x,x,x,x,3
Laura Fuchs,Freifahrer,x,x,x,x,3
"""


class TestCsvImport:
    def test_import_creates_days_groups_and_absences(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": CSV_SIMPLE})
        assert resp.status_code == 200
        result = resp.json()

        assert result["days_created"] == 2
        assert result["groups_created"] == 2  # 1 + solo for Peter
        assert result["persons_created"] == 3
        assert result["absences_created"] == 1  # Anna absent on Tag2

        # Verify days created
        days = client.get(f"/api/seasons/{sid}/days").json()
        assert len(days) == 2
        day_names = {d["name"] for d in days}
        assert day_names == {"Tag1", "Tag2"}

        # Verify groups created
        groups = client.get(f"/api/seasons/{sid}/groups").json()
        assert len(groups) == 2

        bus_group = next(g for g in groups if g["name"] == "1")
        assert len(bus_group["members"]) == 2
        types = {m["person_type"] for m in bus_group["members"]}
        assert types == {"freifahrer", "skikurs"}

        solo_group = next(g for g in groups if g["name"] != "1")
        assert len(solo_group["members"]) == 1
        assert solo_group["members"][0]["person_type"] == "lehrteam"

        # Verify registrations
        regs = client.get(f"/api/seasons/{sid}/registrations").json()
        # 1 registered for Tag1 + Tag2, solo registered for Tag1 + Tag2
        bus_group_regs = [r for r in regs if r["group_id"] == bus_group["id"]]
        assert len(bus_group_regs) == 2

        # Verify absences
        absences = client.get(f"/api/seasons/{sid}/person-absences").json()
        assert len(absences) == 1
        anna = next(m for m in bus_group["members"] if m["first_name"] == "Anna")
        assert absences[0]["person_id"] == anna["id"]

    def test_import_with_multiple_groups(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": CSV_EXAMPLE})
        assert resp.status_code == 200
        result = resp.json()

        assert result["days_created"] == 4
        assert result["groups_created"] == 2  # 1 + 3
        assert result["persons_created"] == 5

        groups = client.get(f"/api/seasons/{sid}/groups").json()
        g1 = next(g for g in groups if g["name"] == "1")
        g3 = next(g for g in groups if g["name"] == "3")
        assert len(g1["members"]) == 3
        assert len(g3["members"]) == 2

    def test_import_empty_csv_fails(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        resp = client.post(
            f"/api/seasons/{season['id']}/import-csv",
            json={"csv_text": ""},
        )
        assert resp.status_code == 400

    def test_import_special_markers_count_as_attending(self, client):
        """s and k markers should be treated as attending."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = "Name,Type,Tag1,Busgruppe\nAlice,Freifahrer,s,1\nBob,Freifahrer,k,1"
        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert resp.status_code == 200
        result = resp.json()
        assert result["absences_created"] == 0

    def test_group_not_registered_for_day_nobody_attends(self, client):
        """If no member in a group attends a day, the group should not be registered for it."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = "Name,Type,Tag1,Tag2,Busgruppe\nAlice,Freifahrer,,x,1\nBob,Freifahrer,,x,1"
        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert resp.status_code == 200

        regs = client.get(f"/api/seasons/{sid}/registrations").json()
        days = client.get(f"/api/seasons/{sid}/days").json()
        tag1 = next(d for d in days if d["name"] == "Tag1")
        tag2 = next(d for d in days if d["name"] == "Tag2")

        reg_day_ids = {r["ski_day_id"] for r in regs}
        assert tag1["id"] not in reg_day_ids  # nobody attends Tag1
        assert tag2["id"] in reg_day_ids

    def test_import_person_preferences(self, client):
        """Fahrtwunsch with person names creates PersonPreferences."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = (
            "first_name,last_name,Type,Tag1,Busgruppe,Fahrtwunsch\n"
            "Alice,Smith,Freifahrer,x,1,Bob Jones\n"
            "Bob,Jones,Freifahrer,x,2,\n"
            "Carol,White,Freifahrer,x,1,Alice Smith;Bob Jones\n"
        )
        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert resp.status_code == 200
        result = resp.json()
        # Alice→Bob, Carol→Alice, Carol→Bob = 3 unique person pairs
        assert result["person_preferences_created"] == 3
        assert result["ride_preferences_created"] == 0

        prefs = client.get(f"/api/seasons/{sid}/person-preferences").json()
        assert len(prefs) == 3

    def test_import_ride_preferences(self, client):
        """Fahrtwunsch with #N creates RidePreferences between groups."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = (
            "Name,Type,Tag1,Busgruppe,Fahrtwunsch\n"
            "Alice,Freifahrer,x,1,#2\n"
            "Bob,Freifahrer,x,2,#1\n"
            "Carol,Freifahrer,x,3,#1;#2\n"
        )
        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert resp.status_code == 200
        result = resp.json()
        assert result["person_preferences_created"] == 0
        # 1↔2, 3↔1, 3↔2 = 3 unique group pairs (Alice→2 and Bob→1 are the same pair)
        assert result["ride_preferences_created"] == 3

        prefs = client.get(f"/api/seasons/{sid}/ride-preferences").json()
        assert len(prefs) == 3

    def test_import_mixed_preferences(self, client):
        """Fahrtwunsch mixing person names and group references."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = (
            "first_name,last_name,Type,Tag1,Busgruppe,Fahrtwunsch\n"
            "Alice,Smith,Freifahrer,x,1,Bob Jones;#2\n"
            "Bob,Jones,Freifahrer,x,2,\n"
        )
        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert resp.status_code == 200
        result = resp.json()
        assert result["person_preferences_created"] == 1  # Alice↔Bob
        assert result["ride_preferences_created"] == 1  # group 1↔group 2

    def test_import_named_groups(self, client):
        """Busgruppe column can contain names instead of numbers."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = (
            "first_name,last_name,Type,Tag1,Busgruppe,Fahrtwunsch\n"
            "Alice,Smith,Freifahrer,x,Familie Mueller,#Skikurs Team\n"
            "Bob,Jones,Freifahrer,x,Familie Mueller,\n"
            "Carol,White,Lehrteam,x,Skikurs Team,\n"
        )
        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert resp.status_code == 200
        result = resp.json()

        assert result["groups_created"] == 2
        assert result["ride_preferences_created"] == 1

        groups = client.get(f"/api/seasons/{sid}/groups").json()
        names = {g["name"] for g in groups}
        assert names == {"Familie Mueller", "Skikurs Team"}

        fm = next(g for g in groups if g["name"] == "Familie Mueller")
        assert len(fm["members"]) == 2

    def test_clear_all_deletes_preferences(self, client):
        """Clearing all groups should also delete ride and person preferences."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = (
            "first_name,last_name,Type,Tag1,Busgruppe,Fahrtwunsch\n"
            "Alice,Smith,Freifahrer,x,1,Bob Jones;#2\n"
            "Bob,Jones,Freifahrer,x,2,\n"
        )
        client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert len(client.get(f"/api/seasons/{sid}/ride-preferences").json()) == 1
        assert len(client.get(f"/api/seasons/{sid}/person-preferences").json()) == 1

        client.delete(f"/api/seasons/{sid}/groups")

        assert len(client.get(f"/api/seasons/{sid}/groups").json()) == 0
        assert len(client.get(f"/api/seasons/{sid}/ride-preferences").json()) == 0
        assert len(client.get(f"/api/seasons/{sid}/person-preferences").json()) == 0

    def test_export_csv_roundtrip(self, client):
        """Exported CSV should be re-importable and produce the same data."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv_in = (
            "first_name,last_name,Type,Tag1,Tag2,Busgruppe,Fahrtwunsch\n"
            "Alice,Smith,Freifahrer,x,,Team A,Bob Jones\n"
            "Bob,Jones,Freifahrer,x,x,Team B,#Team A\n"
        )
        client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv_in})

        # Export
        resp = client.get(f"/api/seasons/{sid}/export-csv")
        assert resp.status_code == 200
        exported = resp.text

        # Verify exported CSV contains expected data
        assert "Alice" in exported
        assert "Bob" in exported
        assert "Team A" in exported
        assert "Team B" in exported
        # Ride preference between Team A and Team B
        assert "#Team A" in exported or "#Team B" in exported
        # Person preference between Alice and Bob
        assert "Alice Smith" in exported or "Bob Jones" in exported

        # Re-import into a new season should work
        season2 = client.post("/api/seasons", json={"name": "Test2"}).json()
        sid2 = season2["id"]
        r = client.post(f"/api/seasons/{sid2}/import-csv", json={"csv_text": exported})
        assert r.status_code == 200
        result = r.json()
        assert result["persons_created"] == 2
        assert result["person_preferences_created"] == 1
        assert result["ride_preferences_created"] == 1

    def test_reimport_reuses_existing_days(self, client):
        """Importing twice should not duplicate days."""
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        csv = "Name,Type,Tag1,Tag2,Busgruppe\nAlice,Freifahrer,x,x,1"

        # First import creates days
        r1 = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert r1.json()["days_created"] == 2

        # Clear groups, reimport
        client.delete(f"/api/seasons/{sid}/groups")
        r2 = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": csv})
        assert r2.json()["days_created"] == 0  # days already exist

        days = client.get(f"/api/seasons/{sid}/days").json()
        assert len(days) == 2
