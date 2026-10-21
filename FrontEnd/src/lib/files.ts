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
      onFiles([...event.dataTransfer.files]);
    },
  };
}
