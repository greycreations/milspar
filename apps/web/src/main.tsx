import { FormEvent, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { CarFront, Gauge, Inbox, LayoutDashboard, Plus, Search, Menu, Settings, Wrench } from "lucide-react";
import type { VehicleSummary } from "@milspar/contracts";
import "./styles.css";
import { VehiclePage } from "./VehiclePage";

const API = import.meta.env.VITE_API_URL ?? "/api/v1";

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const navigate = () => { setHash(window.location.hash); setMenuOpen(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const detail = /^#vehicles\/([^/]+)(?:\/([^/]+))?$/.exec(hash);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function loadVehicles() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`${API}/vehicles`);
      if (!response.ok) throw new Error("Kunde inte hämta fordonen.");
      setVehicles(await response.json());
    } catch {
      setLoadError("Kunde inte hämta fordonen. Kontrollera anslutningen och försök igen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadVehicles(); }, []);

  return (
    <div className="layout">
      <button className="tablet-menu secondary" aria-expanded={menuOpen} aria-controls="global-navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20}/> Meny</button>
      <aside id="global-navigation" className={`sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="brand"><span className="brand-mark">M</span><span>MILSPÅR</span></div>
        <nav>
          <a className={`nav-item${!detail && hash !== "#vehicles" ? " active" : ""}`} href="#overview"><LayoutDashboard size={19}/>Översikt</a>
          <a className={`nav-item${detail || hash === "#vehicles" ? " active" : ""}`} href="#vehicles"><CarFront size={19}/>Fordon</a>
          <a className="nav-item" href="#maintenance"><Wrench size={19}/>Underhåll</a>
          <a className="nav-item" href="#inbox"><Inbox size={19}/>Inkorg</a>
        </nav>
        <a className="nav-item settings" href="#settings"><Settings size={19}/>Inställningar</a>
      </aside>

      <main className="content">
        {detail ? <VehiclePage key={detail[1]} id={detail[1]!} section={detail[2] ?? "overview"}/> : <>
        <header className="topbar">
          <div><span className="eyebrow">ÖVERSIKT</span><h1>Mina fordon</h1></div>
          <div className="top-actions"><button className="icon-button" aria-label="Sök"><Search size={20}/></button><button onClick={() => setShowCreate(true)}><Plus size={18}/> Lägg till fordon</button></div>
        </header>

        {loading ? <div className="empty" role="status">Laddar fordon…</div> : loadError ? (
          <section className="empty card" role="alert"><p>{loadError}</p><button onClick={() => void loadVehicles()}>Försök igen</button></section>
        ) : vehicles.length === 0 ? (
          <section className="empty card">
            <div className="empty-icon"><CarFront size={30}/></div>
            <h2>Din servicebok börjar här</h2>
            <p>Lägg till första bilen för att börja samla mätarställning, service, kostnader, däck, dokument och bilder.</p>
            <button onClick={() => setShowCreate(true)}><Plus size={18}/> Lägg till första fordonet</button>
          </section>
        ) : (
          <section className="vehicle-grid">
            {vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle}/>) }
          </section>
        )}

        <section className="dashboard-row">
          <div className="card panel"><div className="panel-title"><h2>Att göra</h2><span>Kommande</span></div><p className="muted">Kommande service, besiktning och andra åtgärder kommer visas här.</p></div>
          <div className="card panel"><div className="panel-title"><h2>Senaste</h2><span>Historik</span></div><p className="muted">När du börjar registrera händelser byggs bilarnas tidslinje här.</p></div>
        </section>
        </>}
      </main>

      <nav className="mobile-nav">
        <a className={!detail && hash !== "#vehicles" ? "active" : ""} href="#overview"><LayoutDashboard size={21}/><span>Hem</span></a>
        <a className={detail || hash === "#vehicles" ? "active" : ""} href="#vehicles"><CarFront size={21}/><span>Fordon</span></a>
        <button className="mobile-add" onClick={() => setShowCreate(true)} aria-label="Skapa nytt fordon"><Plus size={24}/></button>
        <a href="#inbox"><Inbox size={21}/><span>Inkorg</span></a>
        <a href="#settings"><Settings size={21}/><span>Mer</span></a>
      </nav>

      {showCreate && <CreateVehicleModal onClose={() => setShowCreate(false)} onCreated={async () => { setShowCreate(false); await loadVehicles(); }}/>} 
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: VehicleSummary }) {
  return <article className="vehicle-card card">
    <div className="vehicle-visual"><CarFront size={54}/><span className="status-dot"/> <span className="status-label">Aktiv</span></div>
    <div className="vehicle-body">
      <div className="vehicle-heading"><div><span className="registration">{vehicle.registrationNumber}</span><h2><a className="vehicle-link" aria-label={`${vehicle.make} ${vehicle.model}, ${vehicle.registrationNumber}`} href={`#vehicles/${vehicle.id}`}>{vehicle.make} {vehicle.model}<span className="sr-only">, {vehicle.registrationNumber}</span></a></h2>{vehicle.variant && <p>{vehicle.variant}</p>}</div></div>
      <div className="odometer"><Gauge size={19}/><strong>{vehicle.currentOdometerKm === null ? "—" : new Intl.NumberFormat("sv-SE").format(vehicle.currentOdometerKm)}</strong><span>km</span></div>
    </div>
  </article>;
}

function CreateVehicleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('input[name="registrationNumber"]')?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    const odometer = String(data.get("currentOdometerKm") ?? "").trim();
    const year = String(data.get("modelYear") ?? "").trim();
    const body = {
      registrationNumber: data.get("registrationNumber"), make: data.get("make"), model: data.get("model"),
      variant: String(data.get("variant") ?? "") || undefined,
      modelYear: year ? Number(year) : undefined,
      currentOdometerKm: odometer ? Number(odometer) : undefined,
    };
    try {
      const response = await fetch(`${API}/vehicles`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        if (response.status === 409) throw new Error("Registreringsnummer eller VIN finns redan.");
        if (response.status === 400) throw new Error("Kontrollera uppgifterna och försök igen.");
        throw new Error("Kunde inte spara fordonet. Försök igen senare.");
      }
      onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "Ett fel uppstod."); setSaving(false); }
  }

  return <dialog ref={dialog} className="modal" aria-labelledby="create-title"
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <div className="modal-head"><div><span className="eyebrow">NYTT FORDON</span><h2 id="create-title">Lägg till fordon</h2></div><button className="icon-button" disabled={saving} onClick={onClose} aria-label="Stäng">×</button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Registreringsnummer<input name="registrationNumber" required placeholder="ABC 123"/></label>
          <label>Årsmodell<input name="modelYear" type="number" min="1886" max="2200" placeholder="2026"/></label>
          <label>Märke<input name="make" required placeholder="Volkswagen"/></label>
          <label>Modell<input name="model" required placeholder="ID.7"/></label>
          <label className="wide">Variant<input name="variant" placeholder="Tourer GTX Edition"/></label>
          <label className="wide">Aktuell mätarställning<input name="currentOdometerKm" type="number" min="0" step="1" inputMode="numeric" placeholder="28460"/><span className="field-help">km</span></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Avbryt</button><button disabled={saving}>{saving ? "Sparar…" : "Spara fordon"}</button></div>
      </form>
  </dialog>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
