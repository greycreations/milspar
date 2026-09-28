import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card">
        <span className="eyebrow">MILSPÅR</span>
        <h1>Hela bilens historia.</h1>
        <p>Teknisk baseline är på plats. Nästa steg är den första riktiga fordonsöversikten.</p>
        <button type="button">Lägg till fordon</button>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
