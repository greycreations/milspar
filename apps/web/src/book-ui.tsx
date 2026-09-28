import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export const API = import.meta.env.VITE_API_URL ?? "/api/v1";
// getRandomValues also works on a private HTTP/LAN installation (randomUUID may not).
export function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128;
  const value = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, { method, ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? (response.status === 404 ? "Posten finns inte. Ladda om sidan." : (method === "DELETE" ? "Kunde inte ta bort. Kontrollera anslutningen och försök igen." : "Kunde inte spara. Kontrollera anslutningen och försök igen.")));
  }
  return response.status === 204 ? undefined as T : response.json();
}
export const formatKm = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("sv-SE").format(value);
export const formatDate = (value: string) => new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export const localTime = (value: string = new Date().toISOString()) => {
  const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const eventNames: Record<string, string> = { odometer: "Mätarställning", note: "Anteckning", service: "Service", repair: "Reparation", workshop: "Verkstadsbesök", wheel_change: "Hjulbyte" };
export const seasonNames: Record<string, string> = { summer: "Sommar", winter: "Vinter", all_season: "Året runt" };
export const statusNames = { overdue: "Förfallen", soon: "Snart", upcoming: "Kommande", done: "Genomförd" };
export const money = (minor: number, currency = "SEK") => new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(minor / 100);

export type Field = { name: string; label: string; type?: "text" | "number" | "date" | "datetime-local" | "textarea" | "select" | "checkbox" | "money"; required?: boolean; min?: number; max?: number; step?: string; options?: { value: string; label: string }[]; help?: string; nullEmpty?: boolean };
export function Editor({ title, context, fields, initial = {}, onClose, onSave }: { title: string; context: string; fields: Field[]; initial?: Record<string, unknown>; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const old = document.activeElement;
    dialog.current?.showModal(); dialog.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => { if (old instanceof HTMLElement && old.isConnected) old.focus(); };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const data = new FormData(e.currentTarget), result: Record<string, unknown> = {};
    try {
      for (const field of fields) {
        const value = String(data.get(field.name) ?? "").trim();
        if (field.type === "checkbox") result[field.name] = data.has(field.name);
        else if (field.type === "number") result[field.name] = value ? Number(value) : null;
        else if (field.type === "money") {
          if (value && !/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Kostnaden ska anges med högst två decimaler.");
          const [whole = "0", fraction = ""] = value.replace(",", ".").split(".");
          result[field.name] = value ? Number(whole) * 100 + Number(fraction.padEnd(2, "0")) : null;
        } else if (field.type === "datetime-local") result[field.name] = new Date(value).toISOString();
        else result[field.name] = value === "" && (field.nullEmpty || field.type === "date") ? null : value;
      }
      setBusy(true); setError(""); await onSave(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kunde inte spara."); setBusy(false); }
  }
  return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    onKeyDown={e => { if (e.key !== "Tab") return; const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')]; const first = controls[0], last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }}>
    <div className="modal-head"><div><h2 id={titleId}>{title}</h2><p className="muted">{context}</p></div><button className="icon-button" aria-label="Stäng" disabled={busy} onClick={onClose}>×</button></div>
    <form onSubmit={e => void submit(e)}><fieldset disabled={busy} className="editor-fields">
      {fields.map(field => <label key={field.name} className={field.type === "checkbox" ? "check-field" : ""}>{field.label}
        {field.type === "textarea" ? <textarea name={field.name} defaultValue={String(initial[field.name] ?? "")} required={field.required} maxLength={4000}/>
          : field.type === "select" ? <select name={field.name} defaultValue={String(initial[field.name] ?? "")} required={field.required}>{field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          : field.type === "checkbox" ? <input name={field.name} type="checkbox" defaultChecked={Boolean(initial[field.name])}/>
          : <input name={field.name} type={field.type === "money" ? "text" : field.type ?? "text"} inputMode={field.type === "money" ? "decimal" : undefined} defaultValue={initial[field.name] == null ? "" : String(initial[field.name])} required={field.required} min={field.min ?? (field.type === "number" ? 0 : undefined)} max={field.max} step={field.step ?? (field.type === "number" ? "1" : undefined)} maxLength={field.type === "money" ? 14 : 160}/>}
        {field.help && <small className="muted">{field.help}</small>}
      </label>)}
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Avbryt</button><button disabled={busy}>{busy ? "Sparar…" : "Spara"}</button></div></form>
  </dialog>;
}
