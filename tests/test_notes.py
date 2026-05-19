import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MyNote


@pytest.fixture
async def note(db: AsyncSession):
    """테스트용 노트 직접 삽입 — 테스트 후 삭제"""
    n = MyNote(title="테스트 노트", content_md="# 내용\n테스트입니다.", tags=["test"])
    db.add(n)
    await db.commit()
    await db.refresh(n)
    yield n
    await db.delete(n)
    await db.commit()


async def test_create_note(client):
    res = client.post("/api/v1/notes/", json={"title": "새 노트", "content": "내용"})
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "새 노트"
    assert body["content"] == "내용"
    assert body["content_md"] == "내용"
    assert "id" in body
    assert "updated" in body

    # 클린업
    client.delete(f"/api/v1/notes/{body['id']}")


async def test_create_note_with_tags(client):
    res = client.post("/api/v1/notes/", json={
        "title": "태그 노트",
        "content": "내용",
        "tags": ["ML", "딥러닝"],
    })
    assert res.status_code == 201
    assert res.json()["tags"] == ["ML", "딥러닝"]
    client.delete(f"/api/v1/notes/{res.json()['id']}")


async def test_list_notes(client, note: MyNote):
    res = client.get("/api/v1/notes/")
    assert res.status_code == 200
    ids = [n["id"] for n in res.json()]
    assert note.id in ids


async def test_list_notes_search(client, note: MyNote):
    res = client.get("/api/v1/notes/", params={"q": "테스트"})
    assert res.status_code == 200
    assert any(n["id"] == note.id for n in res.json())

    res = client.get("/api/v1/notes/", params={"q": "절대없는제목xyz"})
    assert res.status_code == 200
    assert res.json() == []


async def test_get_note(client, note: MyNote):
    res = client.get(f"/api/v1/notes/{note.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == note.id
    assert body["title"] == note.title
    assert body["content"] == body["content_md"]


async def test_update_note_title(client, note: MyNote):
    res = client.put(f"/api/v1/notes/{note.id}", json={"title": "수정된 제목"})
    assert res.status_code == 200
    assert res.json()["title"] == "수정된 제목"
    assert res.json()["content_md"] == note.content_md   # content 변경 안 됨


async def test_update_note_content(client, note: MyNote):
    res = client.put(f"/api/v1/notes/{note.id}", json={"content": "수정된 내용"})
    assert res.status_code == 200
    assert res.json()["content"] == "수정된 내용"
    assert res.json()["content_md"] == "수정된 내용"


def test_delete_note(client):
    create_res = client.post("/api/v1/notes/", json={"title": "삭제될 노트", "content": ""})
    assert create_res.status_code == 201
    note_id = create_res.json()["id"]

    res = client.delete(f"/api/v1/notes/{note_id}")
    assert res.status_code == 204

    get_res = client.get(f"/api/v1/notes/{note_id}")
    assert get_res.status_code == 404


async def test_get_note_not_found(client):
    res = client.get("/api/v1/notes/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    body = res.json()
    assert body["error"] == "NOT_FOUND"
    assert "detail" in body


async def test_get_note_invalid_uuid(client):
    res = client.get("/api/v1/notes/not-a-uuid")
    assert res.status_code == 404
    assert res.json()["error"] == "NOT_FOUND"


async def test_update_note_not_found(client):
    res = client.put(
        "/api/v1/notes/00000000-0000-0000-0000-000000000000",
        json={"title": "없음"},
    )
    assert res.status_code == 404
    assert res.json()["error"] == "NOT_FOUND"
