interface BarraIDMProps {
  valor: number; // 0..1, the municipality marker position
  percentil: number; // 0..1, percentile rank
  mediana: number; // 0..1, national median tick
}

// Proportional 0..1 bar with the municipality marker and the median tick.
// Textual anchors at the ends carry the lay reading: self-sufficient at the
// left, orbiting at the right. Same ramp as ranking, decomposition and legend.
export function BarraIDM({ valor, percentil, mediana }: BarraIDMProps) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const posValor = clamp(valor) * 100;
  const posMediana = clamp(mediana) * 100;

  return (
    <div>
      <div
        role="img"
        aria-label={`IDM ${valor.toFixed(2)}, no percentil ${Math.round(
          percentil * 100,
        )}, mediana nacional ${mediana.toFixed(2)}`}
        style={{
          position: "relative",
          height: "var(--space-3)",
          borderRadius: "var(--radius-full)",
          background:
            "linear-gradient(90deg, var(--idm-100), var(--idm-400), var(--idm-700))",
        }}
      >
        {/* Median tick */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: `${posMediana}%`,
            top: "-25%",
            height: "150%",
            width: "2px",
            background: "var(--baseline)",
          }}
        />
        {/* Municipality marker */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: `${posValor}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "var(--space-3)",
            height: "var(--space-3)",
            borderRadius: "var(--radius-full)",
            background: "var(--surface-1)",
            border: "2px solid var(--ink-primary)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "var(--space-1)",
          fontSize: "var(--text-caption)",
          color: "var(--ink-muted)",
        }}
      >
        <span>autossuficiente</span>
        <span>orbitante</span>
      </div>
    </div>
  );
}
