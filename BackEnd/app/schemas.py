"""Schémas d'entrée / sortie de l'API (validation et documentation OpenAPI)."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    field_validator,
)

from app.models import LogLevel, TicketPriority, TicketStatus
from app.security import attachment_url

Username = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=3,
        max_length=32,
        pattern=r"^[A-Za-z0-9._-]+$",
    ),
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
# 10 000 caractères × 4 octets (utf8mb4) tiennent dans un TEXT MariaDB (64 Ko).
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=10_000)]
CommentBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Utilisateurs -------------------------------------------------------------


class UserSummary(ORMModel):
    id: int
    username: str


class UserOut(UserSummary):
    is_admin: bool
    is_active: bool
    sso: bool = Field(description="Compte rattaché au SSO (connexion sans mot de passe).")
    created_at: datetime


class UserCreate(BaseModel):
    username: Username
    password: Password
    is_admin: bool = False


class UserUpdate(BaseModel):
    password: Password | None = None
    is_admin: bool | None = None
    is_active: bool | None = None


# --- Authentification ---------------------------------------------------------


class LoginRequest(BaseModel):
    # Bornes larges : évitent seulement de hacher des chaînes démesurées.
    username: Annotated[str, StringConstraints(max_length=64)]
    password: Annotated[str, StringConstraints(max_length=256)]


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: UserOut


class SsoStatus(BaseModel):
    enabled: bool


class SsoConfigOut(BaseModel):
    enabled: bool
    issuer: str
    client_id: str
    has_secret: bool
    redirect_uri: str = Field(description="Adresse de retour à déclarer chez le fournisseur.")


class SsoConfigWrite(BaseModel):
    enabled: bool
    issuer: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^(https?://\S+)?$")
    ]
    client_id: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
    client_secret: Annotated[str, StringConstraints(max_length=500)] | None = None


class SsoTestOut(BaseModel):
    url: str


class PasswordChange(BaseModel):
    current_password: Annotated[str, StringConstraints(max_length=256)]
    new_password: Password


# --- Projets ------------------------------------------------------------------


class ProjectOut(ORMModel):
    id: int
    name: str
    description: str
    created_at: datetime


class ProjectCreate(BaseModel):
    name: ProjectName
    description: LongText = ""


class ProjectUpdate(BaseModel):
    name: ProjectName | None = None
    description: LongText | None = None


# --- Tickets ------------------------------------------------------------------


class TicketOut(ORMModel):
    id: int
    project_id: int
    title: str
    description: str
    category: str
    priority: TicketPriority
    status: TicketStatus
    created_by: UserSummary
    assignee: UserSummary | None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


class TicketCreate(BaseModel):
    project_id: int
    title: Title
    description: LongText = ""
    category: Category
    priority: TicketPriority = TicketPriority.NORMAL


class TicketUpdate(BaseModel):
    """Mise à jour partielle : seuls les champs envoyés sont modifiés.

    `assignee_id: null` désassigne le ticket.
    """

    title: Title | None = None
    description: LongText | None = None
    category: Category | None = None
    priority: TicketPriority | None = None
    status: TicketStatus | None = None
    assignee_id: int | None = None
    project_id: int | None = None


# --- Historique et pièces jointes ---------------------------------------------


class TicketEventOut(ORMModel):
    id: int
    actor: UserSummary
    field: Literal["title", "description", "category", "priority", "status", "assignee", "project"]
    value: str | None
    created_at: datetime


class AttachmentOut(ORMModel):
    id: int
    ticket_id: int
    filename: str
    content_type: str
    size: int
    uploaded_by: UserSummary
    created_at: datetime

    @computed_field(description="Lien signé vers le fichier, valable au moins une heure.")
    @property
    def url(self) -> str:
        return attachment_url(self.id)


# --- Commentaires -------------------------------------------------------------


class CommentOut(ORMModel):
    id: int
    ticket_id: int
    author: UserSummary
    body: str
    attachments: list[AttachmentOut]
    created_at: datetime
    updated_at: datetime | None


class CommentCreate(BaseModel):
    # Peut rester vide quand le commentaire n'est qu'une capture d'écran, jointe ensuite.
    body: LongText = ""


class CommentWrite(BaseModel):
    body: CommentBody


# --- Statistiques -------------------------------------------------------------


class StatusCounts(BaseModel):
    new: int = 0
    in_progress: int = 0
    waiting: int = 0
    closed: int = 0
    total: int = 0


class CategoryCount(BaseModel):
    category: str
    count: int


class TimelinePoint(BaseModel):
    date: date
    created: int
    closed: int


class StatsOut(BaseModel):
    counts: StatusCounts
    by_category: list[CategoryCount]
    timeline: list[TimelinePoint] = Field(description="Tickets créés et fermés par jour (UTC).")


class Workload(BaseModel):
    open: int
    closed_recently: int = Field(description="Tickets fermés ces 30 derniers jours.")


class ProjectOverview(Workload):
    id: int
    name: str
    unassigned: int
    stale: int = Field(description="Tickets ouverts depuis plus de 7 jours.")
    resolution_hours: float | None = Field(
        description="Délai moyen de résolution des tickets fermés ces 30 derniers jours."
    )


class PersonOverview(Workload):
    user: UserOut


class OverviewOut(BaseModel):
    projects: list[ProjectOverview]
    people: list[PersonOverview]
    oldest_open: list[TicketOut]


# --- Journal ------------------------------------------------------------------


class LogEntryOut(ORMModel):
    id: int
    created_at: datetime
    level: LogLevel
    actor: str | None
    ip: str | None
    message: str


# --- Webhooks -----------------------------------------------------------------

WebhookEvent = Literal[
    "ticket.created", "ticket.updated", "ticket.deleted", "comment.created", "user.created"
]
WebhookUrl = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://[^\s]+$")
]


class WebhookOut(ORMModel):
    id: int
    url: str
    events: list[WebhookEvent]
    created_at: datetime

    @field_validator("events", mode="before")
    @classmethod
    def _split(cls, value: str | list[str]) -> list[str]:
        return value.split(",") if isinstance(value, str) else value


class WebhookWrite(BaseModel):
    url: WebhookUrl
    events: list[WebhookEvent] = Field(min_length=1)


# --- Divers -------------------------------------------------------------------


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    database: Literal["ok", "error"]
