import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Fenêtre modale basée sur <dialog> : piège du focus, Échap et arrière-plan gérés par le
 * navigateur. Le focus initial va sur l'élément `data-autofocus`, sinon sur le premier champ.
 */
export function Modal({ title, open, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  // Un clic ne ferme la fenêtre que s'il a commencé ET fini sur l'arrière-plan
  // (sinon sélectionner du texte en relâchant hors de la fenêtre la fermerait).
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    openRef.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus], input, textarea, select")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label={title}
      // Fermeture native (Échap) : on prévient le parent, sauf si c'est lui qui a fermé.
      onClose={() => {
        if (openRef.current) onClose();
      }}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === dialogRef.current;
      }}
      onClick={(event) => {
        if (pressedOnBackdrop.current && event.target === dialogRef.current) onClose();
        pressedOnBackdrop.current = false;
      }}
    >
      {open && (
        <div className="modal__content">
          <header className="modal__header">
            <h2>{title}</h2>
            <button type="button" className="icon-button" aria-label="Fermer" onClick={onClose}>
              <X size={18} />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
