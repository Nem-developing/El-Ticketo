from fastapi import APIRouter, status
from sqlalchemy import select

from app.deps import AdminUser, CurrentUser, DbSession, commit_or_conflict, get_or_404
from app.models import Project
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


NAME_TAKEN = "Un projet porte déjà ce nom."


@router.get("", response_model=list[ProjectOut])
def list_projects(db: DbSession, _: CurrentUser):
    return db.scalars(select(Project).order_by(Project.name)).all()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession, _: AdminUser):
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    commit_or_conflict(db, NAME_TAKEN)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: DbSession, _: AdminUser):
    project = get_or_404(db, Project, project_id, "Projet introuvable.")
    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    commit_or_conflict(db, NAME_TAKEN)
    return project
