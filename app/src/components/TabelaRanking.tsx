import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { normalizar, rotuloPorte } from "../lib/data";
import type { Municipio, Tipologia } from "../lib/types";
import { BadgeTipologia } from "./BadgeTipologia";
import { EstadoVazio } from "./EstadoVazio";

interface TabelaRankingProps {
  dados: Municipio[];
  agruparPor: "tipologia" | "porte";
  busca: string;
  municipioSelecionado?: string;
}

type Coluna = "faixa" | "nome" | "tipologia" | "idm";

// Canonical display order for each grouping dimension. Tipologia follows the
// polo-to-orbitante hierarchy used by the map chips; porte follows population
// size, both read left to right as "least to most dependent context", not
// alphabetically.
export const ORDEM_TIPOLOGIA: Tipologia[] = ["polo", "semi-polo", "orbitante"];
export const ORDEM_PORTE = [
  "ate 5k",
  "5k a 20k",
  "20k a 50k",
  "50k a 100k",
  "100k a 500k",
  "acima de 500k",
];

const ROTULO_TIPOLOGIA: Record<Tipologia, string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

const NUM_COLUNAS = 5;

// Initial render cap per group, so a default view of the ~5500 municipalities
// does not paint thousands of rows at once. Applied per group (not to the flat
// list) so every tipologia or porte group stays represented in the first paint,
// with a single "ver todos" control to lift the cap. The CSV export always
// carries the full filtered set regardless of this cap.
const LIMITE_POR_GRUPO = 100;

// Orders a set of observed keys by a reference order, appending any unknown
// key (a label the pipeline did not anticipate) alphabetically at the end.
export function ordenarPorReferencia(
  chaves: Iterable<string>,
  referencia: readonly string[],
): string[] {
  const presentes = new Set(chaves);
  const conhecidas = referencia.filter((c) => presentes.has(c));
  const desconhecidas = [...presentes]
    .filter((c) => !referencia.includes(c))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...conhecidas, ...desconhecidas];
}

