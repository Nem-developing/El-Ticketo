import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage } from "../api/client";
import { useCreateTicket } from "../api/queries";
import type { TicketPriority } from "../api/types";
import { CategoryPicker, PriorityPicker } from "../components/tickets/Pickers";
import { Field, FormError } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { useCurrentProject, useProjectContext } from "../context/project";
import { useToast } from "../context/toast";
import { celebrate } from "../lib/confetti";
import { MAX_LENGTH } from "../lib/labels";

export function NewTicketPage() {
  const project = useCurrentProject();
  const { projects } = useProjectContext();
  const navigate = useNavigate();
  const toast = useToast();
  const createTicket = useCreateTicket();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (createTicket.isPending) return;
    if (!title.trim()) {
      setError("Donnez un titre au ticket.");
      return;
    }
    if (!category) {
      setError("Choisissez une catégorie.");
      return;
    }
    setError(null);
    createTicket.mutate(
      { project_id: project.id, title, description, category, priority },
      {
        onSuccess: (ticket) => {
          celebrate();
          toast.success(`Ticket #${ticket.id} créé.`);
          navigate(`/tickets/${ticket.id}`);
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
      },
    );
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Nouveau ticket"
        subtitle={projects.length > 1 ? `Projet : ${project.name}` : undefined}
      />

      <form className="card form" onSubmit={submit}>
        <Field label="Titre" htmlFor="title">
          <input
            id="title"
            className="input"
            placeholder="Ex. L'imprimante du 2e étage ne répond plus"
            maxLength={MAX_LENGTH.title}
            required
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="Description" htmlFor="description" optional>
          <textarea
            id="description"
            className="input"
            rows={5}
            maxLength={MAX_LENGTH.text}
            placeholder="Ce qui se passe, depuis quand, ce que vous avez déjà essayé…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <fieldset className="field">
          <legend className="field__label">Catégorie</legend>
          <CategoryPicker value={category} onChange={setCategory} />
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Priorité</legend>
          <PriorityPicker value={priority} onChange={setPriority} />
        </fieldset>

        <FormError message={error} />
        <div className="form-actions">
          <Link to="/tickets" className="button">
            Annuler
          </Link>
          <button
            type="submit"
            className="button button--primary"
            disabled={createTicket.isPending}
          >
            {createTicket.isPending ? "Création…" : "Créer le ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
