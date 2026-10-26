import { useMemo } from "react";
import { rotuloPorte } from "../lib/data";
import { compararComPares } from "../lib/pares";
import type { Municipio } from "../lib/types";

// Peer comparison table plus the most comparable cities, shared by the map side
// panel and the printed one-page report. Same porte, medians, no grade.

function num2(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function ComparacaoPares({
  municipio,
  municipios,
  compacto = false,
}: {
  municipio: Municipio;
  municipios: Municipio[];
  compacto?: boolean;
}) {
  const c = useMemo(() => compararComPares(municipio, municipios), [municipio, municipios]);
  const linhas: { rotulo: string; proprio: string; brasil: string; uf?: string }[] = [
    { rotulo: "IDM", proprio: num2(municipio.idm), brasil: num2(c.brasil.idm), uf: c.uf ? num2(c.uf.idm) : undefined },
    {
      rotulo: "FPM na receita",
      proprio: pct(municipio.razao_fpm_receita),
      brasil: pct(c.brasil.fpm),
      uf: c.uf ? pct(c.uf.fpm) : undefined,
    },
    {
      rotulo: "Receita / PIB",
      proprio: num2(municipio.razao_receita_pib),
      brasil: num2(c.brasil.pib),
      uf: c.uf ? num2(c.uf.pib) : undefined,
    },
  ];
  const fonte = compacto ? "var(--text-caption)" : undefined;
  return (
    <div className="comparacao-pares" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fonte }}>
        <caption style={{ textAlign: "left", fontSize: "var(--text-caption)", color: "var(--ink-muted)", paddingBottom: "2px" }}>
          Mediana dos municípios de porte {rotuloPorte(municipio.porte_faixa)}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left", fontWeight: 400 }} />
            <th scope="col" style={{ textAlign: "right" }}>{municipio.nome}</th>
            <th scope="col" style={{ textAlign: "right", fontWeight: 400 }}>Brasil</th>
            {c.uf && <th scope="col" style={{ textAlign: "right", fontWeight: 400 }}>{municipio.uf}</th>}
          </tr>
        </thead>
        <tbody className="tabular">
          {linhas.map((l) => (
            <tr key={l.rotulo}>
              <th scope="row" style={{ textAlign: "left", fontWeight: 400 }}>{l.rotulo}</th>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{l.proprio}</td>
              <td style={{ textAlign: "right" }}>{l.brasil}</td>
              {c.uf && <td style={{ textAlign: "right" }}>{l.uf}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {c.comparaveis.length > 0 && (
        <p style={{ margin: 0, fontSize: fonte }}>
          <strong>Comparáveis no estado:</strong>{" "}
          {c.comparaveis.map((x, i) => (
            <span key={x.codigo_ibge}>
              {i > 0 ? (i === c.comparaveis.length - 1 ? " e " : ", ") : ""}
              {x.nome} (IDM {num2(x.idm)})
            </span>
          ))}
          , de mesmo porte e população mais próxima.
        </p>
      )}
      <p className="comparacao-nota" style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
        Posição frente a cidades de tamanho parecido, para comparar experiências; não avalia a gestão.
      </p>
    </div>
  );
}
