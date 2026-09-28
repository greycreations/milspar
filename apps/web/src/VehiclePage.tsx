import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CarFront, Gauge, Trash2 } from "lucide-react";
import { vehicleDetailSchema, vehicleIdSchema, type VehicleDetail } from "@milspar/contracts";

import { DeleteConfirmation } from "./DeleteConfirmation";

const API = import.meta.env.VITE_API_URL ?? "/api/v1";
const number = new Intl.NumberFormat("sv-SE");
const date = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" });

export function VehiclePage({ id, section, onChanged }: { id: string; section: string; onChanged: () => Promise<void> }) {
  const [deletion, setDeletion] = useState<{ readingId?: string; title: string; description: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setVehicle(null);
    async function load() {
      try {
        if (!vehicleIdSchema.safeParse(id).success) throw new Error("Fordonslänken är ogiltig.");
        const response = await fetch(`${API}/vehicles/${id}`, { signal: controller.signal });
        if (response.status === 404) throw new Error("Fordonet finns inte. Det kan ha tagits bort eller länken kan vara felaktig.");
        if (!response.ok) throw new Error("Kunde inte hämta fordonet. Kontrollera anslutningen och försök igen.");
        const data = vehicleDetailSchema.parse(await response.json());
        if (!controller.signal.aborted) setVehicle(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error && !("issues" in cause) ? cause.message : "Kunde inte läsa fordonsuppgifterna. Försök igen.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (vehicle) {
      document.title = `${vehicle.registrationNumber} · Milspår`;
      heading.current?.focus();
    }
    return () => { document.title = "Milspår"; };
  }, [vehicle, section]);

  async function remove() {
    if (!deletion) return;
    const response = await fetch(deletion.readingId ? `${API}/vehicles/${id}/odometer-readings/${deletion.readingId}` : `${API}/vehicles/${id}`, { method: "DELETE" });
    // A retry after a lost response is already complete if the resource is absent.
    if (!response.ok && response.status !== 404) throw new Error("Delete failed");
    const isReading = Boolean(deletion.readingId);
    setDeletion(null);
    setNotice(isReading ? "Mätaravläsningen har tagits bort." : "");
    if (isReading) setAttempt(n => n + 1);
    else window.location.hash = "vehicles";
    await onChanged();
  }
  function removeReading(reading: VehicleDetail["odometerReadings"][number]) {
    setDeletion({ readingId: reading.id, title: "Ta bort mätaravläsning?", description: `${vehicle?.registrationNumber}: ${number.format(reading.valueKm)} km, ${date.format(new Date(reading.recordedAt))}. Avläsningen tas bort från historiken och aktuell mätarställning räknas om. Uppgiften bevaras i arkivet, men återställning finns ännu inte i appen.` });
  }

  return <>
    {notice && <p role="status" className="deletion-notice">{notice}</p>}
    {deletion && <DeleteConfirmation {...deletion} onCancel={() => setDeletion(null)} onConfirm={remove}/>}
    <a className="back-link" href="#vehicles"><ArrowLeft size={18}/> Alla fordon</a>
    {loading ? <section className="card detail-loading" role="status" aria-label="Laddar fordon"><div/><div/><p>Laddar fordon…</p></section>
      : error ? <section className="card empty" role="alert"><h1>Kunde inte visa fordonet</h1><p>{error}</p><button onClick={() => setAttempt(n => n + 1)}>Försök igen</button></section>
      : vehicle && <>
        <header className="card vehicle-header">
          <div className="detail-visual"><CarFront size={64} aria-hidden="true"/><span>Ingen profilbild ännu</span></div>
          <div className="detail-heading"><span className="registration">{vehicle.registrationNumber}</span>
            <h1 ref={heading} tabIndex={-1}>{vehicle.make} {vehicle.model}</h1>
            <p className="muted">{[vehicle.variant, vehicle.modelYear].filter(Boolean).join(" · ") || "Ditt fordonsarkiv"}</p>
            <span className="vehicle-state">Registrerat fordon</span>
            <div><button className="danger secondary delete-vehicle" onClick={() => setDeletion({ title: "Ta bort fordon?", description: `${vehicle.registrationNumber} – ${vehicle.make} ${vehicle.model} tas bort från fordonslistan tillsammans med sin synliga historik. Uppgifterna bevaras i arkivet, men återställning finns ännu inte i appen.` })}><Trash2 size={18}/> Ta bort fordon</button></div>
          </div>
        </header>
        <nav className="vehicle-tabs" aria-label="Fordonsnavigation">
          <a href={`#vehicles/${id}`} aria-current={section === "overview" ? "page" : undefined}>Översikt</a>
          <a href={`#vehicles/${id}/timeline`} aria-current={section === "timeline" ? "page" : undefined}>Tidslinje</a>
          {["Underhåll", "Däck", "Ekonomi", "Galleri", "Dokument"].map(label => <span key={label} aria-disabled="true">{label} <small>Kommer</small></span>)}
        </nav>
        {section !== "overview" && section !== "timeline" ? <section className="card panel"><h2>Sidan finns inte</h2><p><a href={`#vehicles/${id}`}>Till fordonsöversikten</a></p></section>
          : section === "timeline" ? <ReadingHistory onRemove={removeReading} vehicle={vehicle}/>
          : <>
            <section className="kpi-grid" aria-label="Fordonsöverblick">
              <div className="card panel"><h2><Gauge size={18}/> Aktuell mätarställning</h2><p className="kpi-value">{vehicle.currentOdometerKm === null ? "—" : number.format(vehicle.currentOdometerKm)} <small>km</small></p><p className="muted">{vehicle.odometerReadings[0] ? `Avläst ${date.format(new Date(vehicle.odometerReadings[0].recordedAt))}` : "Ingen mätarställning registrerad"}</p></div>
              <div className="card panel"><h2>Nästa åtgärd</h2><p className="kpi-value">—</p><p className="muted">Underhållsplanering kommer i en senare version.</p></div>
              <div className="card panel"><h2>Kostnader i år</h2><p className="kpi-value">—</p><p className="muted">Kostnadsregistrering är ännu inte tillgänglig.</p></div>
            </section>
            <section className="card panel vehicle-data"><h2>Fordonsuppgifter</h2><dl>
              {[["Registreringsnummer", vehicle.registrationNumber], ["Märke", vehicle.make], ["Modell", vehicle.model], ["Variant", vehicle.variant], ["Årsmodell", vehicle.modelYear], ["Färg", vehicle.color], ["VIN / chassinummer", vehicle.vin]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Ej angivet"}</dd></div>)}
            </dl>{vehicle.notes && <><h3>Anteckningar</h3><p className="vehicle-notes">{vehicle.notes}</p></>}</section>
            <ReadingHistory onRemove={removeReading} vehicle={vehicle} compact/>
          </>}
      </>}
  </>;
}

function ReadingHistory({ vehicle, compact = false, onRemove }: { vehicle: VehicleDetail; compact?: boolean; onRemove: (reading: VehicleDetail["odometerReadings"][number]) => void }) {
  const readings = compact ? vehicle.odometerReadings.slice(0, 3) : vehicle.odometerReadings;
  return <section className="card panel reading-history">
    <div className="panel-title"><h2>{compact ? "Senaste historik" : "Tidslinje"}</h2>{compact && <a href={`#vehicles/${vehicle.id}/timeline`}>Visa tidslinje</a>}</div>
    <p className="muted">Här visas registrerade mätarställningar. Service och andra händelser tillkommer senare.</p>
    {readings.length === 0 ? <div className="history-empty"><Gauge size={28} aria-hidden="true"/><h3>Ingen mätarhistorik ännu</h3><p className="muted">Det här fordonet har ingen registrerad avläsning. Möjligheten att lägga till nya avläsningar kommer i nästa steg.</p></div>
      : <ol className="reading-list">{readings.map(reading => <li key={reading.id}>
        <Gauge size={20} aria-hidden="true"/><div><strong>{number.format(reading.valueKm)} km</strong><span>Mätarställning · {reading.sourceType === "manual" ? "Manuellt registrerad" : "Importerad avläsning"}</span></div>
        <time dateTime={reading.recordedAt}>{date.format(new Date(reading.recordedAt))}</time>
        <button className="icon-button danger secondary" onClick={() => onRemove(reading)} aria-label={`Ta bort avläsning ${number.format(reading.valueKm)} km, ${date.format(new Date(reading.recordedAt))}`}><Trash2 size={18}/></button>
      </li>)}</ol>}
    {!compact && vehicle.hasMoreReadings && <p className="muted">Visar de 50 senaste avläsningarna. Äldre avläsningar finns kvar i arkivet.</p>}
  </section>;
}
