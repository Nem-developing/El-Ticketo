from app.routers import (
    attachments,
    auth,
    health,
    logs,
    notifications,
    projects,
    sso,
    stats,
    tickets,
    users,
    webhooks,
)

ROUTERS = (
    health.router,
    auth.router,
    sso.router,
    users.router,
    projects.router,
    tickets.router,
    notifications.router,
    attachments.router,
    stats.router,
    logs.router,
    webhooks.router,
)
