import { useEffect, useState } from "react";
import type { VehicleSummary } from "@milspar/contracts";
import { api, formatDate, formatKm, statusNames } from "./book-ui";

type Overview = { events: { id: string; vehicleId: string; registration: string; title: string; occurredAt: string }[]; maintenance: { id: string; vehicleId: string; registration: string; title: string; dueOn: string | null; dueKm: number | null; status: "overdue" | "soon" | "upcoming"; mileageUnknown: boolean }[] };
export function FleetOverview({ revision, maintenanceOnly = false }: { revision: number; maintenanceOnly?: boolean }) {
  const [data, setData] = useState<Overview | null>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => { let current = true; setError(""); void api<Overview>("/overview").then(data => { if (current) setData(data); }).catch(() => { if (current) setError("Kunde inte hämta översikten."); }); return () => { current = false; }; }, [revision, retry]);
  if (error) return <section className="card panel" role="alert"><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Försök igen</button></section>;
  if (!data) return <p role="status">Laddar historik och underhåll…</p>;
  return <section className="dashboard-row"><div className="card panel"><h2>Att göra</h2>{!data.maintenance.length && <p className="muted">Inga planerade åtgärder. Öppna ett fordon för att lägga in nästa service.</p>}{data.maintenance.map(r => <a className="overview-row" href={`#vehicles/${r.vehicleId}/maintenance`} key={r.id}><strong>{r.registration} · {r.title}</strong><span>{statusNames[r.status]} · {r.dueOn ?? ""} {r.dueKm !== null ? `${formatKm(r.dueKm)} km` : ""}{r.mileageUnknown ? " · Mätarställning saknas" : ""}</span></a>)}</div>
    {!maintenanceOnly && <div className="card panel"><h2>Senaste</h2>{!data.events.length && <p className="muted">Inga händelser ännu. Öppna ett fordon för att registrera en avläsning eller service.</p>}{data.events.slice(0, 8).map(e => <a className="overview-row" key={e.id} href={`#vehicles/${e.vehicleId}/timeline`}><strong>{e.registration} · {e.title}</strong><span>{formatDate(e.occurredAt)}</span></a>)}</div>}
  </section>;
}
export function FleetDestination({ name, section, vehicles }: { name: string; section: string; vehicles: VehicleSummary[] }) {
  return <><h1>{name}</h1><p className="muted">Välj fordon för att visa och hantera {name.toLowerCase()}.</p><div className="book-grid">{vehicles.map(v => <a className="card panel destination-link" href={`#vehicles/${v.id}/${section}`} key={v.id}><strong>{v.registrationNumber}</strong><h2>{v.make} {v.model}</h2></a>)}</div>{!vehicles.length && <a href="#vehicles">Lägg till ditt första fordon</a>}</>;
}
