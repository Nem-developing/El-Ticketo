import { useEffect, useRef } from "react";

/** Reçoit les fichiers collés dans la page (une capture d'écran, par exemple). */
export function usePastedFiles(onFiles: (files: File[]) => void) {
  const callbackRef = useRef(onFiles);
  useEffect(() => {
    callbackRef.current = onFiles;
  });

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])];
      // Dans un champ, un texte reste un texte : Excel ou Word y joignent aussi une image.
      const inField = event.target instanceof Element && event.target.closest("input, textarea");
      const hasText = event.clipboardData?.types.includes("text/plain");
      if (files.length === 0 || (inField && hasText)) return;
      event.preventDefault();
      callbackRef.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}
