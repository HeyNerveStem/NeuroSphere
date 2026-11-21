import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "ok"
    assert j["counts"]["structures"] == 107
    assert j["counts"]["diseases"] >= 30
    assert j["counts"]["relationships"] > 100


def test_list_structures_filters_and_pagination(client):
    r = client.get("/api/anatomy/structures", params={"kind": "mesh", "limit": 10})
    j = r.json()
    assert j["total"] == 86 and len(j["items"]) == 10
    r = client.get("/api/anatomy/structures", params={"group": "limbic", "hemisphere": "left"})
    names = {s["name"] for s in r.json()["items"]}
    assert "Left hippocampus" in names and "Right hippocampus" not in names


def test_structure_detail_hippocampus(client):
    r = client.get("/api/anatomy/structures/left-hippocampus")
    assert r.status_code == 200
    j = r.json()
    assert j["name"] == "Left hippocampus"
    assert j["fmaId"] == "FMA72714"
    assert j["originalPosition"][0] > 0  # patient-left is +X
    assert "episodic" in " ".join(j["content"]["functions"]).lower()
    assert "alzheimers-disease" in j["relatedDiseaseIds"]
    assert all(ref["url"].startswith("https://") for ref in j["references"])


def test_group_structure_resolves_meshes(client):
    j = client.get("/api/anatomy/structures/left-frontal-lobe").json()
    assert j["kind"] == "group"
    assert set(j["modelMeshIds"]) == {
        "left-superior-frontal-gyrus",
        "left-middle-frontal-gyrus",
        "left-precentral-gyrus",
    }


def test_structure_diseases(client):
    rels = client.get("/api/anatomy/structures/caudate-nucleus/diseases").status_code
    assert rels == 404  # contentId is not a structure id
    rels = client.get("/api/anatomy/structures/left-caudate-nucleus/diseases").json()
    assert any(r["diseaseId"] == "huntingtons-disease" and r["associationType"] == "primary" for r in rels)
    # hemisphere-wide associations are not pushed down onto small structures
    hippo = {r["diseaseId"] for r in client.get("/api/anatomy/structures/left-hippocampus/diseases").json()}
    assert "alzheimers-disease" in hippo and "brain-metastases" not in hippo and "meningitis" not in hippo


def test_groups(client):
    groups = {g["id"]: g["count"] for g in client.get("/api/anatomy/groups").json()}
    assert groups["cortex"] > 20 and "brainstem" in groups


def test_diseases_catalog_and_detail(client):
    j = client.get("/api/diseases", params={"category": "neurodegenerative"}).json()
    assert {d["id"] for d in j["items"]} >= {"alzheimers-disease", "parkinsons-disease", "huntingtons-disease"}
    d = client.get("/api/diseases/alzheimers-disease").json()
    for field in ("pathophysiology", "diagnosis", "treatments", "prognosis", "references", "lastReviewed", "faq"):
        assert d[field]
    assert any(a["target"] == "hippocampus" and a["type"] == "primary" for a in d["associations"])


def test_disease_structures(client):
    rels = client.get("/api/diseases/parkinsons-disease/structures").json()
    targets = {r["structureId"] for r in rels}
    assert {"putamen", "cerebral-peduncles"} <= targets
    assert all(r["resolvedMeshIds"] for r in rels)


def test_search(client):
    j = client.get("/api/search", params={"q": "hippocampus"}).json()
    assert j["structures"][0]["name"].endswith("hippocampus")
    j = client.get("/api/search", params={"q": "memory"}).json()
    assert any("hippocampus" in h["id"] for h in j["structures"])
    j = client.get("/api/search", params={"q": "Parkinson's disease"}).json()
    assert j["diseases"][0]["id"] == "parkinsons-disease"
    j = client.get("/api/search", params={"q": "stroke"}).json()
    assert {"ischemic-stroke", "hemorrhagic-stroke"} <= {h["id"] for h in j["diseases"]}
    j = client.get("/api/search", params={"q": "cerebellum"}).json()
    assert j["structures"][0]["id"] == "cerebellum"


def test_learning(client):
    mods = client.get("/api/learning/modules").json()
    assert len(mods) == 10
    m = client.get(f"/api/learning/modules/{mods[0]['id']}").json()
    assert m["steps"] and m["quiz"]


def test_errors_and_validation(client):
    assert client.get("/api/diseases/not-a-disease").status_code == 404
    assert client.get("/api/anatomy/structures/nope").status_code == 404
    assert client.get("/api/search").status_code == 422
    assert client.get("/api/diseases", params={"limit": 0}).status_code == 422
    assert client.get("/api/diseases", params={"category": "bogus"}).status_code == 422


def test_openapi(client):
    spec = client.get("/api/openapi.json").json()
    for path in [
        "/api/anatomy/structures",
        "/api/anatomy/structures/{structure_id}",
        "/api/anatomy/structures/{structure_id}/diseases",
        "/api/anatomy/groups",
        "/api/diseases",
        "/api/diseases/{disease_id}",
        "/api/diseases/{disease_id}/structures",
        "/api/search",
        "/api/learning/modules",
        "/api/learning/modules/{module_id}",
        "/api/health",
    ]:
        assert path in spec["paths"], path
