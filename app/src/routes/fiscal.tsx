import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlternaGraficoTabela,
  BuscaMunicipio,
  ConcavidadeFPM,
  DispersaoFiscal,
  EstadoCarregando,
  EstadoVazio,
  SankeyOrcamento,
  SeloFonte,
} from "../components";
import {
  carregarManifesto,
  carregarMunicipios,
  formatarPercentual,
  medianasPorPorteFiscal,
  quadranteFiscal,
  rotuloPorte as bandaPorte,
} from "../lib/data";
import type { CortesPorte } from "../lib/data";
import { useSelecao } from "../lib/selecao";
import { useInterpretacao } from "../lib/interpretacao";
import { LeituraFatia } from "../components/LeituraAutomatica";
import type { FonteRef, Manifesto, Municipio } from "../lib/types";

// The four fiscal quadrants, for the table's filter-by-label control.
const QUADRANTES: { chave: string; rotulo: string }[] = [
  { chave: "base-propria", rotulo: "Base própria robusta" },
  { chave: "orcamento-repasse", rotulo: "Orçamento sustentado pelo repasse" },
  { chave: "autonomo", rotulo: "Autônomo e enxuto" },
  { chave: "dependente", rotulo: "Dependente do repasse" },
];

const PORTE_TODOS = "todos";

