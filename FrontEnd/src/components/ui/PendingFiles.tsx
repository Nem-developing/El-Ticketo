import { FileText, X } from "lucide-react";

import { formatSize } from "../../lib/format";

/** Fichiers choisis, pas encore envoyés (ils partent avec le formulaire). */
export function PendingFiles({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (file: File) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="attachments" aria-label="Fichiers à joindre">
      {files.map((file, index) => (
        <li key={index} className="attachment">
          <span className="attachment__thumb" aria-hidden="true">
            <FileText size={20} />
          </span>
          <div className="attachment__info">
            <span>{file.name}</span>
            <span className="muted">{formatSize(file.size)}</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={`Retirer ${file.name}`}
            onClick={() => onRemove(file)}
          >
            <X size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}
