import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, type Location } from "react-router";

import { errorMessage } from "../api/client";
import { useAuth } from "../auth/context";
import { Field, FormError } from "../components/ui/Field";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: Location } | null)?.from;
  const destination = from ? `${from.pathname}${from.search}` : "/";

  if (user) return <Navigate to={destination} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(username, password);
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(errorMessage(loginError));
      setPending(false);
    }
  };

  return (
    <div className="login">
      <form className="login__card card" onSubmit={submit}>
        <div className="login__brand">
          <img src="/favicon.svg" alt="" width={40} height={40} />
          <h1>El Ticketo</h1>
          <p className="muted">Connectez-vous pour accéder à vos tickets.</p>
        </div>

        <Field label="Identifiant" htmlFor="username">
          <input
            id="username"
            className="input"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <FormError message={error} />
        <button type="submit" className="button button--primary button--block" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