// Tela 3: fiscal axis. Two pieces: the national scatter (revenue/GDP against the
// FPM share) and, for the selected municipality, the budget flow in Sankey
// grammar. Money is never an arrow on the territory (see docs/DECISAO_CAUSAL.md).
export default function Fiscal() {
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
  // The analyzed municipality is the shared focus (persists across tabs); until
  // a city is focused, a local default keeps the Sankey populated without
  // writing a global selection just for visiting this screen.
  const { codigo: codigoFoco, selecionar } = useSelecao();
  const [padraoLocal, setPadraoLocal] = useState<string | undefined>();
  const selecionado = codigoFoco ?? padraoLocal;
  const interpretacao = useInterpretacao(selecionado);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [porteFiltro, setPorteFiltro] = useState<string>(PORTE_TODOS);

  useEffect(() => {
    let vivo = true;
    carregarMunicipios()
      .then((m) => vivo && setMunicipios(m))
      .catch(() => vivo && setMunicipios([]));
    return () => {
      vivo = false;
    };
  }, []);

  // Provenance for the scatter, loaded independently: the figure still renders
  // if the manifest is slow or unavailable, the SeloFonte pair simply waits.
  useEffect(() => {
    let vivo = true;
    carregarManifesto()
      .then((m) => vivo && setManifesto(m))
      .catch(() => vivo && setManifesto(null));
    return () => {
      vivo = false;
    };
  }, []);

  // Porte options and the filtered slice live at the route level, not inside
  // DispersaoFiscal, so the same recorte reaches both the chart and its
  // accessible table alternative even after AlternaGraficoTabela unmounts
  // whichever view is not showing (see docs/COMPONENTES.md).
  const portesDisponiveis = useMemo(() => {
    const unicos = new Set((municipios ?? []).map((m) => m.porte_faixa));
    return [...unicos].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [municipios]);

  const municipiosFiltrados = useMemo(() => {
    const lista = municipios ?? [];
    return porteFiltro === PORTE_TODOS
      ? lista
      : lista.filter((m) => m.porte_faixa === porteFiltro);
  }, [municipios, porteFiltro]);

  // Per-porte medians over the full national list, so the quadrant of each
  // municipality is always cut against peers of its own size.
  const cortesPorte = useMemo(
    () => medianasPorPorteFiscal(municipios ?? []),
    [municipios],
  );

  // Default target when nothing is focused: the municipality whose revenue most
  // exceeds its own GDP. Kept local so merely opening this screen never sets a
  // global focus the other tabs would inherit.
  useEffect(() => {
    if (!municipios || municipios.length === 0 || codigoFoco || padraoLocal) return;
    const maior = municipios.reduce((acc, m) =>
      m.razao_receita_pib > acc.razao_receita_pib ? m : acc,
    );
    setPadraoLocal(maior.codigo_ibge);
  }, [municipios, codigoFoco, padraoLocal]);

  const alvo = useMemo(
    () =>
      municipios && selecionado
        ? municipios.find((m) => m.codigo_ibge === selecionado)
        : undefined,
    [municipios, selecionado],
  );

  // Median composition of municipalities sharing the same porte, the honest
  // yardstick for the target (see docs/DECISAO_CAUSAL.md: never the national
  // average). Excludes the target itself.
  const composicaoReferencia = useMemo(() => {
    if (!municipios || !alvo) return null;
    const pares = municipios.filter(
      (m) => m.porte_faixa === alvo.porte_faixa && m.codigo_ibge !== alvo.codigo_ibge,
    );
    if (pares.length === 0) return null;
    const fracaoFpm = medianaDe(pares.map((m) => m.razao_fpm_receita));
    return { fracaoPropria: 1 - fracaoFpm, fracaoFpm };
  }, [municipios, alvo]);

  if (municipios === null) {
    return <EstadoCarregando rotulo="Carregando o eixo fiscal" />;
  }
  if (municipios.length === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados fiscais"
        mensagem="Os artefatos fiscais ainda não estão disponíveis neste ambiente."
      />
    );
  }

  return (
    <>
    <div className="faixa-tela" role="group" aria-label="Filtro do eixo fiscal">
      <FiltroPorte
        porte={porteFiltro}
        opcoes={portesDisponiveis}
        onChange={setPorteFiltro}
      />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <p style={{ color: "var(--ink-secondary)", maxWidth: "70ch" }}>
        Prefeituras que movimentam mais do que o próprio PIB do município puxam
        para o polo quente, à direita da linha neutra.
      </p>

      <LeituraFatia texto={interpretacao?.telas.fiscal} rotulo="leitura fiscal" />

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <AlternaGraficoTabela
          grafico={
            <DispersaoFiscal
              dados={municipiosFiltrados}
              rotuloFiltro={rotuloPorte(porteFiltro)}
              destaque={codigoFoco ?? undefined}
              cortesPorte={cortesPorte}
            />
          }
          tabela={<TabelaDispersao dados={municipiosFiltrados} cortesPorte={cortesPorte} />}
        />

        {manifesto ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {selosDispersao(manifesto.fontes).map((f) => (
              <SeloFonte key={f.nome} fonte={rotuloFonte(f)} dataExtracao={f.data_extracao} />
            ))}
          </div>
        ) : null}
      </section>

      <div
        style={{
          display: "flex",
          gap: "var(--space-5)",
          flexWrap: "wrap",
          alignItems: "start",
        }}
      >
        <section
          style={{
            flex: "1 1 480px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <h2 style={{ fontSize: "var(--text-lg)" }}>Fluxo do orçamento</h2>
          <BuscaMunicipio onSelect={(c) => selecionar(c)} />
          {alvo ? (
            <SankeyOrcamento
              municipio={alvo.codigo_ibge}
              nomeMunicipio={alvo.nome}
              ufMunicipio={alvo.uf}
              entradas={entradasDeReceita(alvo)}
              composicaoReferencia={composicaoReferencia}
              saidas={[]}
              porteReferencia={alvo.porte_faixa}
            />
          ) : (
            <EstadoVazio mensagem="Escolha um município para ver o entra e sai do orçamento." />
          )}
        </section>

        <RankingSuperaPib
          dados={municipios}
          selecionado={selecionado}
          onSelect={(c) => selecionar(c)}
        />
      </div>

      <ConcavidadeFPM municipios={municipios} />
    </div>
    </>
  );
}

// The "entra" side is covered by the current contract; the "sai" side (spending
// by category) awaits FINBRA expense ingestion (see docs/DASHBOARD.md, Tela 3).
function entradasDeReceita(m: Municipio) {
  const outras = Math.max(0, m.receita_total - m.fpm);
  return [
    { origem: "imposto próprio e outras transferências", valor: outras },
    { origem: "FPM (repasse da União)", valor: m.fpm },
  ];
}

// Median of a plain number array; kept local because lib/data.ts only exposes
// medianaIdm, specific to the idm field.
function medianaDe(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  if (ordenado.length % 2 === 1) return ordenado[meio] ?? 0;
  return ((ordenado[meio - 1] ?? 0) + (ordenado[meio] ?? 0)) / 2;
}

interface RankingSuperaPibProps {
  dados: Municipio[];
  selecionado?: string;
  onSelect: (codigoIbge: string) => void;
}

// Sidebar ranking: municipalities whose revenue most exceeds their own GDP.
// Clicking a row drives the same selection as the search box above.
function RankingSuperaPib({ dados, selecionado, onSelect }: RankingSuperaPibProps) {
  const topo = useMemo(
    () =>
      dados
        .filter((m) => m.razao_receita_pib > 1)
        .sort((a, b) => b.razao_receita_pib - a.razao_receita_pib)
        .slice(0, 15),
    [dados],
  );

  return (
    <aside
      aria-label="Ranking dos municípios que mais superam o próprio PIB"
      style={{
        flex: "0 1 320px",
        minWidth: "260px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <h2 style={{ fontSize: "var(--text-lg)" }}>Receita acima do PIB</h2>
      <p style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)", margin: 0 }}>
        A prefeitura movimenta mais do que a cidade produz; a comparação correta
        é sempre por porte, nunca pela média nacional.
      </p>

      {topo.length === 0 ? (
        <EstadoVazio mensagem="Nenhum município supera o próprio PIB no recorte atual." />
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          {topo.map((m) => (
            <li key={m.codigo_ibge}>
              <button
                type="button"
                onClick={() => onSelect(m.codigo_ibge)}
                aria-pressed={m.codigo_ibge === selecionado}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  background:
                    m.codigo_ibge === selecionado ? "var(--gridline)" : "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-control)",
                  color: "var(--ink-primary)",
                  fontSize: "var(--text-body)",
                  textAlign: "left",
                }}
              >
                <span>
                  {m.nome} <span style={{ color: "var(--ink-muted)" }}>({m.uf})</span>
                </span>
                <span className="tabular">
                  {m.razao_receita_pib.toFixed(2).replace(".", ",")}x
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

// Initial render cap, so a default "todos os portes" view does not paint
// thousands of rows at once (mirrors TabelaRanking's LIMITE_POR_GRUPO
// pattern). Sorted by receita/PIB descending, the same order as the ranking
// sidebar, so the truncated head is the most policy-relevant slice.
const LIMITE_TABELA = 200;

// Accessible alternative to the scatter (see AlternaGraficoTabela): every
// reader who cannot see the chart still gets municipio, FPM/receita,
// receita/PIB and the acima-do-PIB call, at the same porte recorte.
// Filter chip for the quadrant, active when its quadrant is the current filter.
function ChipQuadrante({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border)",
        fontSize: "var(--text-body)",
        color: ativo ? "var(--on-accent)" : "var(--ink-secondary)",
        background: ativo ? "var(--accent)" : "transparent",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TabelaDispersao({
  dados,
  cortesPorte,
}: {
  dados: Municipio[];
  cortesPorte: Map<string, CortesPorte>;
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [filtroQuadrante, setFiltroQuadrante] = useState<string | null>(null);

  useEffect(() => {
    setMostrarTodos(false);
  }, [dados]);
  useEffect(() => {
    setFiltroQuadrante(null);
  }, [dados]);

  const filtrado = useMemo(
    () =>
      filtroQuadrante === null
        ? dados
        : dados.filter((m) => quadranteFiscal(m, cortesPorte).chave === filtroQuadrante),
    [dados, cortesPorte, filtroQuadrante],
  );
  const ordenado = useMemo(
    () => [...filtrado].sort((a, b) => b.razao_receita_pib - a.razao_receita_pib),
    [filtrado],
  );
  const linhas = mostrarTodos ? ordenado : ordenado.slice(0, LIMITE_TABELA);
  const truncado = linhas.length < ordenado.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div role="group" aria-label="Filtrar por quadrante fiscal" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <ChipQuadrante ativo={filtroQuadrante === null} onClick={() => setFiltroQuadrante(null)}>todos</ChipQuadrante>
        {QUADRANTES.map((q) => (
          <ChipQuadrante
            key={q.chave}
            ativo={filtroQuadrante === q.chave}
            onClick={() => setFiltroQuadrante((atual) => (atual === q.chave ? null : q.chave))}
          >
            {q.rotulo}
          </ChipQuadrante>
        ))}
      </div>

      <p style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)", margin: 0 }}>
        {ordenado.length} municípios, ordenados por receita/PIB decrescente
        {truncado ? `, mostrando os ${LIMITE_TABELA} primeiros` : ""}.
      </p>

      {/* Wide table scrolls inside its own container; the page never scrolls
          sideways, including at 360 px. */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-body)",
          }}
        >
          <caption className="visually-hidden">
            Receita sobre PIB, participação do FPM na receita e se a receita
            supera o PIB, por município
          </caption>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>município (UF)</th>
              <th scope="col" style={{ ...thStyle, textAlign: "right" }}>FPM/receita</th>
              <th scope="col" style={{ ...thStyle, textAlign: "right" }}>receita/PIB</th>
              <th scope="col" style={{ ...thStyle, textAlign: "right" }}>acima do PIB</th>
              <th scope="col" style={thStyle}>quadrante (vs porte)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => {
              const quad = quadranteFiscal(m, cortesPorte);
              return (
                <tr key={m.codigo_ibge}>
                  <td style={tdStyle}>
                    {m.nome} <span style={{ color: "var(--ink-muted)" }}>({m.uf})</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }} className="tabular">
                    {formatarPercentual(m.razao_fpm_receita)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }} className="tabular">
                    {m.razao_receita_pib.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {m.razao_receita_pib >= 1 ? "sim" : "não"}
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => setFiltroQuadrante((atual) => (atual === quad.chave ? null : quad.chave))}
                      aria-label={`Filtrar por ${quad.rotulo}`}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        color: "var(--accent)",
                        font: "inherit",
                        textDecoration: "underline",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {quad.rotulo}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {truncado ? (
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
          ver todos os {ordenado.length} municípios
        </button>
      ) : null}
    </div>
  );
}

// Native select, keyboard-operable by default; owned at the route level (not
// inside DispersaoFiscal) so the same recorte reaches the accessible table
// alternative too, even while the chart is not mounted (see
// AlternaGraficoTabela).
function FiltroPorte({
  porte,
  opcoes,
  onChange,
}: {
  porte: string;
  opcoes: string[];
  onChange: (porte: string) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-body)",
        color: "var(--ink-secondary)",
      }}
    >
      Porte
      <select
        value={porte}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "var(--space-1) var(--space-2)",
          background: "var(--surface-1)",
          color: "var(--ink-primary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
          fontSize: "var(--text-body)",
        }}
      >
        <option value={PORTE_TODOS}>todos</option>
        {opcoes.map((p) => (
          <option key={p} value={p}>
            {bandaPorte(p)}
          </option>
        ))}
      </select>
    </label>
  );
}

function rotuloPorte(porte: string): string {
  return porte === PORTE_TODOS ? "todos os portes" : `porte ${bandaPorte(porte)}`;
}

// FINBRA/DCA covers receita total and FPM (the x-axis and the acima-do-PIB
// call); PIB dos Municipios covers the y-axis. Falls back to an empty list
// rather than fabricating a source if the manifest lacks either entry.
function selosDispersao(fontes: FonteRef[]): FonteRef[] {
  const finbra = fontes.find((f) => f.nome.startsWith("FINBRA"));
  const pib = fontes.find((f) => f.nome.includes("PIB"));
  return [finbra, pib].filter((f): f is FonteRef => f != null);
}

function rotuloFonte(f: FonteRef): string {
  return `${f.nome} (${f.orgao})`;
}

const thStyle = {
  textAlign: "left",
  padding: "var(--space-2) var(--space-3)",
  borderBottom: "1px solid var(--baseline)",
  color: "var(--ink-secondary)",
} as const;

const tdStyle = {
  padding: "var(--space-2) var(--space-3)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
} as const;
