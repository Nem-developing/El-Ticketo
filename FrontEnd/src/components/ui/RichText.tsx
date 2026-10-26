import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { useUsers } from "../../api/queries";
import { useCurrentUser } from "../../auth/context";

// Bloc ```langage … ``` (langage facultatif, sur la ligne d'ouverture) ou `code` en ligne.
const CODE_PATTERN = /\n?```(?:([\w+#.-]+)?[^\S\n]*\n)?([\s\S]*?)\n?```\n?|`([^`\n]+)`/g;
// Adresse http(s), sans la ponctuation qui la suit (« voir https://exemple.fr. »).
const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>"'.,;:!?)\]])/;
// « @alice » (ni une adresse e-mail ni le point qui finit la phrase, comme côté API) ou « #42 ».
const REFERENCE_PATTERN = /((?<![\w.@-])@[a-z0-9._-]*[a-z0-9_-]|(?<![\w&#/])#\d{1,9}\b)/i;

/** Bloc de code, coloré dès que le module de coloration (chargé à la demande) est prêt. */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [highlighted, setHighlighted] = useState<{ code: string; html: string | null }>();

  useEffect(() => {
    let current = true;
    void import("../../lib/highlight").then(({ highlight }) => {
      if (current) setHighlighted({ code, html: highlight(code, language) });
    });
    return () => {
      current = false;
    };
  }, [code, language]);

  const html = highlighted?.code === code ? highlighted.html : null;
  return (
    <pre className="code-block">
      {html === null ? <code>{code}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
    </pre>
  );
}

/**
 * Texte brut dont les blocs de code (```) et le `code` s'affichent tels quels, les adresses web
 * et les « #42 » deviennent des liens, et les « @identifiant » d'une personne existante sont mis
 * en évidence.
 */
export function RichText({ text }: { text: string }) {
  const me = useCurrentUser();
  const users = useUsers();
  const usernames = new Set(users.data?.map((user) => user.username));

  const reference = (token: string, key: string): ReactNode => {
    if (token.startsWith("#")) {
      return (
        <Link key={key} to={`/tickets/${token.slice(1)}`}>
          {token}
        </Link>
      );
    }
    const username = token.slice(1).toLowerCase();
    if (!usernames.has(username)) return token;
    return (
      <span key={key} className={`mention ${username === me.username ? "mention--me" : ""}`}>
        {token}
      </span>
    );
  };

  // Grâce aux groupes capturants, split() place les éléments trouvés aux indices impairs.
  const linkify = (segment: string, key: string): ReactNode[] =>
    segment.split(URL_PATTERN).flatMap((part, index) =>
      index % 2 === 1 ? (
        <a key={`${key}.${index}`} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      ) : (
        part
          .split(REFERENCE_PATTERN)
          .map((token, position) =>
            position % 2 === 1 ? reference(token, `${key}.${index}.${position}`) : token,
          )
      ),
    );

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE_PATTERN)) {
    const [whole, language = "", block, inline] = match;
    nodes.push(...linkify(text.slice(last, match.index), `t${match.index}`));
    nodes.push(
      inline === undefined ? (
        <CodeBlock key={`c${match.index}`} code={block} language={language.toLowerCase()} />
      ) : (
        <code key={`c${match.index}`}>{inline}</code>
      ),
    );
    last = match.index + whole.length;
  }
  nodes.push(...linkify(text.slice(last), "end"));
  return nodes;
}
