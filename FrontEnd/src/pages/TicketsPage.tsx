import { Download, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { useTickets } from "../api/queries";
import type { Ticket, TicketFilters, TicketStatus } from "../api/types";
import { useCurrentUser } from "../auth/context";
import { TicketTable } from "../components/tickets/TicketTable";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, Loader } from "../components/ui/States";
import { useCurrentProject } from "../context/project";
import { ticketsToCsv } from "../lib/csv";
import { saveFile } from "../lib/files";
import { MAX_LENGTH, OPEN_STATUSES, STATUSES, STATUS_LABELS } from "../lib/labels";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";

const LIMIT = 500;

// `who` : limite la vue aux tickets dont l'utilisateur est l'assigné ou le créateur.
const VIEWS = {
  open: { label: "Ouverts", statuses: OPEN_STATUSES, who: null },
  mine: { label: "Mes tickets", statuses: OPEN_STATUSES, who: "assignee" },
  requested: { label: "Mes demandes", statuses: undefined, who: "creator" },
  closed: { label: "Fermés", statuses: ["closed"], who: null },
  all: { label: "Tous", statuses: undefined, who: null },
} satisfies Record<
  string,
  { label: string; statuses?: TicketStatus[]; who: "assignee" | "creator" | null }
>;

type View = keyof typeof VIEWS;

const EMPTY_HINTS: Partial<Record<View, string>> = {
  mine: "Aucun ticket ouvert ne vous est assigné.",
  requested: "Vous n'avez ouvert aucun ticket dans ce projet.",
};

const isView = (value: string | null): value is View =>
  value !== null && Object.hasOwn(VIEWS, value);
const isStatus = (value: string | null): value is TicketStatus =>
  STATUSES.includes(value as TicketStatus);

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="chip chip--active"
      aria-label={`Retirer le filtre « ${label} »`}
      onClick={onRemove}
    >
      {label}
      <X size={14} aria-hidden="true" />
    </button>
  );
}

export function TicketsPage() {
  const user = useCurrentUser();
  const project = useCurrentProject();
  const [params, setParams] = useSearchParams();

  const viewParam = params.get("view");
  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : null;
  const category = params.get("category");
  const view: View = isView(viewParam) ? viewParam : "open";

  // L'URL fait foi (partage de lien, bouton Précédent) ; le champ suit les changements d'URL
  // venus d'ailleurs, et la saisie n'est reportée dans l'URL qu'après une courte pause.
  const query = params.get("q") ?? "";
  const [search, setSearch] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setSearch(query);
  }

  const navigate = useNavigate();
  const writeQuery = useDebouncedCallback((value: string) => {
    const next = new URLSearchParams(window.location.search);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    navigate({ search: next.toString() }, { replace: true });
  });

  const who = status ? null : VIEWS[view].who;
  const filters: TicketFilters = {
    project_id: project.id,
    status: status ? [status] : VIEWS[view].statuses,
    assignee_id: who === "assignee" ? user.id : undefined,
    created_by_id: who === "creator" ? user.id : undefined,
    category: category ?? undefined,
    q: query.trim() || undefined,
    limit: LIMIT,
  };
  const tickets = useTickets(filters);

  const removeFilter = (name: string) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.delete(name);
      return updated;
    });

  const exportCsv = (data: Ticket[]) =>
    saveFile(
      new Blob([ticketsToCsv(data)], { type: "text/csv;charset=utf-8" }),
      `tickets-${project.name}-${new Date().toISOString().slice(0, 10)}.csv`,
    );

  const selectView = (next: View) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.delete("status");
      if (next === "open") updated.delete("view");
      else updated.set("view", next);
      return updated;
    });
  };

  return (
    <div className="page">
      <PageHeader
        title="Tickets"
        actions={
          <Link to="/tickets/new" className="button button--primary">
            <Plus size={18} aria-hidden="true" />
            Nouveau ticket
          </Link>
        }
      />

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filtrer les tickets">
          {(Object.keys(VIEWS) as View[]).map((key) => (
            <button
              key={key}
              type="button"
              className="tabs__tab"
              aria-pressed={!status && view === key}
              onClick={() => selectView(key)}
            >
              {VIEWS[key].label}
            </button>
          ))}
        </div>

        {status && (
          <FilterChip
            label={`Statut : ${STATUS_LABELS[status]}`}
            onRemove={() => removeFilter("status")}
          />
        )}
        {category && (
          <FilterChip label={`Catégorie : ${category}`} onRemove={() => removeFilter("category")} />
        )}

        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            className="input"
            placeholder="Rechercher ou n°…"
            maxLength={MAX_LENGTH.search}
            aria-label="Rechercher un ticket"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              writeQuery(event.target.value);
            }}
          />
        </label>
      </div>

      {tickets.isPending && <Loader />}
      {tickets.isLoadingError && <ErrorState error={tickets.error} onRetry={tickets.refetch} />}
      {tickets.data && tickets.data.length === 0 && (
        <EmptyState
          title={query.trim() ? "Aucun ticket ne correspond à la recherche" : "Aucun ticket ici"}
          hint={query.trim() || status || category ? undefined : EMPTY_HINTS[view]}
        />
      )}
      {tickets.data && tickets.data.length > 0 && (
        <div className={tickets.isPlaceholderData ? "is-refreshing" : undefined}>
          <TicketTable tickets={tickets.data} />
          <p className="muted table-footer">
            {tickets.data.length === LIMIT
              ? `Les ${LIMIT} tickets les plus récents sont affichés : affinez la recherche.`
              : `${tickets.data.length} ticket${tickets.data.length > 1 ? "s" : ""}`}
            {" · "}
            <button type="button" className="link-button" onClick={() => exportCsv(tickets.data)}>
              <Download size={14} aria-hidden="true" />
              Exporter en CSV
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
