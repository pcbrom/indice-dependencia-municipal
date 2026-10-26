import { BarraIDM } from "./BarraIDM";

interface BlocoHeroiIDMProps {
  idm: number;
  percentil: number; // 0..1
  mediana: number; // 0..1
}

// First fold of the profile. The hero number, the percentile sentence, the
// BarraIDM and the fixed anti-distortion line, and nothing else above the fold.
// On a 360px viewport the hero never shares the fold with the stat tiles.
export function BlocoHeroiIDM({ idm, percentil, mediana }: BlocoHeroiIDMProps) {
  const pct = Math.round(percentil * 100);
  return (
    <section
      aria-label="Índice de dependência municipal"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-6) var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-block)",
      }}
    >
      <div>
        <div style={{ fontSize: "var(--text-body)", color: "var(--ink-muted)" }}>
          IDM
        </div>
        <div
          style={{
            fontSize: "var(--text-hero)",
            fontWeight: "var(--weight-title)",
            lineHeight: "var(--leading-title)",
          }}
        >
          {idm.toFixed(2).replace(".", ",")}
        </div>
        <p style={{ fontSize: "var(--text-lg)", color: "var(--ink-secondary)" }}>
          mais dependente que {pct}% dos municípios do país
        </p>
      </div>

      <BarraIDM valor={idm} percentil={percentil} mediana={mediana} />

      <p style={{ color: "var(--ink-secondary)", maxWidth: "60ch" }}>
        O IDM mede o quanto a vida e as contas dependem de fora. Não avalia a
        gestão da prefeitura.
      </p>
    </section>
  );
}
