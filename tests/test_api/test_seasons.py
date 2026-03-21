class TestSeasons:
    def test_create_season(self, client):
        resp = client.post("/api/seasons", json={"name": "Winter 2026"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Winter 2026"
        assert "id" in data

    def test_list_seasons(self, client):
        client.post("/api/seasons", json={"name": "S1"})
        client.post("/api/seasons", json={"name": "S2"})
        resp = client.get("/api/seasons")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_season(self, client):
        created = client.post("/api/seasons", json={"name": "Winter"}).json()
        resp = client.get(f"/api/seasons/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Winter"

    def test_get_nonexistent_season_returns_404(self, client):
        resp = client.get("/api/seasons/nonexistent")
        assert resp.status_code == 404

    def test_delete_season(self, client):
        created = client.post("/api/seasons", json={"name": "ToDelete"}).json()
        resp = client.delete(f"/api/seasons/{created['id']}")
        assert resp.status_code == 204
        assert client.get(f"/api/seasons/{created['id']}").status_code == 404
