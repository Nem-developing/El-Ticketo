import { useEffect, useRef } from "react";

import { pastedFiles } from "./files";

/**
 * Reçoit les fichiers collés dans la page (une capture d'écran, par exemple), sauf ceux déjà
 * pris en charge par un champ (le commentaire en cours).
 */
export function usePastedFiles(onFiles: (files: File[]) => void) {
  const callbackRef = useRef(onFiles);
  useEffect(() => {
    callbackRef.current = onFiles;
  });

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const files = pastedFiles(event);
      if (files.length === 0) return;
      event.preventDefault();
      callbackRef.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}
