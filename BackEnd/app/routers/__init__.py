from app.routers import attachments, auth, health, projects, stats, tickets, users

ROUTERS = (
    health.router,
    auth.router,
    users.router,
    projects.router,
    tickets.router,
    attachments.router,
    stats.router,
)
