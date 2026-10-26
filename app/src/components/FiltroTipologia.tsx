import type { Tipologia } from "../lib/types";

interface ClasseChip {
  classe: Tipologia;
  contagem: number;
  ativa: boolean;
}

interface FiltroTipologiaProps {
  classes: ClasseChip[];
  onToggle: (classe: Tipologia) => void;
}

// Three chips with a count that light up and turn off classes. Tipologia is a
// filter, not a mark on the point (see docs/DECISAO_UX.md). Correct use of a
// three-level categorical variable.
// Exported so routes/mapa.tsx can reuse the same label in the table
// alternative (AlternaGraficoTabela) without duplicating the mapping.
export const ROTULO_TIPOLOGIA: Record<Tipologia, string> = {
  polo: "Polos",
  "semi-polo": "Semi-polos",
  orbitante: "Orbitantes",
};

export function FiltroTipologia({ classes, onToggle }: FiltroTipologiaProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por tipologia"
      style={{
        display: "flex",
        gap: "var(--space-2)",
        flexWrap: "wrap",
      }}
    >
      {classes.map(({ classe, contagem, ativa }) => (
        <button
          key={classe}
          type="button"
          aria-pressed={ativa}
          aria-label={`${ROTULO_TIPOLOGIA[classe]}, ${contagem} municípios${ativa ? ", filtro ativo" : ""}`}
          onClick={() => onToggle(classe)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            whiteSpace: "nowrap",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-full)",
            border: "1px solid var(--border)",
            fontSize: "var(--text-body)",
            color: ativa ? "var(--on-accent)" : "var(--ink-secondary)",
            background: ativa ? "var(--accent)" : "transparent",
          }}
        >
          {ROTULO_TIPOLOGIA[classe]}
          <span
            className="tabular"
            aria-hidden
            style={{
              fontSize: "var(--text-caption)",
              opacity: 0.85,
            }}
          >
            {contagem}
          </span>
        </button>
      ))}
    </div>
  );
}
