import { Download, FileText, X } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "../../api/client";
import { useAttachmentMutations, useAttachments } from "../../api/queries";
import type { Attachment } from "../../api/types";
import { useCurrentUser } from "../../auth/context";
import { useToast } from "../../context/toast";
import { IMAGE_TYPES } from "../../lib/files";
import { formatDateTime, formatRelative, formatSize } from "../../lib/format";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";

/** Pièces jointes du ticket lui-même (celles des commentaires sont affichées avec eux). */
export function Attachments({ ticketId }: { ticketId: number }) {
  const attachments = useAttachments(ticketId);
  return <AttachmentList ticketId={ticketId} attachments={attachments.data ?? []} />;
}

/** Aperçu des images, téléchargement de tous les fichiers. */
export function AttachmentList({
  ticketId,
  attachments,
}: {
  ticketId: number;
  attachments: Attachment[];
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const { remove } = useAttachmentMutations(ticketId);
  const [zoomed, setZoomed] = useState<Attachment | null>(null);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => setToDelete(null),
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  if (attachments.length === 0) return null;
  return (
    <>
      <ul className="attachments" aria-label="Pièces jointes">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="attachment">
            {IMAGE_TYPES.includes(attachment.content_type) ? (
              <button
                type="button"
                className="attachment__thumb"
                aria-label={`Agrandir ${attachment.filename}`}
                onClick={() => setZoomed(attachment)}
              >
                <img src={attachment.url} alt="" loading="lazy" />
              </button>
            ) : (
              <span className="attachment__thumb" aria-hidden="true">
                <FileText size={20} />
              </span>
            )}
            <div className="attachment__info">
              <a href={attachment.url} download={attachment.filename}>
                {attachment.filename}
              </a>
              <span className="muted" title={formatDateTime(attachment.created_at)}>
                {formatSize(attachment.size)} · {attachment.uploaded_by.username} ·{" "}
                {formatRelative(attachment.created_at)}
              </span>
            </div>
            {(attachment.uploaded_by.id === user.id || user.is_admin) && (
              <button
                type="button"
                className="icon-button"
                aria-label={`Supprimer ${attachment.filename}`}
                onClick={() => setToDelete(attachment)}
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Modal title={zoomed?.filename ?? ""} open={zoomed !== null} onClose={() => setZoomed(null)}>
        {zoomed && (
          <div className="image-viewer">
            <img src={zoomed.url} alt={zoomed.filename} />
            <div className="form-actions">
              <a className="button" href={zoomed.url} download={zoomed.filename}>
                <Download size={16} aria-hidden="true" />
                Télécharger
              </a>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer la pièce jointe ?"
        message={`« ${toDelete?.filename} » sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
