import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { errorMessage } from "../../api/client";
import { useProjects, useSaveProject } from "../../api/queries";
import type { Project } from "../../api/types";
import { Field, FormError } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, Loader } from "../../components/ui/States";
import { useToast } from "../../context/toast";
import { formatDate } from "../../lib/format";
import { MAX_LENGTH, OTHER_CATEGORY } from "../../lib/labels";

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const saveProject = useSaveProject();
  const toast = useToast();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [categories, setCategories] = useState(project?.categories.join("\n") ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const lines = categories
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // Nouveau projet sans catégorie saisie : l'API lui donne la liste par défaut.
    const data =
      project || lines.length ? { name, description, categories: lines } : { name, description };
    saveProject.mutate(
      { id: project?.id, data },
      {
        onSuccess: (saved) => {
          toast.success(project ? "Projet mis à jour." : `Projet « ${saved.name} » créé.`);
          onDone();
        },
      },
    );
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Nom" htmlFor="project-name">
        <input
          id="project-name"
          className="input"
          required
          maxLength={MAX_LENGTH.projectName}
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="project-description" optional>
        <textarea
          id="project-description"
          className="input"
          rows={3}
          maxLength={MAX_LENGTH.text}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Field
        label="Catégories"
        htmlFor="project-categories"
        hint={`Une par ligne, dans l'ordre d'affichage${project ? "" : " ; vide : la liste par défaut"}. « ${OTHER_CATEGORY}… » reste toujours proposé pour préciser librement.`}
      >
        <textarea
          id="project-categories"
          className="input"
          rows={6}
          value={categories}
          onChange={(event) => setCategories(event.target.value)}
        />
      </Field>
      <FormError message={saveProject.error ? errorMessage(saveProject.error) : null} />
      <div className="form-actions">
        <button type="button" className="button" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="button button--primary" disabled={saveProject.isPending}>
          {project ? "Enregistrer" : "Créer le projet"}
        </button>
      </div>
    </form>
  );
}

export function ProjectsPage() {
  const projects = useProjects();
  // undefined : modale fermée ; null : création ; Project : modification.
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const close = () => setEditing(undefined);

  return (
    <div className="page">
      <PageHeader
        title="Projets"
        subtitle="Chaque ticket appartient à un projet : un service, une équipe ou un client."
        actions={
          <button type="button" className="button button--primary" onClick={() => setEditing(null)}>
            <Plus size={18} aria-hidden="true" />
            Nouveau projet
          </button>
        }
      />

      {projects.isPending && <Loader />}
      {projects.isLoadingError && <ErrorState error={projects.error} onRetry={projects.refetch} />}
      {projects.data && (
        <div className="card card--flush">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col" className="hide-sm">
                    Description
                  </th>
                  <th scope="col" className="hide-md">
                    Catégories
                  </th>
                  <th scope="col" className="hide-sm">
                    Créé le
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.data.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <strong>{project.name}</strong>
                    </td>
                    <td className="hide-sm">
                      {project.description || <span className="muted">—</span>}
                    </td>
                    <td className="hide-md">
                      {project.categories.join(", ") || <span className="muted">—</span>}
                    </td>
                    <td className="hide-sm">{formatDate(project.created_at)}</td>
                    <td className="table__actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setEditing(project)}
                      >
                        Modifier
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
        title={editing ? `Modifier « ${editing.name} »` : "Nouveau projet"}
        open={editing !== undefined}
        onClose={close}
      >
        {editing !== undefined && (
          <ProjectForm key={editing?.id ?? "new"} project={editing ?? undefined} onDone={close} />
        )}
      </Modal>
    </div>
  );
}
