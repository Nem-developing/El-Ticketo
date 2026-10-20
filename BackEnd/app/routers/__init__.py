from app.routers import auth, health, projects, stats, tickets, users

ROUTERS = (health.router, auth.router, users.router, projects.router, tickets.router, stats.router)
