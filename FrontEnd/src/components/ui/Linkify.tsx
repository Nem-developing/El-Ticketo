// Adresse http(s), sans la ponctuation qui la suit (« voir https://exemple.fr. »).
const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>"'.,;:!?)\]])/;

/** Texte brut dont les adresses web deviennent des liens. */
export function Linkify({ text }: { text: string }) {
  // Grâce au groupe capturant, split() place les adresses aux indices impairs.
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
