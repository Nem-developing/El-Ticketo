import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { useChangePassword } from "../api/queries";
import { useCurrentUser } from "../auth/context";
import { Field, FormError } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { useTheme, type ThemePreference } from "../context/theme";
import { useToast } from "../context/toast";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Système" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

function PasswordForm() {
  const changePassword = useChangePassword();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (next !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setError(null);
    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          toast.success("Mot de passe modifié. Vos autres sessions ont été fermées.");
          setCurrent("");
          setNext("");
          setConfirmation("");
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
      },
    );
  };

  return (
    <form className="card form" onSubmit={submit} aria-labelledby="password-title">
      <h2 id="password-title" className="card__title">
        Changer de mot de passe
      </h2>
      <Field label="Mot de passe actuel" htmlFor="current-password">
        <input
          id="current-password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="new-password" hint="8 caractères minimum.">
        <input
          id="new-password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </Field>
      <Field label="Confirmation" htmlFor="confirm-password">
        <input
          id="confirm-password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </Field>
      <FormError message={error} />
      <div className="form-actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={changePassword.isPending}
        >
          Mettre à jour
        </button>
      </div>
    </form>
  );
}

export function AccountPage() {
  const user = useCurrentUser();
  const { preference, setPreference } = useTheme();

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Mon compte"
        subtitle={`${user.username} · ${user.is_admin ? "Administrateur" : "Membre"}`}
      />

      <section className="card form" aria-labelledby="theme-title">
        <h2 id="theme-title" className="card__title">
          Apparence
        </h2>
        <div className="segmented" role="radiogroup" aria-label="Thème">
          {THEMES.map((theme) => (
            <label key={theme.value} className="segmented__option">
              <input
                type="radio"
                name="theme"
                checked={preference === theme.value}
                onChange={() => setPreference(theme.value)}
              />
              <span>{theme.label}</span>
            </label>
          ))}
        </div>
      </section>

      <PasswordForm />
    </div>
  );
}
