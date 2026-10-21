import { useOverview } from "../../api/queries";
import { TicketTable } from "../../components/tickets/TicketTable";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, Loader } from "../../components/ui/States";
import { formatDuration } from "../../lib/format";
import { STALE_AFTER_DAYS } from "../../lib/labels";

/** Charge de travail de l'équipe, tous projets confondus : de quoi repérer ce qui coince. */
export function OverviewPage() {
  const overview = useOverview();

  return (
    <div className="page">
      <PageHeader title="Vue d'ensemble" subtitle="Tous les projets · 30 derniers jours" />

      {overview.isPending && <Loader />}
      {overview.isLoadingError && <ErrorState error={overview.error} onRetry={overview.refetch} />}
      {overview.data && (
        <>
          <section className="card" aria-labelledby="overview-projects">
            <h2 id="overview-projects" className="card__title">
              Par projet
            </h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Projet</th>
                    <th scope="col">Ouverts</th>
                    <th scope="col">Non assignés</th>
                    <th
                      scope="col"
                      className="hide-sm"
                      title={`Ouverts depuis plus de ${STALE_AFTER_DAYS} jours`}
                    >
                      + de {STALE_AFTER_DAYS} j
                    </th>
                    <th scope="col" className="hide-sm">
                      Fermés
                    </th>
                    <th scope="col" className="hide-md">
                      Délai moyen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.projects.map((project) => (
                    <tr key={project.id}>
                      <td>{project.name}</td>
                      <td>{project.open}</td>
                      <td>{project.unassigned}</td>
                      <td className="hide-sm">{project.stale}</td>
                      <td className="hide-sm">{project.closed_recently}</td>
                      <td className="hide-md">
                        {project.resolution_hours === null
                          ? "—"
                          : formatDuration(project.resolution_hours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-labelledby="overview-people">
            <h2 id="overview-people" className="card__title">
              Tickets assignés, par personne
            </h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Personne</th>
                    <th scope="col">Ouverts</th>
                    <th scope="col">Fermés</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.people.map(({ user, open, closed_recently }) => (
                    <tr key={user.id}>
                      <td>
                        {user.username}
                        {!user.is_active && <span className="muted"> (désactivé)</span>}
                      </td>
                      <td>{open}</td>
                      <td>{closed_recently}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-labelledby="overview-oldest">
            <h2 id="overview-oldest" className="card__title">
              Tickets ouverts les plus anciens
            </h2>
            {overview.data.oldest_open.length > 0 ? (
              <TicketTable tickets={overview.data.oldest_open} />
            ) : (
              <EmptyState title="Aucun ticket ouvert" hint="Tout est traité, bravo !" />
            )}
          </section>
        </>
      )}
    </div>
  );
}
