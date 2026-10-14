"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "./Button";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Native <dialog>: focus trap, Esc to close, focus returns to the trigger. */
export function ConfirmDialog({ open, title, children, confirmLabel, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[min(92vw,480px)] rounded-md border border-line-strong bg-surface p-0 text-fg shadow-popover backdrop:bg-bg/80"
    >
      <div className="border-b border-line px-5 py-4">
        <h2 id="confirm-title" className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm text-fg-2">{children}</div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm} disabled={pending} autoFocus>
          {pending ? "Recording…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
