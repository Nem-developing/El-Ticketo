import { Copy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

import { errorMessage } from "../../api/client";
import { useSsoConfig, useSsoMutations } from "../../api/queries";
import type { SsoConfig } from "../../api/types";
import { Field, FormError } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, Loader } from "../../components/ui/States";
import { useToast } from "../../context/toast";

function SsoForm({ config }: { config: SsoConfig }) {
  const { save, test } = useSsoMutations();
  const toast = useToast();
  const [enabled, setEnabled] = useState(config.enabled);
  const [issuer, setIssuer] = useState(config.issuer);
  const [clientId, setClientId] = useState(config.client_id);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Le test porte sur la configuration enregistrée.
  const dirty =
    enabled !== config.enabled ||
    issuer.trim() !== config.issuer ||
    clientId.trim() !== config.client_id ||
    secret !== "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    save.mutate(
      { enabled, issuer, client_id: clientId, client_secret: secret === "" ? null : secret },
      {
        onSuccess: (saved) => {
          toast.success("Configuration enregistrée.");
          setIssuer(saved.issuer);
          setClientId(saved.client_id);
          setSecret("");
        },
        onError: (saveError) => setError(errorMessage(saveError)),
      },
    );
  };

  const startTest = () =>
    test.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (testError) => toast.error(errorMessage(testError)),
    });

  // Le presse-papiers n'existe qu'en HTTPS (ou sur localhost).
  const copyRedirectUri = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(config.redirect_uri))
      .then(() => toast.success("Adresse copiée."))
      .catch(() => toast.error("Copie impossible : sélectionnez l'adresse."));

  return (
    <form className="card form" onSubmit={submit}>
      <Field
        label="Adresse de retour"
        htmlFor="sso-redirect"
        hint="À déclarer chez le fournisseur d'identité (« redirect URI »). Si elle commence par http:// derrière un proxy TLS, renseignez PUBLIC_URL."
      >
        <div className="copy-field">
          <input
            id="sso-redirect"
            className="input"
            readOnly
            value={config.redirect_uri}
            onFocus={(event) => event.target.select()}
          />
          <button type="button" className="button" onClick={copyRedirectUri}>
            <Copy size={16} aria-hidden="true" />
            Copier
          </button>
        </div>
      </Field>
      <Field
        label="Émetteur (issuer)"
        htmlFor="sso-issuer"
        hint="Ex. https://login.microsoftonline.com/<id-du-tenant>/v2.0 ou https://auth.exemple.fr/realms/<royaume>"
      >
        <input
          id="sso-issuer"
          type="url"
          className="input"
          maxLength={500}
          pattern="https?://.+"
          placeholder="https://"
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
        />
      </Field>
      <Field label="Identifiant du client (client ID)" htmlFor="sso-client-id">
        <input
          id="sso-client-id"
          className="input"
          maxLength={255}
          autoComplete="off"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        />
      </Field>
      <Field
        label="Secret du client"
        htmlFor="sso-secret"
        hint={
          config.has_secret
            ? "Un secret est enregistré : laissez vide pour le garder."
            : "Laissez vide pour un client public."
        }
      >
        <input
          id="sso-secret"
          type="password"
          className="input"
          maxLength={500}
          autoComplete="new-password"
          placeholder={config.has_secret ? "••••••••" : undefined}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Proposer « Se connecter avec le SSO » sur la page de connexion
      </label>

      <FormError message={error} />
      <div className="form-actions">
        <span className="field__hint form-actions__hint">
          {dirty ? "Enregistrez avant de tester." : "Le test n'ouvre aucune session."}
        </span>
        <button
          type="button"
          className="button"
          disabled={dirty || !config.issuer || test.isPending}
          onClick={startTest}
        >
          Tester la connexion
        </button>
        <button type="submit" className="button button--primary" disabled={save.isPending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}

/** Configuration du SSO (OpenID Connect), et son test avant de le proposer à tous. */
export function SsoPage() {
  const config = useSsoConfig();
  const location = useLocation();
  const navigate = useNavigate();
  // Retour d'un test : /admin/sso#test=ok&message=…
  const [result] = useState(() => new URLSearchParams(location.hash.slice(1)));

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location, navigate]);

  const message = result.get("message");
  return (
    <div className="page page--narrow">
      <PageHeader
        title="Connexion unique (SSO)"
        subtitle="OpenID Connect : Microsoft Entra ID, Google Workspace, Keycloak, Authentik, Okta…"
      />

      {message && (
        <p role="status" className={result.get("test") === "ok" ? "form-success" : "form-error"}>
          {result.get("test") === "ok" ? "Test réussi : " : "Test échoué : "}
          {message}
        </p>
      )}

      {config.isPending && <Loader />}
      {config.isLoadingError && <ErrorState error={config.error} onRetry={config.refetch} />}
      {config.data && <SsoForm config={config.data} />}

      <section className="card" aria-labelledby="sso-accounts">
        <h2 id="sso-accounts" className="card__title">
          Comptes
        </h2>
        <ul className="help-list">
          <li>
            À sa première connexion, une personne retrouve le compte qui porte son identifiant (la
            partie avant le @ de son adresse) : ce compte passe au SSO et son mot de passe ne sert
            plus.
          </li>
          <li>Sinon, un compte membre est créé ; promouvez-le administrateur au besoin.</li>
          <li>
            Le compte administrateur initial n'est jamais rattaché : il reste un accès de secours
            par mot de passe.
          </li>
          <li>Qui peut se connecter se règle chez le fournisseur (utilisateurs affectés).</li>
        </ul>
      </section>
    </div>
  );
}
