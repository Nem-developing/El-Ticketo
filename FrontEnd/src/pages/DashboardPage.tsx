import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";

import { useStats, useTickets } from "../api/queries";
import type { TicketStatus } from "../api/types";
import { CategoryBars } from "../components/charts/CategoryBars";
import { TicketTable } from "../components/tickets/TicketTable";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, Loader } from "../components/ui/States";
import { useCurrentProject } from "../context/project";
import { OPEN_STATUSES, STATUSES, STATUS_LABELS } from "../lib/labels";

// recharts est volumineux : chargé seulement quand le tableau de bord s'affiche.
const ActivityChart = lazy(() =>
  import("../components/charts/ActivityChart").then((module) => ({
    default: module.ActivityChart,
  })),
);

const PERIODS = [7, 30, 90];

function StatTile({ status, value }: { status: TicketStatus; value: number }) {
  return (
    <Link to={`/tickets?status=${status}`} className={`stat stat--${status}`}>
      <span className="stat__label">
        <span className="stat__dot" aria-hidden="true" />
        {STATUS_LABELS[status]}
      </span>
      <span className="stat__value">{value}</span>
    </Link>
  );
}

export function DashboardPage() {
  const project = useCurrentProject();
  const [days, setDays] = useState(30);
  const stats = useStats(project.id, days);
  const recent = useTickets({ project_id: project.id, status: OPEN_STATUSES, limit: 5 });

  return (
    <div className="page">
      <PageHeader title="Tableau de bord" subtitle={project.name} />

      {stats.isPending && <Loader />}
      {stats.isLoadingError && <ErrorState error={stats.error} onRetry={stats.refetch} />}
      {stats.data && (
        // Pendant un changement de projet ou de période, les anciennes valeurs restent
        // affichées en grisé plutôt que de laisser place à un chargement.
        <div className={`page ${stats.isPlaceholderData ? "is-refreshing" : ""}`}>
          <section className="stats" aria-label="Tickets par statut">
            {STATUSES.map((status) => (
              <StatTile key={status} status={status} value={stats.data.counts[status]} />
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="card" aria-labelledby="activity-title">
              <header className="card__header">
                <h2 id="activity-title" className="card__title">
                  Activité
                </h2>
                <div className="segmented segmented--small" role="radiogroup" aria-label="Période">
                  {PERIODS.map((period) => (
                    <label key={period} className="segmented__option">
                      <input
                        type="radio"
                        name="period"
                        checked={days === period}
                        onChange={() => setDays(period)}
                      />
                      <span>{period} j</span>
                    </label>
                  ))}
                </div>
              </header>
              <Suspense fallback={<Loader />}>
                <ActivityChart timeline={stats.data.timeline} />
              </Suspense>
            </section>

            <section className="card" aria-labelledby="categories-title">
              <h2 id="categories-title" className="card__title">
                Par catégorie
              </h2>
              {stats.data.by_category.length > 0 ? (
                <CategoryBars categories={stats.data.by_category} />
              ) : (
                <p className="muted">Aucun ticket pour l'instant.</p>
              )}
            </section>
          </div>
        </div>
      )}

      <section className="card" aria-labelledby="recent-title">
        <header className="card__header">
          <h2 id="recent-title" className="card__title">
            Derniers tickets ouverts
          </h2>
          <Link to="/tickets" className="link-button">
            Tout voir
          </Link>
        </header>
        {recent.isPending && <Loader />}
        {recent.isLoadingError && <ErrorState error={recent.error} onRetry={recent.refetch} />}
        {recent.data && recent.data.length > 0 && <TicketTable tickets={recent.data} />}
        {recent.data && recent.data.length === 0 && (
          <EmptyState title="Aucun ticket ouvert" hint="Tout est traité, bravo !" />
        )}
      </section>
    </div>
  );
}
