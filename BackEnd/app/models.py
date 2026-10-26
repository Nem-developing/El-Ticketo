"""Modèle de données.

Volontairement minimal : des utilisateurs (admin ou membre), des projets, des tickets,
leurs commentaires, pièces jointes et historique, plus le journal d'administration et les
webhooks.
Toutes les dates sont stockées en UTC.
"""

import enum
from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    Text,
    TypeDecorator,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator):
    """Date stockée en UTC sans fuseau (compatible MariaDB), restituée avec le fuseau UTC."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(UTC).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value


class TicketStatus(enum.StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    CLOSED = "closed"


class TicketPriority(enum.StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class LogLevel(enum.StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


def _str_enum(enum_cls: type[enum.StrEnum]) -> Enum:
    # Stocke la valeur ("in_progress") plutôt que le nom, en VARCHAR portable.
    return Enum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda members: [member.value for member in members],
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # Identifiant (« sub ») du compte chez le fournisseur SSO ; un compte rattaché ne se
    # connecte plus par mot de passe (son empreinte est vide).
    sso_subject: Mapped[str | None] = mapped_column(String(255), index=True, unique=True)

    @property
    def sso(self) -> bool:
        return self.sso_subject is not None


class ApiToken(Base):
    """Session ouverte par /auth/login. Seule l'empreinte SHA-256 du token est conservée."""

    __tablename__ = "api_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)

    user: Mapped[User] = relationship()


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (Index("ix_tickets_project_status", "project_id", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(50))
    priority: Mapped[TicketPriority] = mapped_column(
        _str_enum(TicketPriority), default=TicketPriority.NORMAL
    )
    status: Mapped[TicketStatus] = mapped_column(_str_enum(TicketStatus), default=TicketStatus.NEW)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, index=True)

    project: Mapped[Project] = relationship()
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id], lazy="joined")
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id], lazy="joined")
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan", passive_deletes=True
    )

    def set_status(self, status: TicketStatus) -> None:
        """Change le statut en tenant à jour la date de fermeture."""
        if status == self.status:
            return
        self.status = status
        self.closed_at = utcnow() if status == TicketStatus.CLOSED else None


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # Renseignée uniquement si le commentaire a été modifié.
    updated_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    ticket: Mapped[Ticket] = relationship(back_populates="comments")
    author: Mapped[User] = relationship(lazy="joined")
    attachments: Mapped[list["Attachment"]] = relationship(
        lazy="selectin",
        order_by="Attachment.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TicketEvent(Base):
    """Modification d'un ticket (statut, assignation…), affichée dans son historique."""

    __tablename__ = "ticket_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    field: Mapped[str] = mapped_column(String(20))
    # Nouvelle valeur, lisible telle quelle (nom de l'assigné, du projet…).
    value: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    actor: Mapped[User] = relationship(lazy="joined")


class Attachment(Base):
    """Fichier joint à un ticket, ou à l'un de ses commentaires ; son contenu est stocké en base,
    en morceaux."""

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    comment_id: Mapped[int | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), index=True
    )
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    uploaded_by: Mapped[User] = relationship(lazy="joined")


# Jusqu'à 16 Mo sous MariaDB (un BLOB simple s'arrête à 64 Ko).
ChunkData = LargeBinary().with_variant(mysql.MEDIUMBLOB(), "mysql", "mariadb")


class AttachmentChunk(Base):
    """Morceau d'une pièce jointe : découpé ainsi, un fichier d'1 Go tient en base sans
    dépasser la taille maximale d'une requête MariaDB."""

    __tablename__ = "attachment_chunks"

    attachment_id: Mapped[int] = mapped_column(
        ForeignKey("attachments.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(primary_key=True)
    data: Mapped[bytes] = mapped_column(ChunkData)


class LogEntry(Base):
    """Ligne du journal d'administration (connexions, comptes, suppressions, erreurs…)."""

    __tablename__ = "log_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    level: Mapped[LogLevel] = mapped_column(_str_enum(LogLevel), default=LogLevel.INFO)
    # Identifiant de l'utilisateur à l'origine de l'événement, tel qu'il était à ce moment.
    actor: Mapped[str | None] = mapped_column(String(32))
    ip: Mapped[str | None] = mapped_column(String(45))
    message: Mapped[str] = mapped_column(String(500))


class Webhook(Base):
    """Adresse appelée (POST JSON) à chaque événement choisi, voir app/webhooks.py."""

    __tablename__ = "webhooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(String(500))
    # Événements séparés par des virgules : « ticket.created,user.created ».
    events: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
