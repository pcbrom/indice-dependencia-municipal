import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PASSOS, useTour } from "../lib/tour";

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Guided tour overlay: a dimming layer with a spotlight cutout over the current
// step's target, plus a card with the copy and back/next/close. Navigates
// between routes so each region is shown where it lives; if a target is not
// found, the card centers and the whole screen dims (no spotlight). See
// lib/tour.tsx for the steps.
export function Tour() {
  const { aberto, fechar } = useTour();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const timerRef = useRef<number | null>(null);

  const passo = PASSOS[i];
  const total = PASSOS.length;

  // Reset to the first step whenever the tour opens.
  useEffect(() => {
    if (aberto) setI(0);
  }, [aberto]);

  // Drive navigation only for steps that spotlight a target on a given screen.
  // Centered steps (the intro and the outro, alvo null) never navigate, so the
  // tour auto-opening on every visit does not hijack a deep link like
  // /municipio/1200401 back to the home route.
  useEffect(() => {
    if (!aberto || !passo || !passo.alvo) return;
    navigate(passo.rota);
  }, [aberto, passo, navigate]);

  // Locate the target after the route has had a moment to render; re-measure on
  // resize. A short delay lets the lazy route chunk and its DOM settle.
  const medir = useCallback(() => {
    if (!passo) return;
    if (!passo.alvo) {
      setCaixa(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${passo.alvo}"]`);
    if (!el) {
      setCaixa(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const m = 6;
    setCaixa({ top: r.top - m, left: r.left - m, width: r.width + 2 * m, height: r.height + 2 * m });
  }, [passo]);

  useLayoutEffect(() => {
    if (!aberto) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(medir, 350);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, medir]);

  const avancar = useCallback(() => {
    setI((n) => (n < total - 1 ? n + 1 : n));
  }, [total]);
  const voltar = useCallback(() => setI((n) => (n > 0 ? n - 1 : n)), []);

  // Keyboard: setas navegam, Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowRight") avancar();
      else if (e.key === "ArrowLeft") voltar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar, avancar, voltar]);

  if (!aberto || !passo) return null;

  const ultimo = i === total - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Card placement: below the target if there is room, else above; centered when
  // there is no target.
  const larguraCartao = Math.min(380, vw - 32);
  let cardStyle: React.CSSProperties;
  if (caixa) {
    const abaixo = caixa.top + caixa.height + 12;
    const cabeAbaixo = abaixo + 220 < vh;
    const top = cabeAbaixo ? abaixo : Math.max(16, caixa.top - 232);
    let left = caixa.left + caixa.width / 2 - larguraCartao / 2;
    left = Math.max(16, Math.min(left, vw - larguraCartao - 16));
    cardStyle = { top, left, width: larguraCartao };
  } else {
    cardStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: larguraCartao,
    };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }} role="dialog" aria-modal aria-label="Tour do painel">
      {/* Spotlight: a box over the target casting a huge shadow that dims the
          rest; the transition animates the move between steps. With no target,
          a plain full-screen dim. */}
      {caixa ? (
        <div
          onClick={fechar}
          style={{
            position: "fixed",
            top: caixa.top,
            left: caixa.left,
            width: caixa.width,
            height: caixa.height,
            borderRadius: "var(--radius-card)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            outline: "2px solid var(--accent)",
            transition: "top 0.35s ease, left 0.35s ease, width 0.35s ease, height 0.35s ease",
            pointerEvents: "auto",
          }}
        />
      ) : (
        <div onClick={fechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          ...cardStyle,
          background: "var(--surface-page)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-block)",
          boxShadow: "var(--shadow-floating)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          animation: "idm-tour-fade 0.3s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
              {i + 1} de {total}
            </span>
            <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>{passo.titulo}</h2>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar o tour"
            style={{ display: "inline-flex", background: "transparent", border: "none", padding: "var(--space-1)", color: "var(--ink-secondary)", cursor: "pointer" }}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "var(--text-body)", color: "var(--ink-secondary)", lineHeight: 1.5 }}>
          {passo.corpo}
        </p>

        {/* Pontos de progresso, clicaveis. */}
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
          {PASSOS.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Ir ao passo ${n + 1}`}
              onClick={() => setI(n)}
              style={{
                width: 8,
                height: 8,
                padding: 0,
                borderRadius: "var(--radius-full)",
                border: "none",
                cursor: "pointer",
                background: n === i ? "var(--accent)" : "var(--gridline)",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={voltar}
            disabled={i === 0}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              background: "transparent",
              color: i === 0 ? "var(--ink-muted)" : "var(--ink-primary)",
              cursor: i === 0 ? "default" : "pointer",
              fontSize: "var(--text-body)",
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={ultimo ? fechar : avancar}
            style={{
              padding: "var(--space-2) var(--space-4)",
              border: "none",
              borderRadius: "var(--radius-control)",
              background: "var(--accent)",
              color: "var(--on-accent)",
              cursor: "pointer",
              fontSize: "var(--text-body)",
              fontWeight: 600,
            }}
          >
            {ultimo ? "Concluir" : "Avançar"}
          </button>
        </div>
      </div>
    </div>
  );
}
