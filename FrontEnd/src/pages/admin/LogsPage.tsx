import { Search } from "lucide-react";
import { useState } from "react";

import { useLogs } from "../../api/queries";
import type { LogEntry } from "../../api/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, Loader } from "../../components/ui/States";
import { formatDateTime } from "../../lib/format";
import { MAX_LENGTH } from "../../lib/labels";
import { useDebouncedCallback } from "../../lib/useDebouncedCallback";

const LIMIT = 200;

const LEVEL_LABELS: Record<LogEntry["level"], string | null> = {
  info: null,
  warning: "Avertissement",
  error: "Erreur",
};

/** Connexions, comptes, projets, suppressions et erreurs : de quoi comprendre ce qui s'est passé. */
export function LogsPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const writeQuery = useDebouncedCallback((value: string) => setQuery(value.trim()));
  const logs = useLogs(query, LIMIT);

  return (
    <div className="page">
      <PageHeader
        title="Journal"
        subtitle="Connexions, comptes, projets, suppressions et erreurs · conservé un an"
      />

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            className="input"
            placeholder="Rechercher…"
            maxLength={MAX_LENGTH.search}
            aria-label="Rechercher dans le journal"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              writeQuery(event.target.value);
            }}
          />
        </label>
      </div>

      {logs.isPending && <Loader />}
      {logs.isLoadingError && <ErrorState error={logs.error} onRetry={logs.refetch} />}
      {logs.data && logs.data.length === 0 && (
        <EmptyState title={query ? "Aucune ligne ne correspond à la recherche" : "Journal vide"} />
      )}
      {logs.data && logs.data.length > 0 && (
        <div className={logs.isPlaceholderData ? "is-refreshing" : undefined}>
          <div className="card card--flush">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Utilisateur</th>
                    <th scope="col">Événement</th>
                    <th scope="col" className="hide-sm">
                      Adresse IP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                      </td>
                      <td>{entry.actor ?? <span className="muted">—</span>}</td>
                      <td className="log__message">
                        {LEVEL_LABELS[entry.level] && (
                          <span className={`badge badge--${entry.level}`}>
                            {LEVEL_LABELS[entry.level]}
                          </span>
                        )}
                        {entry.message}
                      </td>
                      <td className="hide-sm muted">{entry.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {logs.data.length === LIMIT && (
            <p className="muted table-footer">
              Les {LIMIT} lignes les plus récentes sont affichées : affinez la recherche.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
