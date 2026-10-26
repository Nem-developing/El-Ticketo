import { useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import { errorMessage } from "../../api/client";
import { useCommentMutations, useComments, useTicketEvents } from "../../api/queries";
import type { Comment, TicketEvent } from "../../api/types";
import { useCurrentUser } from "../../auth/context";
import { useToast } from "../../context/toast";
import { dropFiles, MAX_FILE_SIZE, pastedFiles } from "../../lib/files";
import { formatDateTime, formatRelative } from "../../lib/format";
import { describeEvent, MAX_LENGTH } from "../../lib/labels";
import { useDraft } from "../../lib/useDraft";
import { Avatar } from "../ui/Avatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FilePicker } from "../ui/FilePicker";
import { MentionTextarea } from "../ui/MentionTextarea";
import { RichText } from "../ui/RichText";
import { PendingFiles } from "../ui/PendingFiles";
import { ErrorState, Loader } from "../ui/States";
import { AttachmentList } from "./Attachments";

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
          comment.body && (
            <p className="prose">
              <RichText text={comment.body} />
            </p>
          )
        ) : (
          <form onSubmit={save} className="comment__edit">
            <MentionTextarea
              className="input"
              aria-label="Modifier le commentaire"
              value={draft}
              rows={3}
              maxLength={MAX_LENGTH.text}
              autoFocus
              onChange={setDraft}
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

        <AttachmentList ticketId={ticketId} attachments={comment.attachments} />

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

function EventItem({ event }: { event: TicketEvent }) {
  return (
    <li className="event">
      <span>
        <strong>{event.actor.username}</strong> {describeEvent(event)}
      </span>
      <time dateTime={event.created_at} title={formatDateTime(event.created_at)}>
        {formatRelative(event.created_at)}
      </time>
    </li>
  );
}

const timestamp = (item: { created_at: string }) => new Date(item.created_at).getTime();

/** Commentaires et historique des modifications, dans l'ordre chronologique. */
export function CommentThread({ ticketId }: { ticketId: number }) {
  const user = useCurrentUser();
  const toast = useToast();
  const comments = useComments(ticketId);
  const events = useTicketEvents(ticketId);
  const { add, remove } = useCommentMutations(ticketId);
  const [draft, setDraft, clearDraft] = useDraft(`comment.${ticketId}`, "");
  const [files, setFiles] = useState<File[]>([]);
  const [toDelete, setToDelete] = useState<Comment | null>(null);

  const timeline = [
    ...(comments.data ?? []).map((comment) => ({
      comment,
      event: undefined,
      at: timestamp(comment),
    })),
    ...(events.data ?? []).map((event) => ({ comment: undefined, event, at: timestamp(event) })),
  ].sort((a, b) => a.at - b.at);

  // Fichiers collés, glissés ou choisis ici : ils sont joints au commentaire, pas au ticket.
  const addFiles = (added: File[]) => {
    const tooLarge = added.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) toast.error(`« ${tooLarge.name} » dépasse 1 Go.`);
    setFiles((current) => [...current, ...added.filter((file) => file.size <= MAX_FILE_SIZE)]);
  };

  const pasteFiles = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = pastedFiles(event);
    if (pasted.length === 0) return;
    event.preventDefault();
    addFiles(pasted);
  };

  const canSubmit = draft.trim() !== "" || files.length > 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Ctrl+Entrée passe par requestSubmit(), qui ignore le bouton désactivé.
    if (add.isPending || !canSubmit) return;
    add.mutate(
      { body: draft.trim(), files },
      {
        onSuccess: ({ failedUploads }) => {
          clearDraft();
          setFiles([]);
          if (failedUploads) toast.error("Certains fichiers n'ont pas pu être envoyés.");
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
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
      {comments.data && timeline.length === 0 && (
        <p className="muted">Aucun commentaire pour l'instant.</p>
      )}
      {comments.data && timeline.length > 0 && (
        <ul className="comments">
          {timeline.map(({ comment, event }) =>
            comment ? (
              <CommentItem
                key={`comment-${comment.id}`}
                comment={comment}
                ticketId={ticketId}
                onDelete={setToDelete}
              />
            ) : (
              <EventItem key={`event-${event.id}`} event={event} />
            ),
          )}
        </ul>
      )}

      <form className="comment-form" onSubmit={submit} {...dropFiles(addFiles)}>
        <Avatar name={user.username} />
        <div className="comment-form__body">
          <MentionTextarea
            className="input"
            aria-label="Nouveau commentaire"
            placeholder="Ajouter un commentaire…"
            rows={3}
            maxLength={MAX_LENGTH.text}
            value={draft}
            onChange={setDraft}
            onKeyDown={submitOnModEnter}
            onPaste={pasteFiles}
          />
          <PendingFiles
            files={files}
            onRemove={(file) => setFiles(files.filter((other) => other !== file))}
          />
          <div className="form-actions form-actions--start">
            <button
              type="submit"
              className="button button--primary"
              disabled={add.isPending || !canSubmit}
            >
              {add.isPending ? "Envoi…" : "Commenter"}
            </button>
            <FilePicker onFiles={addFiles} />
            <span className="field__hint">
              @ pour mentionner, # pour citer un ticket, Ctrl + Entrée pour envoyer
            </span>
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
