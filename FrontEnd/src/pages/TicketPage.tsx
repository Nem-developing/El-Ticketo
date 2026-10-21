import { ArrowLeft, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, errorMessage } from "../api/client";
import {
  useAttachmentMutations,
  useDeleteTicket,
  useTicket,
  useUpdateTicket,
  useUsers,
} from "../api/queries";
import type { Ticket, TicketPriority, TicketStatus, TicketUpdate } from "../api/types";
import { useCurrentUser } from "../auth/context";
import { Attachments } from "../components/tickets/Attachments";
import { CommentThread } from "../components/tickets/CommentThread";
import { PriorityBadge, StatusBadge } from "../components/ui/Badges";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Field } from "../components/ui/Field";
import { FilePicker } from "../components/ui/FilePicker";
import { Linkify } from "../components/ui/Linkify";
import { EmptyState, ErrorState, Loader } from "../components/ui/States";
import { useProjectContext } from "../context/project";
import { useToast } from "../context/toast";
import { dropFiles } from "../lib/files";
import { formatDateTime, formatRelative } from "../lib/format";
import {
  MAX_LENGTH,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  SUGGESTED_CATEGORIES,
} from "../lib/labels";
import { usePastedFiles } from "../lib/usePastedFiles";

function ContentEditor({
  ticket,
  onSave,
  onCancel,
  pending,
}: {
  ticket: Ticket;
  onSave: (changes: TicketUpdate) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [category, setCategory] = useState(ticket.category);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // N'envoie que ce qui a changé, pour ne pas écraser une modification faite entre-temps
    // par un collègue sur un autre champ.
    const changes: TicketUpdate = {};
    if (title.trim() !== ticket.title) changes.title = title;
    if (description.trim() !== ticket.description) changes.description = description;
    if (category.trim() !== ticket.category) changes.category = category;
    if (Object.keys(changes).length === 0) onCancel();
    else onSave(changes);
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Titre" htmlFor="edit-title">
        <input
          id="edit-title"
          className="input"
          required
          maxLength={MAX_LENGTH.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="Catégorie" htmlFor="edit-category">
        <input
          id="edit-category"
          className="input"
          list="category-suggestions"
          required
          maxLength={MAX_LENGTH.category}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <datalist id="category-suggestions">
          {SUGGESTED_CATEGORIES.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </Field>
      <Field label="Description" htmlFor="edit-description" optional>
        <textarea
          id="edit-description"
          className="input"
          rows={6}
          maxLength={MAX_LENGTH.text}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="button button--primary" disabled={pending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function TicketDetails({ ticket }: { ticket: Ticket }) {
  const user = useCurrentUser();
  const users = useUsers();
  const { projects } = useProjectContext();
  const toast = useToast();
  const navigate = useNavigate();
  const update = useUpdateTicket(ticket.id);
  const remove = useDeleteTicket(ticket.id);
  const { upload } = useAttachmentMutations(ticket.id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (changes: TicketUpdate, onDone?: () => void) =>
    update.mutate(changes, {
      onSuccess: () => onDone?.(),
      onError: (error) => toast.error(errorMessage(error)),
    });

  const attach = (files: File[]) =>
    files.forEach((file) =>
      upload.mutate(file, { onError: (error) => toast.error(errorMessage(error)) }),
    );
  usePastedFiles(attach);

  const deleteTicket = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Ticket #${ticket.id} supprimé.`);
        navigate("/tickets", { replace: true });
      },
      onError: (error) => toast.error(errorMessage(error)),
    });

  const isClosed = ticket.status === "closed";
  const isMine = ticket.assignee?.id === user.id;
  const assignableUsers = (users.data ?? []).filter(
    (candidate) => candidate.is_active || candidate.id === ticket.assignee?.id,
  );

  return (
    <div className="page" {...dropFiles(attach)}>
      <Link to="/tickets" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Tickets
      </Link>

      <header className="ticket-header">
        <div>
          <p className="ticket-header__id">#{ticket.id}</p>
          <h1 className="ticket-header__title">{ticket.title}</h1>
          <div className="ticket-header__badges">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="tag">{ticket.category}</span>
          </div>
        </div>
        <div className="ticket-header__actions">
          {!isClosed && !(isMine && ticket.status === "in_progress") && (
            <button
              type="button"
              className="button"
              disabled={update.isPending}
              onClick={() => save({ status: "in_progress", assignee_id: user.id })}
            >
              Prendre en charge
            </button>
          )}
          {isClosed ? (
            <button
              type="button"
              className="button"
              disabled={update.isPending}
              onClick={() => save({ status: ticket.assignee ? "in_progress" : "new" })}
            >
              Rouvrir
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary"
              disabled={update.isPending}
              onClick={() => save({ status: "closed" })}
            >
              Fermer le ticket
            </button>
          )}
        </div>
      </header>

      <div className="ticket-layout">
        <div className="ticket-layout__main">
          <section className="card" aria-label="Description">
            {editing ? (
              <ContentEditor
                ticket={ticket}
                pending={update.isPending}
                onCancel={() => setEditing(false)}
                onSave={(changes) => save(changes, () => setEditing(false))}
              />
            ) : (
              <>
                <header className="card__header">
                  <h2 className="card__title">Description</h2>
                  <div className="card__actions">
                    <FilePicker onFiles={attach} pending={upload.isPending} />
                    <button type="button" className="link-button" onClick={() => setEditing(true)}>
                      <Pencil size={14} aria-hidden="true" />
                      Modifier
                    </button>
                  </div>
                </header>
                {ticket.description ? (
                  <p className="prose">
                    <Linkify text={ticket.description} />
                  </p>
                ) : (
                  <p className="muted">Pas de description.</p>
                )}
              </>
            )}
            <Attachments ticketId={ticket.id} />
          </section>

          <CommentThread ticketId={ticket.id} />
        </div>

        <aside className="ticket-layout__side">
          <section className="card form" aria-label="Suivi">
            <Field label="Statut" htmlFor="status">
              <select
                id="status"
                className="input"
                value={ticket.status}
                disabled={update.isPending}
                onChange={(event) => save({ status: event.target.value as TicketStatus })}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priorité" htmlFor="priority">
              <select
                id="priority"
                className="input"
                value={ticket.priority}
                disabled={update.isPending}
                onChange={(event) => save({ priority: event.target.value as TicketPriority })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </Field>

            {projects.length > 1 && (
              <Field label="Projet" htmlFor="project">
                <select
                  id="project"
                  className="input"
                  value={ticket.project_id}
                  disabled={update.isPending}
                  onChange={(event) => save({ project_id: Number(event.target.value) })}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Assigné à" htmlFor="assignee">
              <select
                id="assignee"
                className="input"
                value={ticket.assignee?.id ?? ""}
                disabled={update.isPending || users.isPending}
                onChange={(event) =>
                  save({ assignee_id: event.target.value ? Number(event.target.value) : null })
                }
              >
                <option value="">Personne</option>
                {assignableUsers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.username}
                    {candidate.id === user.id ? " (moi)" : ""}
                  </option>
                ))}
              </select>
            </Field>

            <dl className="meta">
              <dt>Créé par</dt>
              <dd>{ticket.created_by.username}</dd>
              <dt>Créé le</dt>
              <dd>{formatDateTime(ticket.created_at)}</dd>
              <dt>Mis à jour</dt>
              <dd title={formatDateTime(ticket.updated_at)}>{formatRelative(ticket.updated_at)}</dd>
              {ticket.closed_at && (
                <>
                  <dt>Fermé le</dt>
                  <dd>{formatDateTime(ticket.closed_at)}</dd>
                </>
              )}
            </dl>
          </section>

          {user.is_admin && (
            <button
              type="button"
              className="button button--danger-ghost button--block"
              onClick={() => setConfirmDelete(true)}
            >
              Supprimer le ticket
            </button>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Supprimer le ticket #${ticket.id} ?`}
        message="Le ticket et ses commentaires seront définitivement supprimés."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={deleteTicket}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export function TicketPage() {
  const ticketId = Number(useParams().ticketId);
  const ticket = useTicket(ticketId);

  const notFound =
    !(Number.isInteger(ticketId) && ticketId > 0) ||
    (ticket.error instanceof ApiError && [404, 422].includes(ticket.error.status));

  if (notFound) {
    return (
      <EmptyState
        title="Ticket introuvable"
        hint="Il a peut-être été supprimé, ou le lien est erroné."
        action={
          <Link to="/tickets" className="button">
            Retour aux tickets
          </Link>
        }
      />
    );
  }
  if (ticket.isPending) return <Loader />;
  if (ticket.isLoadingError) return <ErrorState error={ticket.error} onRetry={ticket.refetch} />;
  return <TicketDetails key={ticket.data.id} ticket={ticket.data} />;
}
