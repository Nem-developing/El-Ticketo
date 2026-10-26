import type { DragEvent } from "react";

/** Limite de l'API pour une pièce jointe : 1 Go. */
export const MAX_FILE_SIZE = 1024 ** 3;

/** Images affichées en aperçu ; les autres fichiers sont seulement téléchargeables. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Propose le fichier au téléchargement. */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

/**
 * Fichiers collés à joindre (une capture d'écran, par exemple). Dans un champ, un texte reste
 * un texte : Excel ou Word joignent aussi une image au texte copié.
 */
export function pastedFiles(event: {
  clipboardData: DataTransfer | null;
  target: EventTarget | null;
}): File[] {
  const inField = event.target instanceof Element && event.target.closest("input, textarea");
  if (inField && event.clipboardData?.types.includes("text/plain")) return [];
  return [...(event.clipboardData?.files ?? [])];
}

/** Gestionnaires à poser sur une zone qui accepte des fichiers glissés-déposés. */
export function dropFiles(onFiles: (files: File[]) => void) {
  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");
  return {
    onDragOver: (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      // Une zone imbriquée (le commentaire en cours) garde les fichiers pour elle.
      event.stopPropagation();
      onFiles([...event.dataTransfer.files]);
    },
  };
}
