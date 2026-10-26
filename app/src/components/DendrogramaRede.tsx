import { useEffect, useMemo, useRef, useState } from "react";
import type { NoRede } from "../lib/rede";

interface DendrogramaRedeProps {
  raiz: NoRede;
  // Codigos of the nodes whose children are shown. Lifted to the route so the
  // SVG chart and the accessible table share one source of truth (keyboard
  // users expand in the table, sighted users in the chart).
  expandidos: Set<string>;
  onAlternar: (codigo: string) => void;
}

// Spectral IDM ramp (docs/TOKENS.md), resolved with color-mix over the tokens
// so the node fill tracks a live theme switch and never carries a literal.
const PARADAS = [
  { t: 0, c: "--idm-100" },
  { t: 0.25, c: "--idm-300" },
  { t: 0.5, c: "--idm-450" },
  { t: 0.75, c: "--idm-600" },
  { t: 1, c: "--idm-700" },
] as const;

function corIdm(v: number): string {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 1; i < PARADAS.length; i++) {
    const p1 = PARADAS[i];
    const p0 = PARADAS[i - 1];
    if (!p1 || !p0) continue;
    if (x <= p1.t) {
      const peso = p1.t > p0.t ? (x - p0.t) / (p1.t - p0.t) : 0;
      return `color-mix(in srgb, var(${p1.c}) ${(peso * 100).toFixed(1)}%, var(${p0.c}))`;
    }
  }
  const ultima = PARADAS[PARADAS.length - 1];
  return `var(${ultima ? ultima.c : "--idm-700"})`;
}

interface NoPosicionado {
  no: NoRede;
  profundidade: number;
  linha: number;
  temFilhos: boolean;
  expandido: boolean;
  x: number;
  y: number;
}

const LINHA_PX = 24;
const NIVEL_PX = 210;
const MARGEM = 20;
const RAIO = 5;

// Cluster (dendrogram) layout, computed directly: leaves fall on evenly spaced
// rows and every internal node sits at the mean row of its children. Depth maps
// to the horizontal axis. Only the currently expanded subtree is laid out, so
// the diagram scales to any hub without drawing thousands of nodes at once.
function calcularLayout(raiz: NoRede, expandidos: Set<string>): {
  nos: NoPosicionado[];
  arestas: { o: NoPosicionado; d: NoPosicionado }[];
  largura: number;
  altura: number;
} {
  const nos: NoPosicionado[] = [];
  const arestas: { o: NoPosicionado; d: NoPosicionado }[] = [];
  let folha = 0;
  let profundidadeMax = 0;

  const percorrer = (no: NoRede, profundidade: number): NoPosicionado => {
    profundidadeMax = Math.max(profundidadeMax, profundidade);
    const temFilhos = no.filhos.length > 0;
    const expandido = temFilhos && expandidos.has(no.codigo);
    const pos: NoPosicionado = {
      no,
      profundidade,
      linha: 0,
      temFilhos,
      expandido,
      x: 0,
      y: 0,
    };
    if (!expandido) {
      pos.linha = folha++;
    } else {
      const filhos = no.filhos.map((f) => percorrer(f, profundidade + 1));
      const primeiro = filhos[0];
      const ultimo = filhos[filhos.length - 1];
      pos.linha =
        primeiro && ultimo ? (primeiro.linha + ultimo.linha) / 2 : folha++;
      for (const fp of filhos) arestas.push({ o: pos, d: fp });
    }
    pos.x = MARGEM + profundidade * NIVEL_PX;
    pos.y = MARGEM + pos.linha * LINHA_PX;
    nos.push(pos);
    return pos;
  };

  percorrer(raiz, 0);
  const largura = MARGEM * 2 + profundidadeMax * NIVEL_PX + 260;
  const altura = MARGEM * 2 + Math.max(folha - 1, 0) * LINHA_PX;
  return { nos, arestas, largura, altura };
}

const ROTULO_TIPOLOGIA: Record<NoRede["tipologia"], string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

