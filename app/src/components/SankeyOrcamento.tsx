import { formatarPercentual, formatarReais } from "../lib/data";
import { EstadoVazio } from "./EstadoVazio";
import { Tooltip } from "./Tooltip";

interface FluxoEntrada {
  origem: string; // own tax and other transfers, or FPM
  valor: number; // reais
}

interface FluxoSaida {
  categoria: string; // large spending categories
  valor: number; // reais
}

// Median composition (fraction of total revenue) of municipalities sharing the
// same porte, used as the honest yardstick for the target municipality (see
// docs/DECISAO_CAUSAL.md: comparison is always by porte, never the national
// average).
interface ComposicaoReferencia {
  fracaoPropria: number; // 0..1
  fracaoFpm: number; // 0..1
}

interface SankeyOrcamentoProps {
  municipio: string; // codigo_ibge
  nomeMunicipio: string;
  ufMunicipio: string;
  entradas: FluxoEntrada[];
  composicaoReferencia: ComposicaoReferencia | null;
  saidas: FluxoSaida[];
  porteReferencia: string;
}

// Two colors from the existing blue family, reused across both bars so the
// same segment always reads the same color; no new hex is introduced (color
// always via token, per project rule).
// Two-part composition (own revenue vs FPM): the accent blue and a second
// categorical series in amber. The amber replaces the former pale idm-300, which
// failed contrast and chroma against the light surface; the pair is validated
// colorblind-safe and >= 3:1 on both surfaces (see --serie-2 in tokens.css).
const CORES_SEGMENTO = ["var(--accent)", "var(--serie-2)"];

// Budget flow (entra e sai), off the map. Rendered as 100%-stacked horizontal
// bars rather than a full Sankey (see docs/DASHBOARD.md, Tela 3): the "entra"
// side (own tax against FPM) is honest with the current data contract. The
// "sai" side (spending by category) needs FINBRA expense ingestion, not yet
// part of the pipeline; see the note below instead of fabricating numbers.
// Money is never an arrow on the territory (see docs/DECISAO_CAUSAL.md); the
// flow lives here, in Sankey-style grammar, always compared to the same porte.
export function SankeyOrcamento({
  municipio,
  nomeMunicipio,
  ufMunicipio,
  entradas,
  composicaoReferencia,
  saidas,
  porteReferencia,
}: SankeyOrcamentoProps) {
  if (entradas.length === 0) {
    return (
      <EstadoVazio mensagem="Sem dados de orçamento para este município." />
    );
  }

  const totalEntradas = entradas.reduce((soma, e) => soma + e.valor, 0);
  const segmentosAlvo: Segmento[] = entradas.map((e, i) => ({
    rotulo: e.origem,
    fracao: totalEntradas > 0 ? e.valor / totalEntradas : 0,
    valorReais: e.valor,
    cor: CORES_SEGMENTO[i % CORES_SEGMENTO.length] ?? "var(--accent)",
  }));

  const segmentosReferencia: Segmento[] | null = composicaoReferencia
    ? [
        {
          rotulo: "imposto próprio e outras transferências",
          fracao: composicaoReferencia.fracaoPropria,
          cor: CORES_SEGMENTO[0] ?? "var(--accent)",
        },
        {
          rotulo: "FPM (repasse da União)",
          fracao: composicaoReferencia.fracaoFpm,
          cor: CORES_SEGMENTO[1] ?? "var(--serie-2)",
        },
      ]
    : null;

  return (
    <section
      aria-label={`Fluxo do orçamento do município ${municipio}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <h3 style={{ fontSize: "var(--text-body)", color: "var(--ink-muted)", margin: 0 }}>
        entra: composição da receita
      </h3>

      <BarraEmpilhada
        rotulo={`${nomeMunicipio} (${ufMunicipio})`}
        segmentos={segmentosAlvo}
      />

      {segmentosReferencia ? (
        <BarraEmpilhada
          rotulo={`mediana do porte (${porteReferencia})`}
          segmentos={segmentosReferencia}
          muted
        />
      ) : (
        <p style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)", margin: 0 }}>
          Sem outros municípios do mesmo porte para comparar.
        </p>
      )}

      <div>
        <h3 style={{ fontSize: "var(--text-body)", color: "var(--ink-muted)", margin: 0 }}>
          sai: despesa por categoria
        </h3>
        {saidas.length === 0 ? (
          // TODO: ingest FINBRA expense data by category (see docs/DASHBOARD.md,
          // Tela 3) to populate this side. Without it, the panel shows only the
          // "entra" side, which the docs call the higher-value, lower-cost part
          // of the fiscal narrative.
          <p style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
            Ainda não disponível: a despesa por categoria depende de ingerir a
            base de despesa do FINBRA, fora do contrato de dado atual.
          </p>
        ) : (
          <BarraEmpilhada
            rotulo={`${nomeMunicipio} (${ufMunicipio})`}
            segmentos={segmentosSaida(saidas)}
          />
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "var(--text-caption)",
          color: "var(--ink-muted)",
        }}
      >
        comparado sempre ao mesmo porte ({porteReferencia}); descreve o tamanho
        da economia local, não a qualidade da prefeitura.
      </p>
    </section>
  );
}

// Kept ready for when the FINBRA expense contract lands; unused today because
// saidas is always empty (see the TODO above).
function segmentosSaida(saidas: FluxoSaida[]): Segmento[] {
  const total = saidas.reduce((soma, s) => soma + s.valor, 0);
  return saidas.map((s, i) => ({
    rotulo: s.categoria,
    fracao: total > 0 ? s.valor / total : 0,
    valorReais: s.valor,
    cor: CORES_SEGMENTO[i % CORES_SEGMENTO.length] ?? "var(--accent)",
  }));
}

interface Segmento {
  rotulo: string;
  fracao: number; // 0..1, width share of the bar
  valorReais?: number;
  cor: string;
}

function BarraEmpilhada({
  rotulo,
  segmentos,
  muted = false,
}: {
  rotulo: string;
  segmentos: Segmento[];
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span
        style={{
          fontSize: "var(--text-body)",
          color: muted ? "var(--ink-muted)" : "var(--ink-primary)",
        }}
      >
        {rotulo}
      </span>

      {/* Track: a single 100%-stacked bar, 24px thick per the mark spec, with a
          2px surface-color gap between segments instead of a border. */}
      <div
        aria-hidden
        style={{
          display: "flex",
          height: "var(--space-5)",
          borderRadius: "var(--radius-control)",
          overflow: "hidden",
        }}
      >
        {segmentos.map((seg, i) => (
          <Tooltip
            key={seg.rotulo}
            content={
              <span>
                {seg.rotulo}: {formatarPercentual(seg.fracao)}
                {seg.valorReais != null ? ` (${formatarReais(seg.valorReais)})` : ""}
              </span>
            }
          >
            <div
              style={{
                flexBasis: `${Math.max(0, seg.fracao) * 100}%`,
                background: seg.cor,
                opacity: muted ? 0.6 : 1,
                marginRight:
                  i < segmentos.length - 1 ? "2px" : undefined,
              }}
            />
          </Tooltip>
        ))}
      </div>

      {/* Direct labels sit below the bar, never inside a segment that might be
          too narrow to hold text (see marks-and-anatomy.md). */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          fontSize: "var(--text-caption)",
          color: "var(--ink-secondary)",
        }}
      >
        {segmentos.map((seg) => (
          <li key={seg.rotulo} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "var(--radius-full)",
                background: seg.cor,
              }}
            />
            {seg.rotulo} ({formatarPercentual(seg.fracao)})
          </li>
        ))}
      </ul>
    </div>
  );
}
