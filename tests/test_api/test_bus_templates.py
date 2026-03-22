class TestBusTemplates:
    def _season(self, client):
        return client.post("/api/seasons", json={"name": "S1"}).json()

    def test_create_template(self, client):
        s = self._season(client)
        resp = client.post(f"/api/seasons/{s['id']}/bus-templates", json={
            "name": "Bus A", "capacity": 50, "reserved_seats": 5,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Bus A"
        assert data["capacity"] == 50
        assert data["reserved_seats"] == 5

    def test_list_templates(self, client):
        s = self._season(client)
        client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "A", "capacity": 40})
        client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "B", "capacity": 30})
        resp = client.get(f"/api/seasons/{s['id']}/bus-templates")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_update_template(self, client):
        s = self._season(client)
        tpl = client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "X", "capacity": 10}).json()
        resp = client.put(f"/api/seasons/{s['id']}/bus-templates/{tpl['id']}", json={"name": "Y", "capacity": 20})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Y"
        assert resp.json()["capacity"] == 20

    def test_delete_template(self, client):
        s = self._season(client)
        tpl = client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "X", "capacity": 10}).json()
        resp = client.delete(f"/api/seasons/{s['id']}/bus-templates/{tpl['id']}")
        assert resp.status_code == 204
        assert len(client.get(f"/api/seasons/{s['id']}/bus-templates").json()) == 0

    def test_day_creation_copies_templates(self, client):
        s = self._season(client)
        client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "Bus A", "capacity": 50, "reserved_seats": 5})
        client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "Bus B", "capacity": 30})

        day = client.post(f"/api/seasons/{s['id']}/days", json={"name": "Day 1"}).json()
        buses = client.get(f"/api/seasons/{s['id']}/days/{day['id']}/buses").json()

        assert len(buses) == 2
        names = {b["name"] for b in buses}
        assert names == {"Bus A", "Bus B"}

        bus_a = next(b for b in buses if b["name"] == "Bus A")
        assert bus_a["capacity"] == 50
        assert bus_a["reserved_seats"] == 5

        bus_b = next(b for b in buses if b["name"] == "Bus B")
        assert bus_b["capacity"] == 30
        assert bus_b["reserved_seats"] == 0

    def test_day_without_templates_has_no_buses(self, client):
        s = self._season(client)
        day = client.post(f"/api/seasons/{s['id']}/days", json={"name": "Day 1"}).json()
        buses = client.get(f"/api/seasons/{s['id']}/days/{day['id']}/buses").json()
        assert len(buses) == 0

    def test_cascade_delete_season(self, client):
        s = self._season(client)
        client.post(f"/api/seasons/{s['id']}/bus-templates", json={"name": "X", "capacity": 10})
        client.delete(f"/api/seasons/{s['id']}")
        assert client.get(f"/api/seasons/{s['id']}/bus-templates").status_code == 404
