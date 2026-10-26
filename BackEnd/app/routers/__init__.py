from app.routers import (
    attachments,
    auth,
    health,
    logs,
    projects,
    stats,
    tickets,
    users,
    webhooks,
)

ROUTERS = (
    health.router,
    auth.router,
    users.router,
    projects.router,
    tickets.router,
    attachments.router,
    stats.router,
    logs.router,
    webhooks.router,
)
