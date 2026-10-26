import { PlayCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Rota } from "../lib/types";
import { useTour } from "../lib/tour";
import { ChipFoco } from "./ChipFoco";
import { ThemeToggle } from "./ThemeToggle";

interface NavProps {
  rotaAtiva: Rota;
  // Optional page lead shown at the far left of the bar, before the tabs (the
  // map's title rides here so it does not need its own band above the map).
  lead?: string;
  // Optional second line under the lead (the map's thesis).
  subLead?: string;
  // Citable identifier of the dataset behind the panel, shown beside the
  // subtitle so the reader meets it at the top, not only in the about box.
  doi?: string;
}

interface ItemRota {
  rota: Rota;
  caminho: string;
  rotulo: string;
}

// Core routes plus methodology. "Meu município" is omitted from the bar: the
// map already searches and a click opens the city's detail with its profile, so
// a separate tab duplicated that path. The /municipio route stays, reached from
// the map and from "abrir em tela cheia". Contexto (Tela 5) is out of the
// premiable core and is omitted until reintegrated.
const itens: ItemRota[] = [
  { rota: "mapa", caminho: "/", rotulo: "Mapa de órbitas" },
  { rota: "fiscal", caminho: "/fiscal", rotulo: "Eixo fiscal" },
  { rota: "ranking", caminho: "/ranking", rotulo: "Ranking" },
  { rota: "cenarios", caminho: "/cenarios", rotulo: "Brasil em Cenários" },
];

// Persistent navigation bar on every screen. Carries the theme toggle and the
// methodology link. rotaAtiva is accepted for callers that drive highlight
// state directly; NavLink also derives the active route from the URL.
export function Nav({ rotaAtiva, lead, subLead, doi }: NavProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3) var(--space-4)",
        flexWrap: "wrap",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-page)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {lead && (
        <div className="nav-lead nav-lead-com-marca">
          <img
            className="nav-marca"
            src="/logo-idm.png"
            alt=""
            aria-hidden="true"
            width={40}
            height={40}
          />
          <div>
          <h1 className="nav-lead-titulo">{lead}</h1>
          {subLead && (
            <span className="nav-lead-sub">
              {subLead}
              {doi && (
                <>
                  {" "}
                  <a
                    href={`https://doi.org/${doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--ink-muted)", textDecoration: "underline" }}
                  >
                    DOI {doi}
                  </a>
                </>
              )}
            </span>
          )}
          </div>
        </div>
      )}
      <nav
        aria-label="Navegação principal"
        style={{
          display: "flex",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          // With a lead, the lead grows and pushes the tabs to the right; with
          // no lead (other routes), the nav grows so metodologia and the theme
          // toggle stay pinned to the right as before.
          flex: lead ? "0 1 auto" : 1,
        }}
      >
        {itens.map((it) => (
          <NavLink
            key={it.rota}
            to={it.caminho}
            end={it.caminho === "/"}
            data-tour={`nav-${it.rota}`}
            aria-current={rotaAtiva === it.rota ? "page" : undefined}
            style={({ isActive }) => ({
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-control)",
              fontSize: "var(--text-body)",
              color: isActive ? "var(--on-accent)" : "var(--ink-secondary)",
              background: isActive ? "var(--accent)" : "transparent",
            })}
          >
            {it.rotulo}
          </NavLink>
        ))}
      </nav>

      <BotaoTour />
      <ChipFoco />
      <NavLink
        to="/metodologia"
        data-tour="nav-metodologia"
        style={{ fontSize: "var(--text-body)", color: "var(--ink-secondary)" }}
      >
        metodologia
      </NavLink>
      <ThemeToggle />
    </header>
  );
}

// Launcher for the guided tour, in the nav next to the controls.
function BotaoTour() {
  const { abrir } = useTour();
  return (
    <button
      type="button"
      onClick={abrir}
      title="Tour do painel"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-2) var(--space-3)",
        border: "none",
        borderRadius: "var(--radius-control)",
        background: "var(--accent)",
        color: "var(--on-accent)",
        fontSize: "var(--text-body)",
        fontWeight: 600,
        boxShadow: "var(--shadow-floating)",
        cursor: "pointer",
      }}
    >
      <PlayCircle size={16} aria-hidden />
      Tour
    </button>
  );
}