function formatarIdm(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

// Full node detail, shown as a native SVG tooltip on hover and carried in the
// aria-label of the interactive nodes: the information that used to live in the
// separate table, folded into the single interactive graphic.
function tituloNo(pos: NoPosicionado): string {
  const base = `${pos.no.nome} (${pos.no.uf}): IDM ${formatarIdm(pos.no.idm)}, ${ROTULO_TIPOLOGIA[pos.no.tipologia]}`;
  if (!pos.temFilhos) return base;
  return `${base}, ${pos.no.totalDescendentes} dependentes (clique para ${pos.expandido ? "recolher" : "expandir"})`;
}

// Dependency dendrogram: the tree of who depends on the selected city, drawn as
// an SVG cluster with nodes colored by IDM. A node with dependents toggles its
// branch on click; the accessible, keyboard-operable equivalent is the table
// alternative (TabelaRede), which shares the same expanded state.
export function DendrogramaRede({ raiz, expandidos, onAlternar }: DendrogramaRedeProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [larguraHost, setLarguraHost] = useState(720);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver((entradas) => {
      const l = entradas[0]?.contentRect.width;
      if (l && l > 0) setLarguraHost(l);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { nos, arestas, largura, altura } = useMemo(
    () => calcularLayout(raiz, expandidos),
    [raiz, expandidos],
  );

  const larguraSvg = Math.max(largura, larguraHost);

  return (
    <div ref={host} style={{ overflow: "auto", maxHeight: "70vh" }}>
      <svg
        width={larguraSvg}
        height={altura}
        role="img"
        aria-label={`Dendrograma da rede de dependência de ${raiz.nome} (${raiz.uf}); ${raiz.totalDescendentes} municípios dependem direta ou indiretamente. Use a tabela para navegar pelo teclado.`}
        style={{ display: "block", fontFamily: "var(--font-sans)" }}
      >
        {arestas.map(({ o, d }) => (
          <path
            key={`${o.no.codigo}-${d.no.codigo}`}
            d={`M${o.x},${o.y} C${(o.x + d.x) / 2},${o.y} ${(o.x + d.x) / 2},${d.y} ${d.x},${d.y}`}
            fill="none"
            stroke="var(--baseline)"
            strokeWidth={1}
          />
        ))}
        {nos.map((pos) => {
          const interativo = pos.temFilhos;
          return (
            <g
              key={pos.no.codigo}
              transform={`translate(${pos.x},${pos.y})`}
              role={interativo ? "button" : undefined}
              tabIndex={interativo ? 0 : undefined}
              aria-expanded={interativo ? pos.expandido : undefined}
              aria-label={interativo ? tituloNo(pos) : undefined}
              onClick={interativo ? () => onAlternar(pos.no.codigo) : undefined}
              onKeyDown={
                interativo
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAlternar(pos.no.codigo);
                      }
                    }
                  : undefined
              }
              style={{ cursor: interativo ? "pointer" : "default" }}
            >
              <title>{tituloNo(pos)}</title>
              <circle
                r={RAIO}
                fill={corIdm(pos.no.idm)}
                stroke="var(--surface-1)"
                strokeWidth={1.5}
              />
              {interativo && (
                <text
                  x={0}
                  y={0}
                  dy="0.32em"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--on-accent)"
                  style={{ pointerEvents: "none" }}
                >
                  {pos.expandido ? "−" : "+"}
                </text>
              )}
              <text
                x={RAIO + 6}
                dy="0.32em"
                fontSize="12"
                fill="var(--ink-primary)"
                style={{ pointerEvents: "none" }}
              >
                {pos.no.nome} ({pos.no.uf})
                <tspan dx="6" fontSize="11" fill="var(--ink-muted)">
                  IDM {formatarIdm(pos.no.idm)}
                </tspan>
                {pos.temFilhos && !pos.expandido && (
                  <tspan dx="6" fontSize="11" fill="var(--ink-muted)">
                    +{pos.no.totalDescendentes}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Accessible, keyboard-operable equivalent of the dendrogram: a nested tree of
// the same expanded state. Screen-reader and keyboard users expand branches
// here; the change is reflected in the chart through the shared state.
export function TabelaRede({ raiz, expandidos, onAlternar }: DendrogramaRedeProps) {
  return (
    <ul role="tree" aria-label={`Rede de dependência de ${raiz.nome}`} style={listaRaizStyle}>
      <ItemRede no={raiz} nivel={1} expandidos={expandidos} onAlternar={onAlternar} />
    </ul>
  );
}

function ItemRede({
  no,
  nivel,
  expandidos,
  onAlternar,
}: {
  no: NoRede;
  nivel: number;
  expandidos: Set<string>;
  onAlternar: (codigo: string) => void;
}) {
  const temFilhos = no.filhos.length > 0;
  const expandido = temFilhos && expandidos.has(no.codigo);
  return (
    <li role="treeitem" aria-expanded={temFilhos ? expandido : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {temFilhos ? (
          <button
            type="button"
            onClick={() => onAlternar(no.codigo)}
            aria-label={`${expandido ? "Recolher" : "Expandir"} ${no.nome}`}
            style={botaoStyle}
          >
            {expandido ? "−" : "+"}
          </button>
        ) : (
          <span aria-hidden style={{ width: "var(--space-5)" }} />
        )}
        <span style={{ fontSize: "var(--text-body)" }}>
          {no.nome} <span style={{ color: "var(--ink-muted)" }}>({no.uf})</span>
        </span>
        <span className="tabular" style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
          IDM {no.idm.toFixed(2).replace(".", ",")}
          {temFilhos ? ` · ${no.totalDescendentes} dependentes` : ""}
        </span>
      </div>
      {expandido && (
        <ul role="group" style={{ listStyle: "none", margin: 0, paddingLeft: "var(--space-5)" }}>
          {no.filhos.map((f) => (
            <ItemRede
              key={f.codigo}
              no={f}
              nivel={nivel + 1}
              expandidos={expandidos}
              onAlternar={onAlternar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const listaRaizStyle = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
} as const;

const botaoStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "var(--space-5)",
  height: "var(--space-5)",
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-control)",
  background: "var(--surface-1)",
  color: "var(--ink-primary)",
  cursor: "pointer",
  fontSize: "var(--text-body)",
  lineHeight: "1",
} as const;
