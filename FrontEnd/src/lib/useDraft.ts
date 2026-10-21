import { useState } from "react";

import { readStorage, removeStorage, writeStorage } from "./storage";

/**
 * État enregistré dans le navigateur à chaque modification : une saisie survit à un
 * rechargement. `restore: false` ignore le brouillon existant (formulaire pré-rempli par l'URL).
 */
export function useDraft<T>(name: string, initial: T, { restore = true } = {}) {
  const key = `elticketo.draft.${name}`;
  const [value, setValue] = useState<T>(() => {
    const saved = restore ? readStorage(key) : null;
    try {
      return saved === null ? initial : (JSON.parse(saved) as T);
    } catch {
      return initial;
    }
  });

  const update = (next: T) => {
    setValue(next);
    writeStorage(key, JSON.stringify(next));
  };
  const clear = () => {
    setValue(initial);
    removeStorage(key);
  };
  return [value, update, clear] as const;
}
