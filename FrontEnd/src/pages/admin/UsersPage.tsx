import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { errorMessage } from "../../api/client";
import { useCreateUser, useUpdateUser, useUsers } from "../../api/queries";
import type { User, UserUpdate } from "../../api/types";
import { useCurrentUser } from "../../auth/context";
import { Field, FormError } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, Loader } from "../../components/ui/States";
import { useToast } from "../../context/toast";
import { formatDate } from "../../lib/format";

const MIN_PASSWORD_LENGTH = 8;

function NewUserForm({ onDone }: { onDone: () => void }) {
  const createUser = useCreateUser();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createUser.mutate(
      { username, password, is_admin: isAdmin },
      {
        onSuccess: (user) => {
          toast.success(`Compte « ${user.username} » créé.`);
          onDone();
        },
      },
    );
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Identifiant" htmlFor="new-username" hint="Lettres, chiffres, points ou tirets.">
        <input
          id="new-username"
          className="input"
          autoComplete="off"
          required
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9._\-]+"
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </Field>
      <Field
        label="Mot de passe"
        htmlFor="new-password"
        hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
      >
        <input
          id="new-password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(event) => setIsAdmin(event.target.checked)}
        />
        Administrateur (gère les comptes et les projets)
      </label>
      <FormError message={createUser.error ? errorMessage(createUser.error) : null} />
      <div className="form-actions">
        <button type="button" className="button" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="button button--primary" disabled={createUser.isPending}>
          Créer le compte
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const updateUser = useUpdateUser();
  const toast = useToast();
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    updateUser.mutate(
      { id: user.id, changes: { password } },
      {
        onSuccess: () => {
          toast.success(`Mot de passe de « ${user.username} » réinitialisé.`);
          onDone();
        },
      },
    );
  };

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted">Ses sessions en cours seront fermées.</p>
      <Field
        label="Nouveau mot de passe"
        htmlFor="reset-password"
        hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
      >
        <input
          id="reset-password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <FormError message={updateUser.error ? errorMessage(updateUser.error) : null} />
      <div className="form-actions">
        <button type="button" className="button" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="button button--primary" disabled={updateUser.isPending}>
          Réinitialiser
        </button>
      </div>
    </form>
  );
}

export function UsersPage() {
  const me = useCurrentUser();
  const users = useUsers();
  const updateUser = useUpdateUser();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  const update = (user: User, changes: UserUpdate, success: string) =>
    updateUser.mutate(
      { id: user.id, changes },
      {
        onSuccess: () => toast.success(success),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <div className="page">
      <PageHeader
        title="Utilisateurs"
        subtitle="Les membres gèrent les tickets ; les administrateurs gèrent aussi les comptes et les projets."
        actions={
          <button
            type="button"
            className="button button--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Nouvel utilisateur
          </button>
        }
      />

      {users.isPending && <Loader />}
      {users.isLoadingError && <ErrorState error={users.error} onRetry={users.refetch} />}
      {users.data && (
        <div className="card card--flush">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Identifiant</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">État</th>
                  <th scope="col" className="hide-sm">
                    Créé le
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => {
                  const isMe = user.id === me.id;
                  return (
                    <tr key={user.id} className={user.is_active ? undefined : "is-disabled"}>
                      <td>
                        <strong>{user.username}</strong>
                        {isMe && <span className="muted"> (vous)</span>}
                      </td>
                      <td>{user.is_admin ? "Administrateur" : "Membre"}</td>
                      <td>
                        <span
                          className={`badge ${user.is_active ? "badge--active" : "badge--inactive"}`}
                        >
                          {user.is_active ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="hide-sm">{formatDate(user.created_at)}</td>
                      <td className="table__actions">
                        {!isMe && (
                          <>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => setResetting(user)}
                            >
                              Mot de passe
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              disabled={updateUser.isPending}
                              onClick={() =>
                                update(
                                  user,
                                  { is_admin: !user.is_admin },
                                  `« ${user.username} » est désormais ${user.is_admin ? "membre" : "administrateur"}.`,
                                )
                              }
                            >
                              {user.is_admin ? "Retirer admin" : "Passer admin"}
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              disabled={updateUser.isPending}
                              onClick={() =>
                                update(
                                  user,
                                  { is_active: !user.is_active },
                                  `Compte « ${user.username} » ${user.is_active ? "désactivé" : "réactivé"}.`,
                                )
                              }
                            >
                              {user.is_active ? "Désactiver" : "Réactiver"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal title="Nouvel utilisateur" open={creating} onClose={() => setCreating(false)}>
        <NewUserForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal
        title={`Mot de passe de « ${resetting?.username ?? ""} »`}
        open={resetting !== null}
        onClose={() => setResetting(null)}
      >
        {resetting && <ResetPasswordForm user={resetting} onDone={() => setResetting(null)} />}
      </Modal>
    </div>
  );
}
