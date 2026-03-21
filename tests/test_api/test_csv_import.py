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
        assert result["groups_created"] == 2  # Busgruppe 1 + solo for Peter
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

        bus_group = next(g for g in groups if g["name"] == "Busgruppe 1")
        assert len(bus_group["members"]) == 2
        types = {m["person_type"] for m in bus_group["members"]}
        assert types == {"freifahrer", "skikurs"}

        solo_group = next(g for g in groups if g["name"] != "Busgruppe 1")
        assert len(solo_group["members"]) == 1
        assert solo_group["members"][0]["person_type"] == "lehrteam"

        # Verify registrations
        regs = client.get(f"/api/seasons/{sid}/registrations").json()
        # Busgruppe 1 registered for Tag1 + Tag2, solo registered for Tag1 + Tag2
        bus_group_regs = [r for r in regs if r["group_id"] == bus_group["id"]]
        assert len(bus_group_regs) == 2

        # Verify absences
        absences = client.get(f"/api/seasons/{sid}/person-absences").json()
        assert len(absences) == 1
        anna = next(m for m in bus_group["members"] if m["name"] == "Anna Mueller")
        assert absences[0]["person_id"] == anna["id"]

    def test_import_with_multiple_groups(self, client):
        season = client.post("/api/seasons", json={"name": "Test"}).json()
        sid = season["id"]

        resp = client.post(f"/api/seasons/{sid}/import-csv", json={"csv_text": CSV_EXAMPLE})
        assert resp.status_code == 200
        result = resp.json()

        assert result["days_created"] == 4
        assert result["groups_created"] == 2  # Busgruppe 1 + Busgruppe 3
        assert result["persons_created"] == 5

        groups = client.get(f"/api/seasons/{sid}/groups").json()
        g1 = next(g for g in groups if g["name"] == "Busgruppe 1")
        g3 = next(g for g in groups if g["name"] == "Busgruppe 3")
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
