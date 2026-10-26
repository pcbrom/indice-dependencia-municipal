import { BookOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QuadroLiteratura } from "./QuadroLiteratura";

// Floating button, present on every screen, that opens the research context
// ("O que a pesquisa já mostrou") as a layer over the page instead of a fixed
// block at the foot of the methodology screen. The IDM is descritive, not
// causal (docs/DECISAO_CAUSAL): the literature stays a click away, credited to
// third parties, never contiguous with the municipal datum.
export function BotaoLiteratura() {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement | null>(null);

  // Collision reservation: publish the button's live height into --fab-altura so
  // the map's right dock (PainelPolo) can start exactly below it and never
  // overlap, whatever the button's size (label hidden on a narrow screen, font
  // change, wrap).
  useEffect(() => {
    const el = botaoRef.current;
    if (!el) return;
    const aplicar = () =>
      document.documentElement.style.setProperty(
        "--fab-altura",
        `${el.getBoundingClientRect().height}px`,
      );
    aplicar();
    const observador = new ResizeObserver(aplicar);
    observador.observe(el);
    return () => {
      observador.disconnect();
      document.documentElement.style.removeProperty("--fab-altura");
    };
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAberto(false);
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [aberto]);

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className="fab-literatura"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
      >
        <BookOpen size={18} aria-hidden />
        <span>O que a pesquisa já mostrou</span>
      </button>

      {aberto && (
        <div className="detalhe-fundo" role="presentation" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-modal
            aria-label="O que a pesquisa já mostrou"
            className="literatura-layer"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              className="literatura-fechar"
            >
              <X size={18} aria-hidden />
            </button>
            <QuadroLiteratura />
          </div>
        </div>
      )}
    </>
  );
}
