import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { errorMessage } from "../api/client";
import { useCreateTicket } from "../api/queries";
import type { TicketPriority } from "../api/types";
import { CategoryPicker, PriorityPicker } from "../components/tickets/Pickers";
import { Field, FormError } from "../components/ui/Field";
import { FilePicker } from "../components/ui/FilePicker";
import { PageHeader } from "../components/ui/PageHeader";
import { PendingFiles } from "../components/ui/PendingFiles";
import { useCurrentProject, useProjectContext } from "../context/project";
import { useToast } from "../context/toast";
import { celebrate } from "../lib/confetti";
import { dropFiles, MAX_FILE_SIZE } from "../lib/files";
import { MAX_LENGTH, PRIORITIES } from "../lib/labels";
import { usePastedFiles } from "../lib/usePastedFiles";
import { useDraft } from "../lib/useDraft";

interface TicketForm {
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
}

const EMPTY_FORM: TicketForm = { title: "", description: "", category: "", priority: "normal" };

/** Lien pré-rempli, par exemple depuis l'intranet : /tickets/new?title=…&category=…&priority=high */
function formFromUrl(params: URLSearchParams): TicketForm | null {
  if (!Object.keys(EMPTY_FORM).some((field) => params.has(field))) return null;
  const priority = params.get("priority") as TicketPriority;
  return {
    title: params.get("title") ?? "",
    description: params.get("description") ?? "",
    category: params.get("category") ?? "",
    priority: PRIORITIES.includes(priority) ? priority : "normal",
  };
}

export function NewTicketPage() {
  const [params] = useSearchParams();
  const currentProject = useCurrentProject();
  const { projects } = useProjectContext();
  const project = projects.find(({ id }) => id === Number(params.get("project"))) ?? currentProject;
  const navigate = useNavigate();
  const toast = useToast();
  const createTicket = useCreateTicket();

  const prefill = formFromUrl(params);
  const [form, setForm, clearForm] = useDraft("ticket", prefill ?? EMPTY_FORM, {
    restore: !prefill,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const change = (changes: Partial<TicketForm>) => setForm({ ...form, ...changes });

  const addFiles = (added: File[]) => {
    const tooLarge = added.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) setError(`« ${tooLarge.name} » dépasse 1 Go.`);
    setFiles((current) => [...current, ...added.filter((file) => file.size <= MAX_FILE_SIZE)]);
  };
  usePastedFiles(addFiles);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (createTicket.isPending) return;
    if (!form.title.trim()) {
      setError("Donnez un titre au ticket.");
      return;
    }
    if (!form.category) {
      setError("Choisissez une catégorie.");
      return;
    }
    setError(null);
    createTicket.mutate(
      { data: { project_id: project.id, ...form }, files },
      {
        onSuccess: ({ ticket, failedUploads }) => {
          clearForm();
          celebrate();
          toast.success(`Ticket #${ticket.id} créé.`);
          if (failedUploads) toast.error("Certaines pièces jointes n'ont pas pu être envoyées.");
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

      <form className="card form" onSubmit={submit} {...dropFiles(addFiles)}>
        <Field label="Titre" htmlFor="title">
          <input
            id="title"
            className="input"
            placeholder="Ex. L'imprimante du 2e étage ne répond plus"
            maxLength={MAX_LENGTH.title}
            required
            autoFocus
            value={form.title}
            onChange={(event) => change({ title: event.target.value })}
          />
        </Field>

        <Field label="Description" htmlFor="description" optional>
          <textarea
            id="description"
            className="input"
            rows={5}
            maxLength={MAX_LENGTH.text}
            placeholder="Ce qui se passe, depuis quand, ce que vous avez déjà essayé…"
            value={form.description}
            onChange={(event) => change({ description: event.target.value })}
          />
        </Field>

        <fieldset className="field">
          <legend className="field__label">Catégorie</legend>
          <CategoryPicker
            categories={project.categories}
            value={form.category}
            onChange={(category) => change({ category })}
          />
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Priorité</legend>
          <PriorityPicker value={form.priority} onChange={(priority) => change({ priority })} />
        </fieldset>

        <Field
          label="Pièces jointes"
          optional
          hint="Vous pouvez aussi glisser des fichiers ou coller une capture (Ctrl + V). 1 Go maximum."
        >
          <PendingFiles
            files={files}
            onRemove={(file) => setFiles(files.filter((other) => other !== file))}
          />
          <div>
            <FilePicker onFiles={addFiles} />
          </div>
        </Field>

        <FormError message={error} />
        <div className="form-actions">
          <Link to="/tickets" className="button" onClick={clearForm}>
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
