"use client";
import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      className="confirm-dialog"
      ref={ref}
      onCancel={onClose}
      aria-labelledby="confirm-title"
    >
      <span className="status-icon">
        <RotateCcw size={23} />
      </span>
      <h2 id="confirm-title">Start a new queue session?</h2>
      <p>
        Active tokens will be cancelled. All previous tokens and their history
        stay saved. The next token will be Q-001.
      </p>
      <div className="dialog-actions">
        <button className="button button-white" onClick={onClose} autoFocus>
          Keep current queue
        </button>
        <button
          className="button button-primary"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          Start new queue
        </button>
      </div>
    </dialog>
  );
}
