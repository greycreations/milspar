import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CarFront, Gauge, Plus, Pencil, Trash2 } from "lucide-react";
import { vehicleDetailSchema, vehicleIdSchema, type VehicleDetail, type ServiceBook, type BookEvent, type WheelSet, type TireBatch, type MaintenanceRule, type Asset } from "@milspar/contracts";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { api, API, Editor, type Field, formatKm, formatDate, localTime, money, eventNames, seasonNames, statusNames } from "./book-ui";

type EditorState = { title: string; fields: Field[]; initial: Record<string, unknown>; save: (data: Record<string, unknown>) => Promise<unknown> };
const text = (name: string, label: string, required = false): Field => ({ name, label, required });
const numeric = (name: string, label: string): Field => ({ name, label, type: "number", max: 2147483647 });
const textarea = (name: string, label: string): Field => ({ name, label, type: "textarea" });
const amount: Field = { name: "costMinor", label: "Kostnad", type: "money", help: "Ange belopp, exempelvis 1250,50. Lämna tomt om okänt." };
const emptyBook: ServiceBook = { events: [], wheelSets: [], tireBatches: [], fitments: [], maintenance: [], assets: [], totals: [] };

export function VehiclePage({ id, section, onChanged }: { id: string; section: string; onChanged: () => Promise<void> }) {
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null), [book, setBook] = useState<ServiceBook>(emptyBook);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deletion, setDeletion] = useState<{ title: string; description: string; run: () => Promise<unknown>; vehicle?: boolean } | null>(null);
  const [filter, setFilter] = useState("all"), [uploading, setUploading] = useState(false), [uploadEventId, setUploadEventId] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const path = `/vehicles/${id}`;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    async function load() {
      try {
        if (!vehicleIdSchema.safeParse(id).success) throw new Error("Fordonslänken är ogiltig.");
        const responses = await Promise.all([fetch(`${API}${path}`, { signal: controller.signal }), fetch(`${API}${path}/book`, { signal: controller.signal })]);
        if (responses.some(r => r.status === 404)) throw new Error("Fordonet finns inte. Det kan ha tagits bort eller länken kan vara felaktig.");
        if (responses.some(r => !r.ok)) throw new Error("Kunde inte hämta fordonet. Kontrollera anslutningen och försök igen.");
        const detail = vehicleDetailSchema.parse(await responses[0]!.json()), history: ServiceBook = await responses[1]!.json();
        if (!controller.signal.aborted) { setVehicle(detail); setBook(history); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error && !("issues" in cause) ? cause.message : "Kunde inte läsa fordonsuppgifterna. Försök igen."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (vehicle) { document.title = `${vehicle.registrationNumber} · Milspår`; heading.current?.focus(); }
    return () => { document.title = "Milspår"; };
  }, [vehicle?.id, section]);
  async function refreshed(message: string) { setNotice(message); setAttempt(n => n + 1); await onChanged(); }
  async function action(run: () => Promise<unknown>, message: string) {
    try { await run(); await refreshed(message); } catch (cause) { setNotice(""); setError(cause instanceof Error ? cause.message : "Åtgärden misslyckades."); }
  }
  const context = vehicle ? `${vehicle.registrationNumber} · ${vehicle.make} ${vehicle.model}` : "";
  function editVehicle() {
    if (!vehicle) return;
    const fields: Field[] = [text("registrationNumber", "Registreringsnummer", true), text("make", "Märke", true), text("model", "Modell", true), { ...text("variant", "Variant"), nullEmpty: true }, { ...numeric("modelYear", "Årsmodell"), min: 1886, max: 2200 }, { ...text("vin", "VIN / chassinummer"), nullEmpty: true }, { ...text("color", "Färg"), nullEmpty: true }, { ...textarea("notes", "Anteckningar om fordonet"), nullEmpty: true }];
    setEditor({ title: "Redigera fordon", fields, initial: { ...vehicle }, save: data => api(path, "PUT", { ...data, expectedUpdatedAt: vehicle.updatedAt }) });
  }
  function editEvent(type: string, entry?: BookEvent, completion?: MaintenanceRule) {
    const wheel = type === "wheel_change";
    const fields: Field[] = [text("title", "Rubrik", true), { name: "occurredAt", label: "Datum och tid", type: "datetime-local", required: true }, { ...numeric("odometerKm", "Mätarställning (km)"), required: type === "odometer" }];
    if (wheel) fields.push({ name: "wheelBatchId", label: "Montera hjuluppsättning / däckomgång", type: "select", nullEmpty: true, options: [{ value: "", label: "Enbart demontering" }, ...book.tireBatches.map(b => ({ value: b.id, label: `${book.wheelSets.find(s => s.id === b.wheelSetId)?.name} · ${b.make} ${b.model}${b.acquiredOn ? ` · ${b.acquiredOn}` : ""}` }))], help: "Bytet avslutar föregående montering vid vald tidpunkt. Bakdatering och ändringar räknar om efterföljande perioder." });
    if (["service", "repair", "workshop", "wheel_change"].includes(type)) fields.push(text("vendor", "Verkstad / leverantör"), textarea("itemsText", "Utförda åtgärder (en per rad)"), amount, { name: "currency", label: "Valuta", type: "select", options: ["SEK", "EUR", "NOK", "DKK"].map(value => ({ value, label: value })) });
    fields.push(textarea("description", "Anteckningar"), { name: "confirmOdometer", label: "Jag har kontrollerat och bekräftar en avvikande mätarställning", type: "checkbox", help: "Markera bara om systemet varnar och det angivna värdet är korrekt." });
    if (entry) fields.push({ name: "confirmSchedule", label: "Jag godkänner att nästa underhåll räknas om från ändringen", type: "checkbox" });
    setEditor({ title: completion ? "Registrera genomförd åtgärd" : `${entry ? "Redigera" : "Lägg till"} ${eventNames[type]?.toLowerCase()}`, fields,
      initial: { title: completion?.title ?? eventNames[type], currency: "SEK", ...entry, occurredAt: localTime(entry?.occurredAt), itemsText: entry?.items.join("\n") ?? "", costMinor: entry?.costMinor == null ? "" : (entry.costMinor / 100).toFixed(2), confirmOdometer: false, confirmSchedule: false },
      save: data => api(completion ? `${path}/maintenance/${completion.id}/complete` : `${path}/events${entry ? `/${entry.id}` : ""}`, entry ? "PUT" : "POST", { ...data, type, items: String(data.itemsText ?? "").split("\n").map(s => s.trim()).filter(Boolean), revision: completion?.revision ?? entry?.revision }),
    });
  }
  function editSet(set?: WheelSet) {
    const size = (name: string, label: string): Field => ({ ...numeric(name, label), step: "0.1", max: name.toLowerCase().includes("width") ? 20 : 40 });
    setEditor({ title: set ? "Redigera hjuluppsättning" : "Lägg till hjuluppsättning", fields: [text("name", "Uppsättningens namn", true), { name: "season", label: "Säsong", type: "select", options: Object.entries(seasonNames).map(([value, label]) => ({ value, label })) }, text("rimName", "Fälgbenämning"), text("rimMake", "Fälgfabrikat"), text("rimModel", "Fälgmodell"), size("rimDiameter", "Fälgdiameter fram / alla (tum)"), size("rimWidth", "Fälgbredd fram / alla (tum)"), size("rearDiameter", "Fälgdiameter bak (om annan)"), size("rearWidth", "Fälgbredd bak (om annan)"), text("color", "Fälgfärg"), text("offset", "ET / inpressning"), text("boltPattern", "Bultmönster"), textarea("notes", "Anteckningar")], initial: { season: "summer", ...set }, save: data => api(`${path}/wheel-sets${set ? `/${set.id}` : ""}`, set ? "PUT" : "POST", { ...data, revision: set?.revision }) });
  }
  function editBatch(setId: string, batch?: TireBatch) {
    setEditor({ title: batch ? "Korrigera däckuppgifter" : "Lägg till ny däckomgång", fields: [text("make", "Däckfabrikat", true), text("model", "Däckmodell", true), text("dimension", "Däckdimension fram / alla"), text("rearDimension", "Däckdimension bak (om annan)"), { name: "acquiredOn", label: "Införskaffningsdatum", type: "date" }, { name: "kind", label: "Däcktyp", type: "select", options: [{ value: "unknown", label: "Ej angivet" }, { value: "summer", label: "Sommardäck" }, { value: "friction", label: "Friktionsdäck" }, { value: "studded", label: "Dubbdäck" }, { value: "all_season", label: "Året runt" }] }, text("dot", "DOT / tillverkningskod"), { ...amount, label: "Inköpspris (SEK)", help: "Referensuppgift. Registrera en kostnadshändelse för att inkludera inköpet i ekonomin." }, textarea("notes", "Anteckningar")], initial: { kind: "unknown", ...batch, costMinor: batch?.costMinor == null ? "" : (batch.costMinor / 100).toFixed(2) }, save: data => api(`${path}/tire-batches${batch ? `/${batch.id}` : ""}`, batch ? "PUT" : "POST", { ...data, wheelSetId: setId, revision: batch?.revision }) });
  }
  function editMaintenance(rule?: MaintenanceRule) {
    setEditor({ title: rule ? "Redigera underhåll" : "Planera underhåll", fields: [text("title", "Åtgärd", true), { name: "dueOn", label: "Senast datum", type: "date" }, numeric("dueKm", "Senast mätarställning (km)"), { ...numeric("intervalMonths", "Återkommande intervall (månader)"), min: 1, max: 120 }, { ...numeric("intervalKm", "Återkommande intervall (km)"), min: 1 }, textarea("notes", "Anteckningar")], initial: { ...rule }, save: data => api(`${path}/maintenance${rule ? `/${rule.id}` : ""}`, rule ? "PUT" : "POST", { ...data, revision: rule?.revision }) });
  }
  function confirmDelete(kind: string, entryId: string, title: string, revision?: number, isVehicle = false) {
    setDeletion({ title: `Ta bort ${title}?`, description: `${context}. Posten tas bort från aktiva vyer men bevaras i arkivet. Kopplade värden räknas om. För hjulbyten påverkas även efterföljande monteringsperioder. Genomfört underhåll öppnas igen och dess nästa automatiska åtgärd tas bort. Återställning finns ännu inte i appen.`, vehicle: isVehicle,
      run: () => api(`${path}${isVehicle ? "" : `/${kind}/${entryId}`}`, "DELETE", revision ? { revision } : undefined) });
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setNotice("");
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Filen får vara högst 20 MB.");
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`${API}${path}/assets${uploadEventId ? `?eventId=${uploadEventId}` : ""}`, { method: "POST", body: form });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message ?? "Kunde inte ladda upp filen. Försök igen."); }
      await refreshed("Filen har sparats.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Uppladdningen misslyckades."); }
    finally { setUploading(false); }
  }
  function linkAsset(asset: Asset) {
    setEditor({ title: "Koppla bilaga", fields: [{ name: "eventId", label: "Händelse", type: "select", nullEmpty: true, options: [{ value: "", label: "Endast till fordonet" }, ...book.events.map(e => ({ value: e.id, label: `${e.title} · ${formatDate(e.occurredAt)}` }))] }], initial: { eventId: asset.eventId }, save: data => api(`${path}/assets/${asset.id}`, "PUT", data) });
  }
  const next = book.maintenance.filter(r => r.status !== "done").sort((a, b) => ["overdue", "soon", "upcoming"].indexOf(a.status) - ["overdue", "soon", "upcoming"].indexOf(b.status))[0];
  const tabs = [["overview", "Översikt"], ["timeline", "Tidslinje"], ["maintenance", "Underhåll"], ["tires", "Däck"], ["economy", "Ekonomi"], ["gallery", "Galleri"], ["documents", "Dokument"]];
  function history(compact = false) {
    const rows = book.events.filter(e => compact || filter === "all" || e.type === filter).slice(0, compact ? 3 : undefined);
    return <section className="card panel reading-history"><div className="panel-title"><h2>{compact ? "Senaste historik" : "Tidslinje"}</h2>{compact && <a href={`#vehicles/${id}/timeline`}>Visa tidslinje</a>}</div>
      {!compact && <label className="inline-label">Visa händelser<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Alla</option>{Object.entries(eventNames).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>}
      {rows.length === 0 ? <div className="history-empty"><h3>{book.events.length ? "Inga händelser matchar filtret" : "Ingen historik ännu"}</h3><p className="muted">Börja med en mätarställning, anteckning eller service.</p><button onClick={() => editEvent("odometer")}>Lägg till mätarställning</button></div> : <ol className="reading-list event-list">{rows.map(e => <li key={e.id}><div className="event-content"><span className="eyebrow">{eventNames[e.type]}</span><h3>{e.title}</h3><time dateTime={e.occurredAt}>{formatDate(e.occurredAt)}</time>
        {e.odometerKm !== null && <strong>{formatKm(e.odometerKm)} km</strong>}{e.anomaly && <p className="warning-text">Avvikande mätarställning, manuellt bekräftad</p>}
        {e.vendor && <p>{e.vendor}</p>}{e.description && <p className="vehicle-notes">{e.description}</p>}{e.items.length > 0 && <ul>{e.items.map((item, n) => <li key={n}>{item}</li>)}</ul>}{e.costMinor !== null && <p>{money(e.costMinor, e.currency)}</p>}
        {book.assets.filter(a => a.eventId === e.id).map(a => <a className="attachment-link" key={a.id} href={a.url}>{a.filename}</a>)}
        <div className="row-actions"><button className="secondary" onClick={() => editEvent(e.type, e)} aria-label={`Redigera ${e.title}`}><Pencil size={16}/> Redigera</button><button className="danger secondary" onClick={() => confirmDelete("events", e.id, e.type === "odometer" ? `mätaravläsning ${formatKm(e.odometerKm)} km` : e.title, e.revision)} aria-label={e.type === "odometer" ? `Ta bort avläsning ${formatKm(e.odometerKm)} km, ${formatDate(e.occurredAt)}` : `Ta bort ${e.title}`}><Trash2 size={16}/> Ta bort</button></div>
      </div></li>)}</ol>}
    </section>;
  }
  function wheels() {
    const active = book.fitments.find(f => !f.removedAt);
    return <section><div className="section-head"><div><h2>Sommar- och vinterhjul</h2><p className="muted">{active ? `Monterat: ${book.wheelSets.find(s => s.id === active.wheelSetId)?.name}` : "Inga hjul är registrerade som monterade"}</p></div><button onClick={() => editSet()}><Plus size={18}/> Ny uppsättning</button></div>
      <button className="secondary" disabled={!book.tireBatches.length && !active} onClick={() => editEvent("wheel_change")}>Registrera hjulbyte</button>
      {!book.wheelSets.length && <p className="muted">Lägg först till fälguppsättningen, därefter däcken som sitter på den.</p>}
      <div className="book-grid">{book.wheelSets.map(set => <article className="card panel" key={set.id}><span className="eyebrow">{seasonNames[set.season]} · {active?.wheelSetId === set.id ? "Monterad" : "Förvarad"}</span><h3>{set.name}</h3><p>{[set.rimName, set.rimMake, set.rimModel, set.color].filter(Boolean).join(" · ") || "Fälguppgifter ej angivna"}</p><p className="muted">{set.rimDiameter ? `${set.rimDiameter} tum` : "Diameter ej angiven"}{set.rimWidth ? ` × ${set.rimWidth}` : ""}{set.rearDiameter ? ` · Bak ${set.rearDiameter} × ${set.rearWidth ?? "—"}` : ""}{set.offset ? ` · ET ${set.offset}` : ""}{set.boltPattern ? ` · ${set.boltPattern}` : ""}</p>{set.notes && <p>{set.notes}</p>}
        <div className="row-actions"><button className="secondary" onClick={() => editSet(set)}>Redigera fälgar</button><button className="secondary" onClick={() => editBatch(set.id)}>Ny däckomgång</button><button className="danger secondary" onClick={() => confirmDelete("wheel-sets", set.id, set.name, set.revision)}>Ta bort uppsättning</button></div>
        {book.tireBatches.filter(b => b.wheelSetId === set.id).map(batch => { const periods = book.fitments.filter(f => f.batchId === batch.id); const known = periods.filter(f => f.distanceKm !== null && !f.anomaly); const total = known.reduce((sum, f) => sum + f.distanceKm!, 0); return <section className="batch-card" key={batch.id}><h4>{batch.make} {batch.model}</h4><p>{batch.dimension || "Dimension ej angiven"}{batch.rearDimension ? ` · Bak ${batch.rearDimension}` : ""}</p><p className="muted">Införskaffade: {batch.acquiredOn ?? "Ej angivet"} · DOT: {batch.dot || "Ej angivet"}</p><p className="muted">Typ: {({ studded: "Dubb", friction: "Friktion", summer: "Sommar", all_season: "Året runt", unknown: "Ej angivet" })[batch.kind]}{batch.costMinor !== null ? ` · Inköpspris ${money(batch.costMinor)}` : ""}</p>{batch.notes && <p>{batch.notes}</p>}<p>{known.length ? `${formatKm(total)} km registrerad körsträcka` : "Körsträcka saknas"}{periods.some(f => f.distanceKm === null || f.anomaly) ? " · Ofullständigt underlag" : ""}</p>{periods.some(f => f.anomaly) && <p className="warning-text">Kontrollera minskande mätarvärden i monteringshistoriken.</p>}
        <div className="row-actions"><button className="secondary" onClick={() => editBatch(set.id, batch)}>Korrigera däckuppgifter</button><button className="danger secondary" onClick={() => confirmDelete("tire-batches", batch.id, `${batch.make} ${batch.model}`, batch.revision)}>Ta bort däckomgång</button></div>
        {periods.length > 0 && <details><summary>Monteringshistorik ({periods.length})</summary>{periods.map(f => <p key={f.eventId}>{formatDate(f.mountedAt)} → {f.removedAt ? formatDate(f.removedAt) : "Monterad nu"}<br/>{formatKm(f.mountedKm)} → {formatKm(f.removedKm)} km · {f.distanceKm === null ? "Ofullständigt underlag" : `${formatKm(f.distanceKm)} km`}</p>)}</details>}
        </section>; })}
      </article>)}</div>
    </section>;
  }
  function maintenance() { return <section><div className="section-head"><h2>Underhåll</h2><button onClick={() => editMaintenance()}>Planera underhåll</button></div><p className="muted">”Snart” betyder inom 30 dagar eller 1 000 km. En uppnådd kilometergräns räknas som förfallen.</p>{!book.maintenance.length && <p>Inga planerade åtgärder ännu.</p>}<div className="book-grid">{book.maintenance.map(rule => <article className="card panel" key={rule.id}><span className={`rule-status ${rule.status}`}>{statusNames[rule.status]}</span><h3>{rule.title}</h3><p>{rule.dueOn ? `Senast ${rule.dueOn}` : ""}{rule.dueKm !== null ? ` · ${formatKm(rule.dueKm)} km` : ""}</p>{rule.mileageUnknown && <p className="warning-text">Mätarställning saknas för kilometerbedömningen.</p>}<p className="muted">{rule.notes}</p><div className="row-actions">{rule.status !== "done" && <><button onClick={() => editEvent("service", undefined, rule)}>Markera genomförd</button><button className="secondary" onClick={() => editMaintenance(rule)}>Redigera</button></>}<button className="danger secondary" onClick={() => confirmDelete("maintenance", rule.id, rule.title, rule.revision)}>Ta bort</button></div></article>)}</div></section>; }
  function files() {
    const rows = book.assets.filter(a => section !== "gallery" || a.previewUrl);
    return <section><h2>{section === "gallery" ? "Galleri och profilbild" : "Dokument och bilagor"}</h2><p className="muted">JPEG, PNG, WebP och PDF, högst 20 MB. Originalet bevaras. HEIC behöver exporteras till JPEG före uppladdning.</p><div className="upload-controls"><label>Koppla uppladdning till<select value={uploadEventId} onChange={e => setUploadEventId(e.target.value)}><option value="">Endast fordonet</option>{book.events.map(e => <option key={e.id} value={e.id}>{e.title} · {formatDate(e.occurredAt)}</option>)}</select></label><label>Välj fil<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }}/></label></div>{uploading && <p role="status">Laddar upp…</p>}{!rows.length && <p>Inga filer ännu. Ladda upp ett foto, kvitto eller serviceprotokoll.</p>}
      <div className="book-grid">{rows.map(a => <article className="card panel asset-card" key={a.id}>{a.previewUrl && <img src={a.previewUrl} alt={a.filename} loading="lazy"/>}<h3>{a.filename}</h3><p className="muted">{Math.ceil(a.size / 1024)} kB · {a.capturedAt ? `Fotodatum ${formatDate(a.capturedAt)}` : `Uppladdad ${formatDate(a.uploadedAt)}`}</p><p>{a.eventId ? book.events.find(e => e.id === a.eventId)?.title : "Kopplad till fordonet"}</p><a className="attachment-link" href={a.url}>Ladda ner original</a><div className="row-actions">{a.previewUrl && <button className="secondary" onClick={() => void action(() => api(`${path}/cover`, "PUT", { assetId: a.id }), "Profilbilden har uppdaterats.")}>Använd som profilbild</button>}<button className="secondary" onClick={() => linkAsset(a)}>Ändra koppling</button><button className="danger secondary" onClick={() => confirmDelete("assets", a.id, a.filename)}>Ta bort fil</button></div></article>)}</div>
    </section>;
  }
  return <>
    <a className="back-link" href="#vehicles"><ArrowLeft size={18}/> Alla fordon</a>
    {notice && <p role="status" className="deletion-notice">{notice}</p>}
    {editor && <Editor {...editor} context={context} onClose={() => setEditor(null)} onSave={async data => { await editor.save(data); setEditor(null); await refreshed("Uppgifterna har sparats."); }}/>}
    {deletion && <DeleteConfirmation title={deletion.title} description={deletion.description} onCancel={() => setDeletion(null)} onConfirm={async () => { await deletion.run(); const removedVehicle = deletion.vehicle; setDeletion(null); if (removedVehicle) window.location.hash = "vehicles"; await refreshed("Posten har tagits bort."); }}/>}
    {error && <section className="card panel" role="alert"><h2>Kunde inte slutföra</h2><p>{error}</p><button onClick={() => setAttempt(n => n + 1)}>Försök igen</button></section>}
    {loading ? <section className="card detail-loading" role="status" aria-label="Laddar fordon"><div/><div/><p>Laddar fordon…</p></section> : !error && vehicle && <>
      <header className="card vehicle-header"><div className="detail-visual">{vehicle.coverImageUrl ? <img src={vehicle.coverImageUrl} alt={`${vehicle.make} ${vehicle.model}`}/> : <><CarFront size={64}/><a href={`#vehicles/${id}/gallery`}>Lägg till profilbild</a></>}</div><div className="detail-heading"><span className="registration">{vehicle.registrationNumber}</span><h1 ref={heading} tabIndex={-1}>{vehicle.make} {vehicle.model}</h1><p className="muted">{[vehicle.variant, vehicle.modelYear].filter(Boolean).join(" · ")}</p><div className="row-actions"><button className="secondary" onClick={editVehicle}><Pencil size={18}/> Redigera fordon</button><button className="danger secondary" onClick={() => confirmDelete("", id, "fordon", undefined, true)}><Trash2 size={18}/> Ta bort fordon</button></div></div></header>
      <nav className="vehicle-tabs" aria-label="Fordonsnavigation">{tabs.map(([value, label]) => <a key={value} href={`#vehicles/${id}${value === "overview" ? "" : `/${value}`}`} aria-current={section === value ? "page" : undefined}>{label}</a>)}</nav>
      <div className="quick-add" aria-label="Snabbregistrering"><span>Lägg till</span>{Object.entries(eventNames).map(([type, label]) => <button key={type} className="secondary" onClick={() => editEvent(type)} disabled={type === "wheel_change" && !book.tireBatches.length}><Plus size={16}/>{label}</button>)}</div>
      {section === "overview" ? <><section className="kpi-grid" aria-label="Fordonsöverblick"><div className="card panel"><h2><Gauge size={18}/> Aktuell mätarställning</h2><p className="kpi-value">{formatKm(vehicle.currentOdometerKm)} <small>km</small></p><p className="muted">{vehicle.odometerReadings[0] ? `Avläst ${formatDate(vehicle.odometerReadings[0].recordedAt)}` : "Ingen mätarställning registrerad"}</p></div><div className="card panel"><h2>Nästa åtgärd</h2><p className="kpi-label">{next?.title ?? "Ingen planerad"}</p><p className="muted">{next ? `${statusNames[next.status]} · ${next.dueOn ?? ""} ${next.dueKm !== null ? `${formatKm(next.dueKm)} km` : ""}` : "Lägg in din nästa service eller besiktning."}</p><a href={`#vehicles/${id}/maintenance`}>Visa underhåll</a></div><div className="card panel"><h2>Kostnader i år</h2>{book.totals.length ? book.totals.map(t => <p className="kpi-label" key={t.currency}>{money(t.amountMinor, t.currency)}</p>) : <p className="kpi-label">Inga registrerade</p>}<a href={`#vehicles/${id}/economy`}>Visa kostnader</a></div></section>
        <section className="card panel vehicle-data"><div className="panel-title"><h2>Fordonsuppgifter</h2><button className="secondary" onClick={editVehicle}>Redigera</button></div><dl>{[["Registreringsnummer", vehicle.registrationNumber], ["Märke", vehicle.make], ["Modell", vehicle.model], ["Variant", vehicle.variant], ["Årsmodell", vehicle.modelYear], ["Färg", vehicle.color], ["VIN / chassinummer", vehicle.vin]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Ej angivet"}</dd></div>)}</dl>{vehicle.notes && <p className="vehicle-notes">{vehicle.notes}</p>}</section>{history(true)}</>
        : section === "timeline" ? history() : section === "tires" ? wheels() : section === "maintenance" ? maintenance() : ["gallery", "documents"].includes(section) ? files()
        : section === "economy" ? <section className="card panel"><h2>Registrerade kostnader</h2><p className="muted">Kostnader från händelser. Inköpspris på en däckomgång är en referensuppgift och dubbelräknas inte här.</p>{book.events.filter(e => e.costMinor !== null).map(e => <div className="cost-row" key={e.id}><span>{formatDate(e.occurredAt)} · {e.title}</span><strong>{money(e.costMinor!, e.currency)}</strong><button className="secondary" onClick={() => editEvent(e.type, e)}>Redigera</button></div>)}{!book.events.some(e => e.costMinor !== null) && <p>Inga kostnader registrerade ännu.</p>}</section>
        : <section className="card panel"><h2>Sidan finns inte</h2><a href={`#vehicles/${id}`}>Till fordonsöversikten</a></section>}
    </>}
  </>;
}
