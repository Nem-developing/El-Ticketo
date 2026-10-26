import time

from sqlalchemy import func, select

from app import security
from app.models import Attachment, AttachmentChunk
from app.routers import attachments


def upload(
    client,
    ticket_id,
    headers,
    data=b"contenu",
    name="note.txt",
    content_type="text/plain",
    comment_id=None,
):
    return client.post(
        f"/api/tickets/{ticket_id}/attachments",
        params={"name": name} | ({"comment_id": comment_id} if comment_id else {}),
        content=data,
        headers={**headers, "Content-Type": content_type},
    )


def count_rows(client, model) -> int:
    with client.app.state.session_factory() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_attachment_lifecycle(client, admin, make_ticket):
    ticket = make_ticket()
    created = upload(client, ticket["id"], admin, b"\x89PNG", "capture.png", "image/png")
    assert created.status_code == 201
    attachment = created.json()
    assert (attachment["filename"], attachment["size"]) == ("capture.png", 4)

    listed = client.get(f"/api/tickets/{ticket['id']}/attachments", headers=admin).json()
    assert [a["id"] for a in listed] == [attachment["id"]]

    # Le lien signé suffit : une balise <img> n'envoie pas le token de session.
    file = client.get(attachment["url"])
    assert file.content == b"\x89PNG"
    assert file.headers["content-type"] == "image/png"

    deleted = client.delete(f"/api/attachments/{attachment['id']}", headers=admin)
    assert deleted.status_code == 204
    assert client.get(f"/api/tickets/{ticket['id']}/attachments", headers=admin).json() == []
    assert count_rows(client, AttachmentChunk) == 0


def test_large_files_are_stored_in_chunks(client, admin, make_ticket, monkeypatch):
    monkeypatch.setattr(attachments, "CHUNK_SIZE", 3)
    ticket = make_ticket()
    attachment = upload(client, ticket["id"], admin, b"0123456789").json()

    assert count_rows(client, AttachmentChunk) == 4
    file = client.get(attachment["url"])
    assert file.content == b"0123456789"
    assert file.headers["content-length"] == "10"


def test_file_links_must_be_signed(client, admin, make_ticket):
    ticket = make_ticket()
    url = upload(client, ticket["id"], admin).json()["url"]

    assert client.get(url.replace("signature=", "signature=0")).status_code == 403
    assert client.get(url.replace("signature=", "signature=é")).status_code == 403
    assert client.get(url.replace("expires=", "expires=1")).status_code == 403


def test_expired_links_are_refused():
    expires = int(time.time()) - 1
    assert not security.is_valid_attachment_link(1, expires, security._signature(1, expires))


def test_unsafe_files_are_served_as_binary(client, admin, make_ticket):
    ticket = make_ticket()
    attachment = upload(client, ticket["id"], admin, b"<script>", "page.html", "text/html").json()

    file = client.get(attachment["url"])
    assert file.headers["content-type"] == "application/octet-stream"
    assert file.headers["content-disposition"] == "attachment; filename*=UTF-8''page.html"


def test_refused_uploads_leave_nothing_behind(client, admin, make_ticket, monkeypatch):
    monkeypatch.setattr(attachments, "CHUNK_SIZE", 3)
    monkeypatch.setattr(attachments, "MAX_SIZE", 10)
    ticket = make_ticket()

    assert upload(client, ticket["id"], admin, b"").status_code == 400
    assert upload(client, ticket["id"], admin, b"x" * 11).status_code == 413
    # Sans taille annoncée (envoi par morceaux), la limite s'applique pendant la réception.
    assert upload(client, ticket["id"], admin, iter([b"x" * 6, b"x" * 6])).status_code == 413
    assert upload(client, 999, admin).status_code == 404
    assert count_rows(client, Attachment) == count_rows(client, AttachmentChunk) == 0


def test_blank_file_names_get_a_default_name(client, admin, make_ticket):
    ticket = make_ticket()
    assert upload(client, ticket["id"], admin, name="   ").json()["filename"] == "fichier"


def test_only_uploader_or_admin_deletes_an_attachment(client, admin, member, make_ticket):
    ticket = make_ticket()
    attachment = upload(client, ticket["id"], admin).json()
    assert client.delete(f"/api/attachments/{attachment['id']}", headers=member).status_code == 403


def test_deleting_a_ticket_deletes_its_attachments(client, admin, make_ticket):
    ticket = make_ticket()
    upload(client, ticket["id"], admin)
    client.delete(f"/api/tickets/{ticket['id']}", headers=admin)
    assert count_rows(client, Attachment) == count_rows(client, AttachmentChunk) == 0


def test_comment_attachments(client, admin, member, make_ticket):
    ticket, other = make_ticket(), make_ticket()
    comments = f"/api/tickets/{ticket['id']}/comments"
    # Une capture seule, sans texte, fait un commentaire.
    comment = client.post(comments, json={"body": ""}, headers=member).json()

    created = upload(
        client, ticket["id"], member, b"\x89PNG", "capture.png", "image/png", comment["id"]
    )
    assert created.status_code == 201
    assert upload(client, ticket["id"], admin, comment_id=comment["id"]).status_code == 403
    assert upload(client, other["id"], member, comment_id=comment["id"]).status_code == 404

    listed = client.get(comments, headers=admin).json()
    assert [a["filename"] for a in listed[0]["attachments"]] == ["capture.png"]
    assert client.get(f"/api/tickets/{ticket['id']}/attachments", headers=admin).json() == []

    client.delete(f"{comments}/{comment['id']}", headers=member)
    assert count_rows(client, Attachment) == count_rows(client, AttachmentChunk) == 0
