import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { useTickets, useUsers } from "../../api/queries";
import { useCurrentUser } from "../../auth/context";

type MentionTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

interface Suggestion {
  key: string;
  text: string;
  label: ReactNode;
}

// Mot en cours de saisie juste avant le curseur : « @al » ou « #impri ».
const TRIGGER = /(?:^|[^\p{L}\p{N}._@&#-])([@#])([\p{L}\p{N}._-]*)$/u;
const MAX_SUGGESTIONS = 6;

/** Zone de texte qui propose les personnes après « @ » et les tickets après « # ». */
export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  onBlur,
  ...props
}: MentionTextareaProps) {
  const me = useCurrentUser();
  const listId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Position du curseur ; null quand le champ n'a pas le focus (la liste se ferme).
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const match = caret === null ? null : TRIGGER.exec(value.slice(0, caret));
  const trigger = match && {
    char: match[1],
    query: match[2].toLowerCase(),
    start: caret! - match[2].length - 1,
  };
  const open = trigger !== null && dismissedAt !== trigger.start;

  const users = useUsers();
  const tickets = useTickets(
    { q: trigger?.query || undefined, limit: MAX_SUGGESTIONS },
    open && trigger.char === "#",
  );

  let suggestions: Suggestion[] = [];
  if (open && trigger.char === "@") {
    const startsWith = (username: string) => Number(username.startsWith(trigger.query));
    suggestions = (users.data ?? [])
      .filter(
        (user) => user.is_active && user.id !== me.id && user.username.includes(trigger.query),
      )
      .sort((a, b) => startsWith(b.username) - startsWith(a.username))
      .slice(0, MAX_SUGGESTIONS)
      .map((user) => ({
        key: `@${user.id}`,
        text: `@${user.username}`,
        label: `@${user.username}`,
      }));
  } else if (open) {
    suggestions = (tickets.data ?? []).map((ticket) => ({
      key: `#${ticket.id}`,
      text: `#${ticket.id}`,
      label: (
        <>
          <strong>#{ticket.id}</strong> {ticket.title}
        </>
      ),
    }));
  }
  const shown = suggestions.length > 0;
  const activeIndex = Math.min(active, suggestions.length - 1);

  const choose = (suggestion: Suggestion) => {
    if (!trigger || caret === null) return;
    const before = `${value.slice(0, trigger.start)}${suggestion.text} `;
    onChange(before + value.slice(caret).replace(/^ /, ""));
    setCaret(before.length);
    setActive(0);
    // Le champ contrôlé replace le curseur à la fin : on le remet après l'insertion.
    requestAnimationFrame(() =>
      textareaRef.current?.setSelectionRange(before.length, before.length),
    );
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (shown && !event.ctrlKey && !event.metaKey) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(suggestions[activeIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedAt(trigger!.start);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className="mention-textarea">
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        aria-autocomplete="list"
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={shown ? `${listId}-${activeIndex}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
          setActive(0);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onBlur={(event) => {
          setCaret(null);
          onBlur?.(event);
        }}
        onKeyDown={keyDown}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          className="mention-textarea__list"
          aria-label={trigger!.char === "@" ? "Personnes à mentionner" : "Tickets à citer"}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className="mention-textarea__option"
              // mousedown plutôt que click : le champ garde le focus.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
