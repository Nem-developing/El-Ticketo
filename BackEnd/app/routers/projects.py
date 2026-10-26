from fastapi import APIRouter, Request, status
from sqlalchemy import select

from app.deps import AdminUser, CurrentUser, DbSession, commit_or_conflict, get_or_404
from app.journal import record
from app.models import Project
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


NAME_TAKEN = "Un projet porte déjà ce nom."


@router.get("", response_model=list[ProjectOut])
def list_projects(db: DbSession, _: CurrentUser):
    return db.scalars(select(Project).order_by(Project.name)).all()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession, admin: AdminUser, request: Request):
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    record(db, f"Projet « {project.name} » créé", actor=admin, request=request)
    commit_or_conflict(db, NAME_TAKEN)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int, payload: ProjectUpdate, db: DbSession, admin: AdminUser, request: Request
):
    project = get_or_404(db, Project, project_id, "Projet introuvable.")
    if payload.name is not None and payload.name != project.name:
        message = f"Projet « {project.name} » renommé en « {payload.name} »"
        record(db, message, actor=admin, request=request)
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    commit_or_conflict(db, NAME_TAKEN)
    return project
