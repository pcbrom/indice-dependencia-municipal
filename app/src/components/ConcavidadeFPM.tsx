import * as Plot from "@observablehq/plot";
import { useEffect, useMemo, useRef, useState } from "react";
import { coeficienteFpm, FAIXAS_FPM } from "../lib/fpm";
import type { Municipio } from "../lib/types";

// Illustrative adjacent pair (Rondonia): Cabixi (1100031) and Pimenteiras do
// Oeste (1101468) share a border (verified against malha.geojson touches); both
// sit in the minimum FPM band, and merged they stay under the first bound, so
// the summed coefficient 1.2 collapses onto 0.6. Editorial choice named in
// docs/DECISAO_CENARIOS.md; the FPM figures below are computed from the loaded
// municipios.json, not asserted. It is one example, never a national frequency.
const PAR_ILUSTRATIVO = ["1100031", "1101468"] as const;

function popDe(m: Municipio): number {
  return m.populacao_estimada ?? m.populacao;
}

function formatarReais(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

interface ExemploFusao {
  a: Municipio;
  b: Municipio;
  coefA: number;
  coefB: number;
  coefSomado: number;
  coefFundido: number;
  fpmSomado: number;
  fpmFundido: number;
  perda: number;
  fracaoPerdida: number;
}

// Value of one coefficient point is constant across a state's municipalities
// (the state pool is split in proportion to coefficients). Estimated here from
// the pair's own FPM so the worked figure comes from the data, not a constant:
// per-point = (fpm_a + fpm_b) / (coef_a + coef_b). The merged municipality would
// draw coef(combined population) points; the difference redistributes to the
// other municipalities of the same state, it is not saved by the Union.
function montarExemplo(municipios: Municipio[]): ExemploFusao | null {
  const [ca, cb] = PAR_ILUSTRATIVO;
  const a = municipios.find((m) => m.codigo_ibge === ca);
  const b = municipios.find((m) => m.codigo_ibge === cb);
  if (!a || !b) return null;
  const coefA = coeficienteFpm(popDe(a));
  const coefB = coeficienteFpm(popDe(b));
  const coefSomado = coefA + coefB;
  const coefFundido = coeficienteFpm(popDe(a) + popDe(b));
  const fpmSomado = a.fpm + b.fpm;
  const porPonto = coefSomado > 0 ? fpmSomado / coefSomado : 0;
  const fpmFundido = porPonto * coefFundido;
  const perda = fpmSomado - fpmFundido;
  return {
    a, b, coefA, coefB, coefSomado, coefFundido, fpmSomado, fpmFundido,
    perda, fracaoPerdida: fpmSomado > 0 ? perda / fpmSomado : 0,
  };
}

// Step points for the coefficient curve: population on a log axis against the
// coefficient, drawn as a staircase so the discrete bands read as steps. A dense
// sample per band keeps the horizontal treads flat under the log scale.
function pontosCurva(): { populacao: number; coeficiente: number }[] {
  const pts: { populacao: number; coeficiente: number }[] = [];
  let anterior = 2000;
  for (const [limite, coef] of FAIXAS_FPM) {
    const topo = Number.isFinite(limite) ? limite : 220000;
    const passo = (topo - anterior) / 6;
    for (let p = anterior; p <= topo; p += Math.max(1, passo)) {
      pts.push({ populacao: p, coeficiente: coef });
    }
    pts.push({ populacao: topo, coeficiente: coef });
    anterior = topo;
  }
  return pts;
}

interface ConcavidadeFPMProps {
  municipios: Municipio[];
}

// Static, descriptive block on the fiscal screen: the concavity of the FPM
// coefficient. It shows why the transfer rewards fragmentation, merging two
// small municipalities collapses the summed coefficient onto a single lower one,
// so the region draws roughly half of what the two drew apart. It is arithmetic
// of the standing rule, not a recommendation; the loss redistributes to the
// other municipalities of the state, and the Union pays the same either way.
// Criterion-free (population band only), permanent abstract mode. See
// docs/DECISAO_CENARIOS.md.
export function ConcavidadeFPM({ municipios }: ConcavidadeFPMProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [largura, setLargura] = useState(720);
  const curva = useMemo(pontosCurva, []);
  const exemplo = useMemo(() => montarExemplo(municipios), [municipios]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setLargura(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!host.current) return;
    // Markers for the worked example: the two municipalities apart (summed) and
    // the single point they would collapse to if merged.
    const marcas = exemplo
      ? [
          { populacao: popDe(exemplo.a), coeficiente: exemplo.coefA, rotulo: exemplo.a.nome },
          { populacao: popDe(exemplo.b), coeficiente: exemplo.coefB, rotulo: exemplo.b.nome },
          {
            populacao: popDe(exemplo.a) + popDe(exemplo.b),
            coeficiente: exemplo.coefFundido,
            rotulo: "fundido",
          },
        ]
      : [];

    const grafico = Plot.plot({
      width: largura,
      height: 340,
      marginLeft: 48,
      marginBottom: 44,
      style: { background: "transparent", color: "var(--ink-secondary)", fontSize: "12px" },
      x: {
        label: "população do município",
        type: "log",
        domain: [2000, 220000],
        tickFormat: (t: number) =>
          t >= 1000 ? `${Math.round(t / 1000)} mil` : `${t}`,
      },
      y: {
        label: "coeficiente do FPM",
        domain: [0, 4.2],
        ticks: [0.6, 1, 2, 3, 4],
        grid: false,
      },
      marks: [
        Plot.gridY({ stroke: "var(--gridline)" }),
        // The 0.6 floor, the smallest band that all small municipalities share.
        Plot.ruleY([0.6], { stroke: "var(--baseline)", strokeWidth: 1.5, strokeDasharray: "6 4" }),
        Plot.text(
          [{ x: 220000, y: 0.6 }],
          { x: "x", y: "y", dy: -8, textAnchor: "end", text: () => "piso 0,6", fill: "var(--ink-muted)" },
        ),
        // The staircase of the coefficient by population band.
        Plot.line(curva, {
          x: "populacao",
          y: "coeficiente",
          curve: "step-after",
          stroke: "var(--accent)",
          strokeWidth: 2,
        }),
        // Worked example: the two municipalities apart and the merged point.
        Plot.dot(marcas, {
          x: "populacao",
          y: "coeficiente",
          r: 5,
          fill: (d: { rotulo: string }) => (d.rotulo === "fundido" ? "var(--idm-700)" : "var(--ink-primary)"),
          stroke: "var(--surface-page)",
          strokeWidth: 1.5,
        }),
        Plot.text(marcas, {
          x: "populacao",
          y: "coeficiente",
          text: "rotulo",
          dy: -12,
          fontSize: 11,
          fontWeight: 600,
          fill: "var(--ink-secondary)",
          stroke: "var(--surface-page)",
          strokeWidth: 3,
        }),
      ],
    });
    host.current.replaceChildren(grafico);
    return () => grafico.remove();
  }, [curva, largura, exemplo]);

  const rotulo =
    "Coeficiente do FPM por faixa de população, uma escada de 0,6 a 4,0. " +
    "Municípios pequenos ficam todos no piso de 0,6; somar dois deles não soma " +
    "os coeficientes, o município fundido volta ao patamar de um só.";

  return (
    <section
      aria-label="Concavidade do coeficiente do FPM"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>
          Por que o FPM recompensa a fragmentação
        </h2>
        <p style={{ margin: 0, color: "var(--ink-secondary)", maxWidth: "70ch" }}>
          O repasse por habitante segue um coeficiente em degraus. Municípios
          pequenos ficam todos no piso de 0,6, então dois vizinhos separados
          somam 1,2; fundidos, o município único volta ao piso de 0,6 e a região
          passa a receber cerca de metade do que recebia dividida. É a aritmética
          da regra vigente, não uma recomendação.
        </p>
      </div>

      <div ref={host} role="img" aria-label={rotulo} />

      {exemplo ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            padding: "var(--space-3)",
            background: "var(--surface-page)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-control)",
          }}
        >
          <strong style={{ fontSize: "var(--text-body)", color: "var(--ink-primary)" }}>
            Exemplo: {exemplo.a.nome} e {exemplo.b.nome} ({exemplo.a.uf}), vizinhos
          </strong>
          <p style={{ margin: 0, fontSize: "var(--text-body)", color: "var(--ink-secondary)", maxWidth: "70ch" }}>
            Separados, os dois somam coeficiente {formatarCoef(exemplo.coefSomado)} e
            recebem {formatarReais(exemplo.fpmSomado)} de FPM ao ano. Fundidos, o
            município único cai ao coeficiente {formatarCoef(exemplo.coefFundido)} e
            passaria a receber cerca de {formatarReais(exemplo.fpmFundido)}, uma
            redução da ordem de {formatarReais(exemplo.perda)} por ano
            ({(exemplo.fracaoPerdida * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%).
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)", maxWidth: "70ch" }}>
            Essa diferença não é economizada pela União: o bolo estadual do FPM é
            fixo, então o que a região deixa de receber é redistribuído aos demais
            municípios do mesmo estado. Um exemplo ilustrativo, não uma frequência
            nacional; a economia de câmara de um município pequeno, medida no
            Siconfi, fica na ordem de R$ 2,5 milhões ao ano, muito abaixo da perda
            de FPM de uma fusão.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function formatarCoef(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
