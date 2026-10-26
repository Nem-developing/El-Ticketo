import type { ReactNode } from "react";
import { Link } from "react-router";

import { useUsers } from "../../api/queries";
import { useCurrentUser } from "../../auth/context";

// Adresse http(s), sans la ponctuation qui la suit (« voir https://exemple.fr. »).
const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>"'.,;:!?)\]])/;
// « @alice » (ni une adresse e-mail ni le point qui finit la phrase, comme côté API) ou « #42 ».
const REFERENCE_PATTERN = /((?<![\w.@-])@[a-z0-9._-]*[a-z0-9_-]|(?<![\w&#/])#\d{1,9}\b)/i;

/**
 * Texte brut dont les adresses web et les « #42 » deviennent des liens, et dont les
 * « @identifiant » d'une personne existante sont mis en évidence.
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
  return text.split(URL_PATTERN).flatMap((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
        .split(REFERENCE_PATTERN)
        .map((token, position) =>
          position % 2 === 1 ? reference(token, `${index}.${position}`) : token,
        )
    ),
  );
}