// Title "Grau de dependencia estrutural" and the fixed anti-distortion note
// live on the route (routes/ranking.tsx), directly under the page heading, per
// the Tela 4 wireframe. First column is the percentile band, never the ordinal
// position (no podium). Sortable and searchable; groupable by tipologia or
// porte with a group header row; the matched municipality row is highlighted;
// exports CSV.
export function TabelaRanking({
  dados,
  agruparPor,
  busca,
  municipioSelecionado,
}: TabelaRankingProps) {
  const [ordenarPor, setOrdenarPor] = useState<Coluna>("idm");
  const [ascendente, setAscendente] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const linhaDestaqueRef = useRef<HTMLTableRowElement | null>(null);

  // Exact-name match takes the searched city to the front even when other
  // partial matches remain visible; an explicit prop (the shared selection)
  // overrides it.
  const destacado = useMemo(
    () => municipioSelecionado ?? correspondenciaExata(dados, busca),
    [municipioSelecionado, dados, busca],
  );

  // Any change to the underlying slice or its arrangement drops back to the
  // capped initial render; expanding to "ver todos" is a per-view choice, not
  // a sticky preference that would silently re-render everything again.
  useEffect(() => {
    setMostrarTodos(false);
  }, [dados, busca, agruparPor]);

  // Bring the focused city into view: scroll to its row, and if it fell outside
  // the per-group cap, lift the cap first so the row exists to scroll to.
  useEffect(() => {
    if (!destacado) return;
    if (linhaDestaqueRef.current) {
      linhaDestaqueRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (!mostrarTodos) {
      setMostrarTodos(true);
    }
  }, [destacado, mostrarTodos, dados, busca, agruparPor, ordenarPor, ascendente]);

  const filtrado = useMemo(() => {
    const q = normalizar(busca);
    const base =
      q.length > 0 ? dados.filter((m) => normalizar(m.nome).includes(q)) : dados;
    const ordenado = [...base].sort((a, b) => {
      const cmp = comparar(a, b, ordenarPor);
      return ascendente ? cmp : -cmp;
    });
    return ordenado;
  }, [dados, busca, ordenarPor, ascendente]);

  if (filtrado.length === 0) {
    return (
      <EstadoVazio mensagem="Nenhum município corresponde à busca ou ao filtro atual." />
    );
  }

  const grupos = agrupar(filtrado, agruparPor);
  const algumGrupoTruncado =
    !mostrarTodos && grupos.some((g) => g.linhas.length > LIMITE_POR_GRUPO);

  const alternarOrdem = (col: Coluna) => {
    if (col === ordenarPor) setAscendente((v) => !v);
    else {
      setOrdenarPor(col);
      setAscendente(false);
    }
  };

  // aria-sort applies only to the currently active column ("ascending" or
  // "descending"); every other sortable header reports "none" so assistive
  // tech always knows the table is sortable, per WAI-ARIA table patterns.
  const ordenacaoDe = (col: Coluna): "ascending" | "descending" | "none" =>
    ordenarPor === col ? (ascendente ? "ascending" : "descending") : "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <p style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
        {filtrado.length} municípios, agrupados por {agruparPor}
        {algumGrupoTruncado ? `, mostrando até ${LIMITE_POR_GRUPO} por grupo` : ""}.
      </p>

      {/* Wide table scrolls inside its own container; the page never scrolls sideways. */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-body)",
          }}
        >
          <caption className="visually-hidden">
            {`Grau de dependência estrutural por município: ${filtrado.length} municípios, agrupados por ${agruparPor}. A faixa percentílica separa dependência estrutural de nota de gestão.`}
          </caption>
          <thead>
            <tr>
              <Th rotulo="faixa percentílica" onClick={() => alternarOrdem("faixa")} ordenacao={ordenacaoDe("faixa")} />
              <Th rotulo="município (UF)" onClick={() => alternarOrdem("nome")} ordenacao={ordenacaoDe("nome")} />
              <Th rotulo="tipologia" onClick={() => alternarOrdem("tipologia")} ordenacao={ordenacaoDe("tipologia")} />
              <Th
                rotulo="IDM"
                onClick={() => alternarOrdem("idm")}
                alinhar="right"
                ordenacao={ordenacaoDe("idm")}
              />
              <Th rotulo="barra" />
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => {
              const linhasVisiveis = mostrarTodos
                ? grupo.linhas
                : grupo.linhas.slice(0, LIMITE_POR_GRUPO);
              const truncado = linhasVisiveis.length < grupo.linhas.length;
              return (
              <Fragment key={grupo.chave}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={NUM_COLUNAS}
                    style={cabecalhoGrupo}
                  >
                    {grupo.rotulo}{" "}
                    <span className="tabular" style={{ color: "var(--ink-muted)" }}>
                      ({truncado
                        ? `${linhasVisiveis.length} de ${grupo.linhas.length}`
                        : grupo.linhas.length})
                    </span>
                  </th>
                </tr>
                {linhasVisiveis.map((m) => {
                  const emDestaque = m.codigo_ibge === destacado;
                  return (
                    <tr
                      key={m.codigo_ibge}
                      ref={emDestaque ? linhaDestaqueRef : undefined}
                      aria-current={emDestaque ? true : undefined}
                      style={{
                        background: emDestaque ? "var(--gridline)" : "transparent",
                        borderLeft: emDestaque
                          ? "3px solid var(--accent)"
                          : "3px solid transparent",
                        fontWeight: emDestaque ? "var(--weight-title)" : "var(--weight-body)",
                      }}
                    >
                      <td style={celula}>{faixaPercentilica(m.idm_percentil)}</td>
                      <td style={celula}>
                        {m.nome}{" "}
                        <span style={{ color: "var(--ink-muted)" }}>({m.uf})</span>
                      </td>
                      <td style={celula}>
                        <BadgeTipologia tipologia={m.tipologia} />
                      </td>
                      <td style={{ ...celula, textAlign: "right" }} className="tabular">
                        {m.idm.toFixed(2).replace(".", ",")}
                      </td>
                      <td style={celula}>
                        <BarraLinha valor={m.idm} />
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {algumGrupoTruncado ? (
        <button
          type="button"
          onClick={() => setMostrarTodos(true)}
          style={{
            alignSelf: "flex-start",
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-control)",
            background: "transparent",
            color: "var(--ink-primary)",
            fontSize: "var(--text-body)",
          }}
        >
          ver todos os {filtrado.length} municípios
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => exportarCsv(filtrado)}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
          background: "transparent",
          color: "var(--ink-primary)",
          fontSize: "var(--text-body)",
        }}
      >
        <Download size={16} aria-hidden /> exportar tabela (CSV)
      </button>
    </div>
  );
}

function comparar(a: Municipio, b: Municipio, col: Coluna): number {
  if (col === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
  if (col === "faixa") return a.idm_percentil - b.idm_percentil;
  if (col === "tipologia") {
    return ORDEM_TIPOLOGIA.indexOf(a.tipologia) - ORDEM_TIPOLOGIA.indexOf(b.tipologia);
  }
  return a.idm - b.idm;
}

// Percentile band, not ordinal position. Wording mirrors docs/DECISAO_UX.md
// ("entre os 25% mais dependentes"), read as quartiles of the IDM percentile.
function faixaPercentilica(percentil: number): string {
  if (percentil >= 0.75) return "entre os 25% mais dependentes";
  if (percentil >= 0.5) return "entre 25% e 50% mais dependentes";
  if (percentil >= 0.25) return "entre 50% e 75% mais dependentes";
  return "entre os 25% menos dependentes";
}

// The row of the searched municipality: an exact, accent- and case-insensitive
// name match against the full (unfiltered) universe, so it still resolves even
// when other partial matches share the query.
function correspondenciaExata(dados: Municipio[], busca: string): string | undefined {
  const q = normalizar(busca);
  if (q.length === 0) return undefined;
  return dados.find((m) => normalizar(m.nome) === q)?.codigo_ibge;
}

interface Grupo {
  chave: string;
  rotulo: string;
  linhas: Municipio[];
}

// Groups the already-filtered-and-sorted list by tipologia or porte, keeping
// the sort order within each group and presenting groups in a fixed, readable
// order rather than order-of-first-appearance.
function agrupar(lista: Municipio[], agruparPor: "tipologia" | "porte"): Grupo[] {
  const chaveDe = (m: Municipio): string =>
    agruparPor === "tipologia" ? m.tipologia : m.porte_faixa;
  const referencia = agruparPor === "tipologia" ? ORDEM_TIPOLOGIA : ORDEM_PORTE;
  const chaves = ordenarPorReferencia(lista.map(chaveDe), referencia);
  return chaves.map((chave) => ({
    chave,
    rotulo:
      agruparPor === "tipologia"
        ? ROTULO_TIPOLOGIA[chave as Tipologia]
        : capitalizar(rotuloPorte(chave)),
    linhas: lista.filter((m) => chaveDe(m) === chave),
  }));
}

function capitalizar(texto: string): string {
  return texto.length > 0 ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

const celula = {
  padding: "var(--space-2) var(--space-3)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
} as const;

const cabecalhoGrupo = {
  textAlign: "left",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--surface-1)",
  borderBottom: "1px solid var(--baseline)",
  borderTop: "1px solid var(--baseline)",
  color: "var(--ink-primary)",
  fontWeight: "var(--weight-title)",
} as const;

// Sortable column header. scope="col" is always set (required on every data
// header, sortable or not); aria-sort is set only on sortable columns so
// assistive tech reports the table as sortable without misdescribing the
// decorative "barra" column. The sort control is a native button, so Enter
// and Space already trigger it without extra keyboard wiring.
function Th({
  rotulo,
  onClick,
  alinhar = "left",
  ordenacao,
}: {
  rotulo: string;
  onClick?: () => void;
  alinhar?: "left" | "right";
  ordenacao?: "ascending" | "descending" | "none";
}) {
  const direcao =
    ordenacao === "ascending" ? "crescente" : ordenacao === "descending" ? "decrescente" : undefined;
  return (
    <th
      scope="col"
      aria-sort={ordenacao}
      style={{
        textAlign: alinhar,
        padding: "var(--space-2) var(--space-3)",
        borderBottom: "1px solid var(--baseline)",
        color: "var(--ink-secondary)",
        fontWeight: "var(--weight-title)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={onClick ? `ordenar por ${rotulo}${direcao ? `, ordem ${direcao}` : ""}` : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          background: "transparent",
          border: "none",
          color: "inherit",
          font: "inherit",
          cursor: onClick ? "pointer" : "default",
          padding: 0,
        }}
      >
        {rotulo}
        {ordenacao === "ascending" ? (
          <ChevronUp size={14} aria-hidden />
        ) : ordenacao === "descending" ? (
          <ChevronDown size={14} aria-hidden />
        ) : null}
      </button>
    </th>
  );
}

function BarraLinha({ valor }: { valor: number }) {
  const pct = Math.max(0, Math.min(1, valor)) * 100;
  return (
    <div
      aria-hidden
      style={{
        minWidth: "80px",
        height: "var(--space-2)",
        background: "var(--gridline)",
        borderRadius: "var(--radius-full)",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--idm-500)",
          borderRadius: "var(--radius-full)",
        }}
      />
    </div>
  );
}

// CSV export for the transparency requirement. Built in memory; no server.
// Mirrors the visible columns plus the grouping field. Always exports the
// full filtered-and-sorted set, independent of the on-screen per-group render
// cap (LIMITE_POR_GRUPO), so every matching municipality stays reachable even
// when the initial paint is capped for performance.
function exportarCsv(dados: Municipio[]): void {
  const cabecalho = [
    "codigo_ibge",
    "nome",
    "uf",
    "tipologia",
    "porte_faixa",
    "idm",
    "idm_percentil",
  ];
  const linhas = dados.map((m) =>
    [
      m.codigo_ibge,
      escaparCsv(m.nome),
      m.uf,
      m.tipologia,
      escaparCsv(m.porte_faixa),
      m.idm,
      m.idm_percentil,
    ].join(","),
  );
  const conteudo = [cabecalho.join(","), ...linhas].join("\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ranking-idm.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function escaparCsv(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}
