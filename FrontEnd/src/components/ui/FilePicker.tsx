import { Paperclip } from "lucide-react";
import { useRef } from "react";

interface FilePickerProps {
  onFiles: (files: File[]) => void;
  pending?: boolean;
}

/** Bouton « Joindre un fichier » (plusieurs fichiers possibles). */
export function FilePicker({ onFiles, pending = false }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="link-button"
        title="Vous pouvez aussi glisser un fichier ou coller une capture (Ctrl + V)"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip size={14} aria-hidden="true" />
        {pending ? "Envoi…" : "Joindre un fichier"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </>
  );
}
