import { useEffect, useRef, useState } from "react";

export function DeleteConfirmation({ title, description, onCancel, onConfirm }: {
  title: string; description: string; onCancel: () => void; onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    cancel.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  async function confirm() {
    if (busy) return;
    setBusy(true); setError("");
    try { await onConfirm(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Kunde inte ta bort. Kontrollera anslutningen och försök igen."); setBusy(false); }
  }
  return <dialog ref={dialog} className="modal" aria-labelledby="delete-title" aria-describedby="delete-description"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="delete-title">{title}</h2>
    <p id="delete-description" className="muted">{description}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions">
      <button ref={cancel} className="secondary" disabled={busy} onClick={onCancel}>Avbryt</button>
      <button className="danger" disabled={busy} onClick={() => void confirm()}>{busy ? "Tar bort…" : "Ta bort"}</button>
    </div>
  </dialog>;
}
