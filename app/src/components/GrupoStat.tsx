import type { FonteRef } from "../lib/types";
import { SeloFonte } from "./SeloFonte";
import { StatTile, type StatTileProps } from "./StatTile";

interface GrupoStatProps {
  titulo: string; // grouped by citizen question
  tiles: StatTileProps[];
  fonte: FonteRef;
}

// Groups tiles by a citizen question ("Para onde a vida vai", "Quem paga a
// prefeitura", "O que a cidade tem"). The source collapses to a single
// SeloFonte at the foot of the group.
export function GrupoStat({ titulo, tiles, fonte }: GrupoStatProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <h2 style={{ fontSize: "var(--text-lg)" }}>{titulo}</h2>
      <div>
        {tiles.map((t, i) => (
          <StatTile key={`${t.rotuloComum}-${i}`} {...t} />
        ))}
      </div>
      <SeloFonte fonte={fonte.nome} dataExtracao={fonte.data_extracao} />
    </section>
  );
}
