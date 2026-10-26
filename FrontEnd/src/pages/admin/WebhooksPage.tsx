import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { errorMessage } from "../../api/client";
import { useWebhookMutations, useWebhooks } from "../../api/queries";
import type { Webhook, WebhookEvent } from "../../api/types";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Field, FormError } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, Loader } from "../../components/ui/States";
import { useToast } from "../../context/toast";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "ticket.created": "Ticket créé",
  "ticket.updated": "Ticket modifié",
  "ticket.deleted": "Ticket supprimé",
  "comment.created": "Commentaire ajouté",
  "user.created": "Utilisateur créé",
};
const EVENTS = Object.keys(EVENT_LABELS) as WebhookEvent[];

function WebhookForm({ webhook, onDone }: { webhook?: Webhook; onDone: () => void }) {
  const { save } = useWebhookMutations();
  const toast = useToast();
  const [url, setUrl] = useState(webhook?.url ?? "");
  // Le plus courant : une seule adresse (n8n, Zapier…) qui reçoit tout.
  const [events, setEvents] = useState<WebhookEvent[]>(webhook?.events ?? EVENTS);
  const [error, setError] = useState<string | null>(null);

  const toggle = (event: WebhookEvent, checked: boolean) =>
    setEvents(EVENTS.filter((other) => (other === event ? checked : events.includes(other))));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (events.length === 0) {
      setError("Choisissez au moins un événement.");
      return;
    }
    setError(null);
    save.mutate(
      { id: webhook?.id, data: { url, events } },
      {
        onSuccess: () => {
          toast.success(webhook ? "Webhook mis à jour." : "Webhook ajouté.");
          onDone();
        },
        onError: (saveError) => setError(errorMessage(saveError)),
      },
    );
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Adresse appelée" htmlFor="webhook-url" hint="Requête POST, corps en JSON.">
        <input
          id="webhook-url"
          type="url"
          className="input"
          required
          maxLength={500}
          pattern="https?://.+"
          placeholder="https://"
          autoFocus
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <fieldset className="field">
        <legend className="field__label">Événements</legend>
        {EVENTS.map((event) => (
          <label key={event} className="checkbox">
            <input
              type="checkbox"
              checked={events.includes(event)}
              onChange={(change) => toggle(event, change.target.checked)}
            />
            {EVENT_LABELS[event]}
          </label>
        ))}
      </fieldset>
      <FormError message={error} />
      <div className="form-actions">
        <button type="button" className="button" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="button button--primary" disabled={save.isPending}>
          {webhook ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

export function WebhooksPage() {
  const webhooks = useWebhooks();
  const { remove, test } = useWebhookMutations();
  const toast = useToast();
  // undefined : modale fermée ; null : ajout ; Webhook : modification.
  const [editing, setEditing] = useState<Webhook | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<Webhook | null>(null);
  const close = () => setEditing(undefined);

  const sendTest = (webhook: Webhook) =>
    test.mutate(webhook.id, {
      onSuccess: () => toast.success("L'adresse a bien répondu au test."),
      onError: (error) => toast.error(errorMessage(error)),
    });

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => setToDelete(null),
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  return (
    <div className="page">
      <PageHeader
        title="Webhooks"
        subtitle="Adresses appelées à chaque événement. Le champ « text » s'affiche tel quel dans Slack, Mattermost ou Rocket.Chat ; les échecs sont inscrits au journal."
        actions={
          <button type="button" className="button button--primary" onClick={() => setEditing(null)}>
            <Plus size={18} aria-hidden="true" />
            Nouveau webhook
          </button>
        }
      />

      {webhooks.isPending && <Loader />}
      {webhooks.isLoadingError && <ErrorState error={webhooks.error} onRetry={webhooks.refetch} />}
      {webhooks.data?.length === 0 && (
        <EmptyState
          title="Aucun webhook"
          hint="Prévenez un autre outil quand un ticket est créé, modifié, commenté ou supprimé."
        />
      )}
      {webhooks.data && webhooks.data.length > 0 && (
        <div className="card card--flush">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Adresse</th>
                  <th scope="col" className="hide-sm">
                    Événements
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {webhooks.data.map((webhook) => (
                  <tr key={webhook.id}>
                    <td className="webhook__url">{webhook.url}</td>
                    <td className="hide-sm">
                      {webhook.events.map((event) => EVENT_LABELS[event]).join(", ")}
                    </td>
                    <td className="table__actions">
                      <button
                        type="button"
                        className="link-button"
                        disabled={test.isPending}
                        onClick={() => sendTest(webhook)}
                      >
                        Tester
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setEditing(webhook)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setToDelete(webhook)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        title={editing ? "Modifier le webhook" : "Nouveau webhook"}
        open={editing !== undefined}
        onClose={close}
      >
        {editing !== undefined && (
          <WebhookForm key={editing?.id ?? "new"} webhook={editing ?? undefined} onDone={close} />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer le webhook ?"
        message={`${toDelete?.url ?? ""} ne sera plus appelée.`}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
