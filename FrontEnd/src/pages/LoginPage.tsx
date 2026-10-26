import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, type Location } from "react-router";

import { errorMessage } from "../api/client";
import { useSsoEnabled } from "../api/queries";
import { useAuth } from "../auth/context";
import { Field, FormError } from "../components/ui/Field";
import { Loader } from "../components/ui/States";

/** Chemin local seulement : un lien « //autre.site » ne doit pas faire sortir de l'application. */
const isLocalPath = (path: string | null): path is string =>
  path !== null && path.startsWith("/") && !path.startsWith("//");

export function LoginPage() {
  const { user, isLoading, login, loginWithToken } = useAuth();
  const ssoEnabled = useSsoEnabled();
  const navigate = useNavigate();
  const location = useLocation();
  // Retour du SSO : /login#token=…&next=… ou /login#error=…
  const [ssoResult] = useState(() => new URLSearchParams(location.hash.slice(1)));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(ssoResult.get("error"));
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: Location } | null)?.from;
  const next = ssoResult.get("next");
  const destination = isLocalPath(next) ? next : from ? `${from.pathname}${from.search}` : "/";

  useEffect(() => {
    if (!location.hash) return;
    // Le token ne doit pas rester dans l'adresse (historique, copier-coller).
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    const token = ssoResult.get("token");
    if (token) loginWithToken(token);
  }, [location, navigate, ssoResult, loginWithToken]);

  if (user) return <Navigate to={destination} replace />;
  if (isLoading) return <Loader fullscreen />;

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

        {ssoEnabled.data && (
          <>
            <a
              className="button button--primary button--block"
              href={`/api/auth/sso/login?${new URLSearchParams({ next: destination })}`}
            >
              Se connecter avec le SSO
            </a>
            <p className="login__separator">ou avec un identifiant</p>
          </>
        )}

        <Field label="Identifiant" htmlFor="username">
          <input
            id="username"
            className="input"
            autoComplete="username"
            autoFocus={!ssoEnabled.data}
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
        <button
          type="submit"
          className={`button button--block ${ssoEnabled.data ? "" : "button--primary"}`}
          disabled={pending}
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
