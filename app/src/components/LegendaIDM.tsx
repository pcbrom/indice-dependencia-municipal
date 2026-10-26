import type { EscalaIDM } from "../lib/types";

interface LegendaIDMProps {
  escala: EscalaIDM;
}

// One-line legend, sticky above the map: the spectral ramp (blue to red) plus
// "blue = less dependent, red = more dependent". The map has a single color
// channel, the IDM.
export function LegendaIDM({ escala }: LegendaIDMProps) {
  return (
    <div
      role="group"
      aria-label={`Legenda do IDM, escala de ${escala.min} a ${escala.max}, azul significa menos dependente e vermelho significa mais dependente`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--surface-page)",
        borderBottom: "1px solid var(--border)",
        fontSize: "var(--text-caption)",
        color: "var(--ink-secondary)",
      }}
    >
      <span>IDM {escala.min}</span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: "var(--space-2)",
          borderRadius: "var(--radius-full)",
          background:
            "linear-gradient(90deg, var(--idm-100), var(--idm-450), var(--idm-700))",
        }}
      />
      <span>{escala.max}</span>
      <span style={{ color: "var(--ink-muted)" }}>azul = menos dependente · vermelho = mais dependente</span>
    </div>
  );
}
