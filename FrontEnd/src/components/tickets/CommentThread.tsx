import { useState, type FormEvent, type KeyboardEvent } from "react";

import { errorMessage } from "../../api/client";
import { useCommentMutations, useComments } from "../../api/queries";
import type { Comment } from "../../api/types";
import { useCurrentUser } from "../../auth/context";
import { useToast } from "../../context/toast";
import { formatDateTime, formatRelative } from "../../lib/format";
import { MAX_LENGTH } from "../../lib/labels";
import { Avatar } from "../ui/Avatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ErrorState, Loader } from "../ui/States";

/** Ctrl/⌘ + Entrée envoie le formulaire courant. */
function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

function CommentItem({
  comment,
  ticketId,
  onDelete,
}: {
  comment: Comment;
  ticketId: number;
  onDelete: (comment: Comment) => void;
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const { edit } = useCommentMutations(ticketId);
  const [draft, setDraft] = useState<string | null>(null);

  const isAuthor = comment.author.id === user.id;

  const save = (event: FormEvent) => {
    event.preventDefault();
    // Ctrl+Entrée passe par requestSubmit(), qui ignore le bouton désactivé.
    if (edit.isPending || !draft?.trim()) return;
    edit.mutate(
      { id: comment.id, body: draft.trim() },
      {
        onSuccess: () => setDraft(null),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <li className="comment">
      <Avatar name={comment.author.username} />
      <div className="comment__body">
        <div className="comment__header">
          <strong>{comment.author.username}</strong>
          <time dateTime={comment.created_at} title={formatDateTime(comment.created_at)}>
            {formatRelative(comment.created_at)}
          </time>
          {comment.updated_at && <span className="muted">(modifié)</span>}
        </div>

        {draft === null ? (
          <p className="comment__text">{comment.body}</p>
        ) : (
          <form onSubmit={save} className="comment__edit">
            <textarea
              className="input"
              aria-label="Modifier le commentaire"
              value={draft}
              rows={3}
              maxLength={MAX_LENGTH.text}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={submitOnModEnter}
            />
            <div className="form-actions form-actions--start">
              <button type="submit" className="button button--primary" disabled={edit.isPending}>
                Enregistrer
              </button>
              <button type="button" className="button" onClick={() => setDraft(null)}>
                Annuler
              </button>
            </div>
          </form>
        )}

        {draft === null && (isAuthor || user.is_admin) && (
          <div className="comment__actions">
            {isAuthor && (
              <button type="button" className="link-button" onClick={() => setDraft(comment.body)}>
                Modifier
              </button>
            )}
            <button type="button" className="link-button" onClick={() => onDelete(comment)}>
              Supprimer
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export function CommentThread({ ticketId }: { ticketId: number }) {
  const user = useCurrentUser();
  const toast = useToast();
  const comments = useComments(ticketId);
  const { add, remove } = useCommentMutations(ticketId);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<Comment | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Ctrl+Entrée passe par requestSubmit(), qui ignore le bouton désactivé.
    if (add.isPending || !draft.trim()) return;
    add.mutate(draft.trim(), {
      onSuccess: () => setDraft(""),
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => setToDelete(null),
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  return (
    <section className="card" aria-labelledby="comments-title">
      <h2 id="comments-title" className="card__title">
        Commentaires {comments.data && <span className="muted">({comments.data.length})</span>}
      </h2>

      {comments.isPending && <Loader />}
      {comments.isLoadingError && <ErrorState error={comments.error} onRetry={comments.refetch} />}
      {comments.data && comments.data.length === 0 && (
        <p className="muted">Aucun commentaire pour l'instant.</p>
      )}
      {comments.data && comments.data.length > 0 && (
        <ul className="comments">
          {comments.data.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              ticketId={ticketId}
              onDelete={setToDelete}
            />
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={submit}>
        <Avatar name={user.username} />
        <div className="comment-form__body">
          <textarea
            className="input"
            aria-label="Nouveau commentaire"
            placeholder="Ajouter un commentaire…"
            rows={3}
            maxLength={MAX_LENGTH.text}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={submitOnModEnter}
          />
          <div className="form-actions form-actions--start">
            <button
              type="submit"
              className="button button--primary"
              disabled={add.isPending || !draft.trim()}
            >
              Commenter
            </button>
            <span className="field__hint">Ctrl + Entrée pour envoyer</span>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer le commentaire ?"
        message="Cette action est définitive."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
