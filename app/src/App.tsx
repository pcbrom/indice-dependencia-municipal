import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BotaoLiteratura } from "./components/BotaoLiteratura";
import { EstadoCarregando } from "./components/EstadoCarregando";
import { Nav } from "./components/Nav";
import { Tour } from "./components/Tour";
import { SelecaoProvider } from "./lib/selecao";
import { TourProvider } from "./lib/tour";
import type { Rota } from "./lib/types";

// Concept DOI of the published dataset: it always resolves to the most recent
// version, so it stays correct across releases.
export const DOI_CONCEITO = "10.5281/zenodo.21431702";

// Public repository with the source code (MIT), the derived data and the
// method documentation (CC BY 4.0).
export const REPOSITORIO = "https://github.com/pcbrom/indice-dependencia-municipal";

// Title shown as the nav lead per screen (the map carries the product title,
// with the thesis as its subtitle).
const LEAD_ROTA: Record<Rota, string> = {
  mapa: "Brasil em Órbita: Índice de Dependência Municipal",
  municipio: "Meu município",
  fiscal: "Eixo fiscal",
  cenarios: "Brasil em Cenários",
  ranking: "Grau de dependência estrutural",
  metodologia: "Metodologia",
  contexto: "Contexto",
};

// Maps the current pathname to a Rota for the persistent nav highlight.
function rotaDaLocalizacao(pathname: string): Rota {
  if (pathname.startsWith("/municipio")) return "municipio";
  if (pathname.startsWith("/fiscal")) return "fiscal";
  if (pathname.startsWith("/cenarios")) return "cenarios";
  if (pathname.startsWith("/ranking")) return "ranking";
  if (pathname.startsWith("/metodologia")) return "metodologia";
  if (pathname.startsWith("/contexto")) return "contexto";
  return "mapa";
}

// Shell shared by every screen: the persistent nav, and a Suspense boundary so
// each lazily-loaded route shows the standard loading state while its chunk
// arrives.
export function App() {
  const { pathname } = useLocation();
  const rota = rotaDaLocalizacao(pathname);
  // Every screen carries its title as the nav lead (left), so the nav reads the
  // same everywhere: title on the left, tabs and controls on the right. The
  // per-screen control faixa lives below the nav in each route.
  const lead = LEAD_ROTA[rota];
  const subLead =
    rota === "mapa"
      ? "A geografia real dos serviços no Brasil."
      : rota === "cenarios"
        ? "Análise da agregação municipal por região funcional, região e UF; não é recomendação."
        : undefined;
  return (
    <SelecaoProvider>
      <TourProvider>
        <div style={{ minHeight: "100vh", background: "var(--surface-page)" }}>
          <a href="#conteudo" className="skip-link">
            Pular para o conteúdo
          </a>
          <Nav rotaAtiva={rota} lead={lead} subLead={subLead} />
          <main
            id="conteudo"
            tabIndex={-1}
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "var(--space-5) var(--space-4)",
            }}
          >
            <Suspense fallback={<EstadoCarregando rotulo="Carregando a tela" />}>
              <Outlet />
            </Suspense>
          </main>
          <BotaoLiteratura />
          <Tour />
        </div>
      </TourProvider>
    </SelecaoProvider>
  );
}
