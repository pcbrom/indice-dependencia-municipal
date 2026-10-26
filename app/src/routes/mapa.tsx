import { rotuloPolo } from "../lib/rede";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Table, X } from "lucide-react";
import { DOI_CONCEITO, REPOSITORIO } from "../App";
import type { Map as MaplibreMap } from "maplibre-gl";
import {
  BuscaMunicipio,
  EgoGraphOrbita,
  EstadoCarregando,
  EstadoVazio,
  FiltroTipologia,
  MapaOrbitas,
  SeloFonte,
} from "../components";
import { ORDEM_PORTE, ordenarPorReferencia } from "../components/TabelaRanking";
import type { MapaProntoInfo } from "../components/MapaOrbitas";
import { PainelPolo } from "../components/PainelPolo";
import { DetalheMunicipio, type SecaoDetalhe } from "../components/DetalheMunicipio";
import { RelatorioMunicipio } from "../components/RelatorioMunicipio";
import {
  carregarDestaques,
  carregarLigacoes,
  carregarManifesto,
  carregarMunicipios,
  contarTipologia,
  filtrarMunicipios,
  formatarInteiro,
  formatarPercentual,
  formatarPopulacao,
  medianaIdm,
  rotuloPorte,
} from "../lib/data";
import type { MalhaGeoJSON } from "../lib/data";
import { useSelecao } from "../lib/selecao";
import type {
  Destaques,
  FiltrosMapa,
  FonteRef,
  Ligacao,
  Manifesto,
  Municipio,
  Tipologia,
} from "../lib/types";

const TODAS: Tipologia[] = ["polo", "semi-polo", "orbitante"];

// Singular labels for the table alternative (one row, one tipologia), distinct
// from FiltroTipologia's plural chip labels ("Polos", "Semi-polos" ...).
const ROTULO_TIPOLOGIA_LINHA: Record<Tipologia, string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

const LIMITE_LINHAS_TABELA = 300;

// localStorage key for the dismissed state of the headline band.
const CHAVE_MANCHETE = "idm.manchete.fechada";

// Tela 1: national map of orbits. The thesis on screen, search before the map,
// a single color channel. Tipologia is a filter of chips, not a mark.
export default function Mapa() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [destaques, setDestaques] = useState<Destaques | null>(null);
  // Headline band dismissal, persisted so a returning reader who closed it gets
  // the full map height back. A missing artifact or storage simply keeps it open
  // the first time and hides nothing critical.
  const [mancheteFechada, setMancheteFechada] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CHAVE_MANCHETE) === "1";
    } catch {
      return false;
    }
  });
  const fecharManchete = useCallback(() => {
    setMancheteFechada(true);
    try {
      localStorage.setItem(CHAVE_MANCHETE, "1");
    } catch {
      // Storage unavailable (private mode): dismiss for this session only.
    }
  }, []);
  const [filtros, setFiltros] = useState<FiltrosMapa>({ tipologiaAtiva: [] });
  // Text state for the faixa de IDM inputs: kept separate from filtros so an
  // empty or partial field never collapses to a false 0..0 range mid-typing.
  const [faixaMinTexto, setFaixaMinTexto] = useState("");
  const [faixaMaxTexto, setFaixaMaxTexto] = useState("");

  // Selection shared by the search bar, the map click (polo/semi-polo point or
  // any municipio's fill) and the ego-graph. A click never navigates anymore:
  // it only sets this codigo, which lights up the ego-graph and opens
  // PainelPolo with the summary, so the reader can preview "para onde a vida
  // vai" before choosing to open the full profile (docs/DECISAO_UX.md).
  // Focused city comes from the shared selection so it survives tab changes
  // (lib/selecao); the local setter adapts the string | undefined shape the
  // map components already use to the context's string | null.
  const { codigo: codigoFoco, selecionar } = useSelecao();
  const municipioSelecionado = codigoFoco ?? undefined;
  const setMunicipioSelecionado = useCallback(
    (c?: string) => selecionar(c ?? null),
    [selecionar],
  );
  const [mapaPronto, setMapaPronto] = useState<MaplibreMap | null>(null);
  const [malha, setMalha] = useState<MalhaGeoJSON | null>(null);
  // Section the consolidated detail overlay opens at; null keeps it closed. The
  // overlay never navigates, so the map stays behind with the selection intact.
  const [detalheSecao, setDetalheSecao] = useState<SecaoDetalhe | null>(null);
  // "Sobre e fontes" footer modal: the thesis subtitle, the recorte summary and
  // the source stamps, on demand rather than always on screen.
  const [sobreAberto, setSobreAberto] = useState(false);
  // Map vs table view, lifted here (out of AlternaGraficoTabela) so the map can
  // stay mounted as the background while the table opens as an overlay card.
  const [vista, setVista] = useState<"mapa" | "tabela">("mapa");

  // The full-bleed map is fixed under the sticky nav; measure the nav's live
  // height into --nav-altura so the map starts exactly below it on any viewport
  // (the nav wraps to two rows on a narrow screen). Cleared on unmount so other
  // routes never inherit the offset.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const aplicar = () =>
      document.documentElement.style.setProperty(
        "--nav-altura",
        `${header.getBoundingClientRect().height}px`,
      );
    aplicar();
    const observador = new ResizeObserver(aplicar);
    observador.observe(header);
    return () => {
      observador.disconnect();
      document.documentElement.style.removeProperty("--nav-altura");
    };
  }, []);

  // Measure the map control band height into --mapa-cab-altura so the floating
  // research button (App shell) can sit just below the band on the map, clear of
  // the chips and the view toggle. Other routes leave it unset (0).
  useEffect(() => {
    if (carregando) return;
    const banda = document.querySelector<HTMLElement>(".mapa-cabecalho");
    if (!banda) return;
    const aplicar = () =>
      document.documentElement.style.setProperty(
        "--mapa-cab-altura",
        `${banda.getBoundingClientRect().height}px`,
      );
    aplicar();
    const observador = new ResizeObserver(aplicar);
    observador.observe(banda);
    return () => {
      observador.disconnect();
      document.documentElement.style.removeProperty("--mapa-cab-altura");
    };
  }, [carregando]);

  useEffect(() => {
    let vivo = true;
    Promise.all([carregarMunicipios(), carregarLigacoes()])
      .then(([m, l]) => {
        if (!vivo) return;
        setMunicipios(m);
        setLigacoes(l);
        setCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setErro(true);
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Independent load: a missing or unreachable manifest only degrades the
  // SeloFonte at the foot of the screen, never the map or the filters.
  useEffect(() => {
    let vivo = true;
    carregarManifesto()
      .then((m) => vivo && setManifesto(m))
      .catch(() => vivo && setManifesto(null));
    return () => {
      vivo = false;
    };
  }, []);

  // Independent load of the national headline aggregates: a missing artifact
  // only hides the headline band, never the map.
  useEffect(() => {
    let vivo = true;
    carregarDestaques()
      .then((d) => vivo && setDestaques(d))
      .catch(() => vivo && setDestaques(null));
    return () => {
      vivo = false;
    };
  }, []);

  const aoMapaPronto = useCallback((info: MapaProntoInfo) => {
    setMapaPronto(info.mapa);
    setMalha(info.malha);
  }, []);

  const visiveis = useMemo(
    () => filtrarMunicipios(municipios, filtros),
    [municipios, filtros],
  );

  // Chip counts react to the UF/porte/faixa de IDM filters (M2 refinement)
  // but not to the tipologia toggle itself, otherwise turning a class off
  // would zero its own count.
  const baseParaContagem = useMemo(
    () => filtrarMunicipios(municipios, { ...filtros, tipologiaAtiva: [] }),
    [municipios, filtros],
  );
  const contagem = useMemo(
    () => contarTipologia(baseParaContagem),
    [baseParaContagem],
  );

  const porCodigo = useMemo(() => {
    const mapa = new Map<string, Municipio>();
    for (const m of municipios) mapa.set(m.codigo_ibge, m);
    return mapa;
  }, [municipios]);

  const ufs = useMemo(
    () =>
      [...new Set(municipios.map((m) => m.uf))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [municipios],
  );
  const portes = useMemo(
    () => ordenarPorReferencia(municipios.map((m) => m.porte_faixa), ORDEM_PORTE),
    [municipios],
  );

  const ativas = new Set(filtros.tipologiaAtiva);
  const chips = TODAS.map((classe) => ({
    classe,
    contagem: contagem[classe],
    ativa: ativas.has(classe),
  }));

  const alternarTipologia = (classe: Tipologia) =>
    setFiltros((f) => {
      const set = new Set(f.tipologiaAtiva);
      if (set.has(classe)) set.delete(classe);
      else set.add(classe);
      return { ...f, tipologiaAtiva: [...set] };
    });

  const aplicarFaixaIdm = (minTexto: string, maxTexto: string) => {
    const min =
      minTexto === "" || Number.isNaN(Number(minTexto))
        ? undefined
        : Number(minTexto);
    const max =
      maxTexto === "" || Number.isNaN(Number(maxTexto))
        ? undefined
        : Number(maxTexto);
    setFiltros((f) => ({
      ...f,
      faixaIdm:
        min === undefined && max === undefined ? undefined : [min ?? 0, max ?? 1],
    }));
  };

  const municipioAtual = municipioSelecionado
    ? municipios.find((m) => m.codigo_ibge === municipioSelecionado)
    : undefined;

  if (erro) {
    return (
      <EstadoVazio
        titulo="Não foi possível carregar os dados"
        mensagem="Os artefatos do painel ainda não estão disponíveis neste ambiente."
      />
    );
  }

  if (carregando) {
    return <EstadoCarregando rotulo="Carregando malha e municípios do mapa" />;
  }

  // Full-bleed map, fixed under the nav, as a column: a horizontal header of
  // controls, the map filling the middle, a thin footer. The detail and "sobre"
  // overlays are siblings (not children) of .mapa-tela so their z-index sits
  // above the sticky nav.
  return (
    <>
      <div className="mapa-tela">
        {destaques && !mancheteFechada && (
          <aside className="mapa-manchete" aria-label="Dimensão nacional da dependência municipal">
            <p className="mapa-manchete-frase">
              <strong>{formatarInteiro(destaques.dependentes.n_municipios)} municípios</strong>
              {" "}({formatarPercentual(destaques.dependentes.share_municipios)} do país) e{" "}
              <strong>{formatarPopulacao(destaques.dependentes.populacao)} de habitantes</strong>
              {" "}dependem de outra cidade para hospital, faculdade e banco.
            </p>
            <p className="mapa-manchete-uso">
              Busque uma cidade para ver o caso dela: de quem depende, o que lhe
              falta e o que o gestor pode examinar, com relatório de uma página
              para baixar e levar à reunião.
            </p>
            <p className="mapa-manchete-fonte">
              fonte: REGIC {manifesto?.ano_base_regic ?? 2018} e População Estimada, IBGE
            </p>
            <button
              type="button"
              className="mapa-manchete-fechar"
              onClick={fecharManchete}
              aria-label="Ocultar a faixa de destaque"
            >
              <X size={16} aria-hidden />
            </button>
          </aside>
        )}
        <header className="mapa-cabecalho" role="group" aria-label="Busca, filtros e visão do mapa">
          <div className="mapa-cab-busca">
            <BuscaMunicipio onSelect={(codigo) => setMunicipioSelecionado(codigo)} />
          </div>
            <SelectFiltroMapa
              id="mapa-filtro-uf"
              rotulo="UF"
              valor={filtros.uf ?? ""}
              onChange={(v) => setFiltros((f) => ({ ...f, uf: v === "" ? undefined : v }))}
              opcoes={[{ valor: "", rotulo: "todas" }, ...ufs.map((u) => ({ valor: u, rotulo: u }))]}
            />
            <SelectFiltroMapa
              id="mapa-filtro-porte"
              rotulo="Porte"
              valor={filtros.porte ?? ""}
              onChange={(v) => setFiltros((f) => ({ ...f, porte: v === "" ? undefined : v }))}
              opcoes={[{ valor: "", rotulo: "todos" }, ...portes.map((p) => ({ valor: p, rotulo: rotuloPorte(p) }))]}
            />
            <FiltroFaixaIdm
              min={faixaMinTexto}
              max={faixaMaxTexto}
              onChangeMin={(v) => {
                setFaixaMinTexto(v);
                aplicarFaixaIdm(v, faixaMaxTexto);
              }}
              onChangeMax={(v) => {
                setFaixaMaxTexto(v);
                aplicarFaixaIdm(faixaMinTexto, v);
              }}
            />
            <div
              className="mapa-cab-legenda"
              role="group"
              aria-label="Legenda do IDM: azul menos dependente, vermelho mais dependente"
            >
              <span>IDM</span>
              <span aria-hidden className="mapa-legenda-barra" />
              <span>menos → mais dependente</span>
            </div>
            <FiltroTipologia classes={chips} onToggle={alternarTipologia} />
            <SegmentoVista vista={vista} onVista={setVista} />
        </header>

        <div className="mapa-canvas-area">
          <div className="mapa-canvas">
            <MapaOrbitas
              filtros={filtros}
              municipioSelecionado={municipioSelecionado}
              ligacoes={ligacoes}
              onMapaPronto={aoMapaPronto}
              onSelecionarMunicipio={setMunicipioSelecionado}
            />
            {municipioAtual && mapaPronto && malha && (
              <EgoGraphOrbita
                municipio={municipioAtual.codigo_ibge}
                ligacoes={ligacoes}
                // Polos and semi-polos both light up their incoming edges: the
                // REGIC hierarchy lets a semi-polo receive orbitantes too
                // (pipeline regic.py), only a plain orbitante never does.
                modo={municipioAtual.tipologia !== "orbitante" ? "ambos" : "saida"}
                mapa={mapaPronto}
                malha={malha}
                municipios={municipios}
              />
            )}
          </div>

          {municipioAtual && (
            <div className="mapa-dock-direita">
              <PainelPolo
                municipio={municipioAtual}
                municipios={municipios}
                ligacoes={ligacoes}
                onFechar={() => setMunicipioSelecionado(undefined)}
                onAbrirDetalhe={(secao) => setDetalheSecao(secao ?? "grau")}
              />
            </div>
          )}

          {vista === "tabela" && visiveis.length > 0 && (
            <div
              className="mapa-card mapa-tabela-overlay"
              role="region"
              aria-label="Tabela do recorte filtrado no mapa"
            >
              <TabelaMapa lista={visiveis} porCodigo={porCodigo} />
            </div>
          )}

          {visiveis.length === 0 && (
            <div className="mapa-card mapa-vazio-centro">
              <EstadoVazio
                titulo="Nenhum município no filtro atual"
                mensagem="Ajuste a tipologia, a UF, a faixa de IDM ou o porte para ver municípios no mapa."
              />
            </div>
          )}

          {visiveis.length > 0 && (
            <div className="mapa-resumo-flutuante">
              <ResumoMapa lista={visiveis} />
            </div>
          )}

          <button
            type="button"
            className="mapa-sobre-flutuante"
            onClick={() => setSobreAberto(true)}
          >
            sobre e fontes
          </button>
        </div>
      </div>

      {detalheSecao && municipioAtual && (
        <DetalheMunicipio
          municipio={municipioAtual}
          municipios={municipios}
          ligacoes={ligacoes}
          manifesto={manifesto}
          secaoInicial={detalheSecao}
          onFechar={() => setDetalheSecao(null)}
        />
      )}

      {sobreAberto && (
        <SobreModal manifesto={manifesto} onFechar={() => setSobreAberto(false)} />
      )}

      {/* One print-only report for the selected city, mounted once here so the
          "Baixar relatório" button in PainelPolo and in the detail overlay both
          print a single document (two mounts would print twice). */}
      {municipioAtual && (
        <RelatorioMunicipio m={municipioAtual} municipios={municipios} doi={DOI_CONCEITO} />
      )}
    </>
  );
}

// Footer "sobre e fontes" modal: the thesis subtitle, the source stamps and the
// methodology link, on demand. Reuses the detail overlay backdrop; Escape and a
// backdrop click close it.
function SobreModal({
  manifesto,
  onFechar,
}: {
  manifesto: Manifesto | null;
  onFechar: () => void;
}) {
  return (
    <div className="detalhe-fundo" role="presentation" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal
        aria-label="Sobre este painel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onFechar();
          }
        }}
        style={{
          width: "min(520px, 100%)",
          background: "var(--surface-page)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-block)",
          boxShadow: "var(--shadow-floating)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Sobre este painel</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{ display: "inline-flex", background: "transparent", border: "none", padding: "var(--space-1)", color: "var(--ink-secondary)", cursor: "pointer" }}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p style={{ margin: 0, color: "var(--ink-secondary)", fontSize: "var(--text-body)" }}>
          Este painel mostra para onde essa vida vai e quem custeia cada
          prefeitura.
        </p>
        {manifesto && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span className="rotulo-secao">Bases</span>
            {manifesto.fontes.map((f) => (
              <SeloFonte
                key={f.nome}
                fonte={rotuloFonte(f)}
                dataExtracao={f.data_extracao}
              />
            ))}
            <SeloFonte
              fonte={`IDM v${manifesto.idm_versao}`}
              dataExtracao={dataMaisRecente(manifesto.fontes)}
            />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span className="rotulo-secao">Citar e reproduzir</span>
          <a
            href={`https://doi.org/${DOI_CONCEITO}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "var(--text-body)" }}
          >
            DOI {DOI_CONCEITO}
          </a>
          <a
            href={REPOSITORIO}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "var(--text-body)" }}
          >
            Código-fonte, dados e documentação do método
          </a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span className="rotulo-secao">Autores</span>
          {AUTORES.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "var(--text-body)" }}
            >
              {a.nome}
            </a>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)", lineHeight: 1.5 }}>
          © 2026 os autores. O código do painel e do pipeline está sob licença
          MIT; os dados derivados e a documentação, sob CC BY 4.0, livres para
          reúso com atribuição. Os dados abertos federais reusados pertencem aos
          respectivos órgãos e seguem os termos deles.
        </p>
        <Link to="/metodologia" style={{ fontSize: "var(--text-body)" }}>
          ver metodologia completa
        </Link>
      </div>
    </div>
  );
}

// Autores do painel, exibidos no "Sobre este painel" apenas como nome e link do
// LinkedIn (sem e-mail nem afiliacao).
const AUTORES: { nome: string; url: string }[] = [
  { nome: "Pedro Carvalho Brom", url: "https://www.linkedin.com/in/pcbrom/" },
  { nome: "Daniel Soares de Souza", url: "https://www.linkedin.com/in/prof-daniel-soares-82579b41/" },
];

// Segmented map/table control, floated in the left dock. Replaces
// AlternaGraficoTabela here so the map stays mounted behind the table overlay
// (the shared MapLibre GL context is expensive to recreate); the same two-icon
// affordance is preserved.
function SegmentoVista({
  vista,
  onVista,
}: {
  vista: "mapa" | "tabela";
  onVista: (v: "mapa" | "tabela") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Alternar entre mapa e tabela"
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
        overflow: "hidden",
      }}
    >
      {(["mapa", "tabela"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={vista === v}
          onClick={() => onVista(v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            padding: "var(--space-1) var(--space-3)",
            border: "none",
            cursor: "pointer",
            fontSize: "var(--text-body)",
            color: vista === v ? "var(--on-accent)" : "var(--ink-secondary)",
            background: vista === v ? "var(--accent)" : "transparent",
          }}
        >
          {v === "mapa" ? (
            <BarChart3 size={16} aria-hidden />
          ) : (
            <Table size={16} aria-hidden />
          )}{" "}
          {v === "mapa" ? "Mapa" : "Tabela"}
        </button>
      ))}
    </div>
  );
}

function ResumoMapa({ lista }: { lista: Municipio[] }) {
  // Numerator and denominator come from the same filtered list, so the share is
  // internally consistent (orbitantes visiveis over municipios visiveis).
  const pctOrbitantes =
    lista.length > 0 ? contarTipologia(lista).orbitante / lista.length : 0;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        gap: "var(--space-5)",
        flexWrap: "wrap",
        fontSize: "var(--text-body)",
        color: "var(--ink-secondary)",
      }}
    >
      <span>
        <strong className="tabular">{lista.length}</strong> municípios
      </span>
      <span>
        mediana IDM{" "}
        <strong className="tabular">
          {medianaIdm(lista).toFixed(2).replace(".", ",")}
        </strong>
      </span>
      <span>
        <strong className="tabular">{formatarPercentual(pctOrbitantes)}</strong>{" "}
        orbitantes
      </span>
    </div>
  );
}

interface OpcaoSelect {
  valor: string;
  rotulo: string;
}

// Shared label-plus-select control for the UF and porte filters, so the aside
// reads as one pattern (mirrors routes/ranking.tsx's own SelectFiltro, kept
// local here since that one is not exported).
function SelectFiltroMapa({
  id,
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoSelect[];
}) {
  return (
    <label htmlFor={id} className="mapa-campo">
      {rotulo}
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

// Two plain number inputs (de / ate) instead of a dual-handle slider: fully
// keyboard-operable with the native step/arrow behavior, no extra dependency.
// Compact inline in the header band; the group label carries the meaning.
function FiltroFaixaIdm({
  min,
  max,
  onChangeMin,
  onChangeMax,
}: {
  min: string;
  max: string;
  onChangeMin: (valor: string) => void;
  onChangeMax: (valor: string) => void;
}) {
  return (
    <div className="mapa-campo" role="group" aria-label="Faixa de IDM">
      <span>IDM de</span>
      <input
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={min}
        aria-label="IDM mínimo"
        onChange={(e) => onChangeMin(e.target.value)}
      />
      <span>até</span>
      <input
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={max}
        aria-label="IDM máximo"
        onChange={(e) => onChangeMax(e.target.value)}
      />
    </div>
  );
}

interface TabelaMapaProps {
  lista: Municipio[];
  porCodigo: Map<string, Municipio>;
}

// Table equivalent of the map (accessibility requirement, docs/DECISAO_UX.md):
// same filtered set, same fields the map encodes by color and by ego-graph
// edge (municipio, tipologia, IDM, polo), plus a link to the profile so a
// keyboard or screen-reader user can reach it without ever touching the
// mouse-only maplibre canvas.
function TabelaMapa({ lista, porCodigo }: TabelaMapaProps) {
  const linhas = lista.slice(0, LIMITE_LINHAS_TABELA);
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--text-body)",
        }}
      >
        <caption className="visually-hidden">
          Município, tipologia, IDM e polo de destino do recorte filtrado no
          mapa
        </caption>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>município (UF)</th>
            <th scope="col" style={thStyle}>tipologia</th>
            <th scope="col" style={{ ...thStyle, textAlign: "right" }}>IDM</th>
            <th scope="col" style={thStyle}>polo</th>
            <th scope="col" style={thStyle}>
              <span className="visually-hidden">ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => {
            const polo = m.polo_ibge ? porCodigo.get(m.polo_ibge) : undefined;
            const rotuloDestino =
              m.tipologia === "polo" && !m.polo_ibge
                ? "a própria cidade"
                : rotuloPolo(m, polo);
            return (
              <tr key={m.codigo_ibge}>
                <td style={tdStyle}>
                  {m.nome} <span style={{ color: "var(--ink-muted)" }}>({m.uf})</span>
                </td>
                <td style={tdStyle}>{ROTULO_TIPOLOGIA_LINHA[m.tipologia]}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="tabular">
                  {m.idm.toFixed(2).replace(".", ",")}
                </td>
                <td style={tdStyle}>{rotuloDestino}</td>
                <td style={tdStyle}>
                  <Link to={`/municipio/${m.codigo_ibge}`}>ver perfil</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {lista.length > LIMITE_LINHAS_TABELA && (
        <p style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
          Mostrando os primeiros {LIMITE_LINHAS_TABELA} de {lista.length}{" "}
          municípios do recorte; refine os filtros para ver os demais.
        </p>
      )}
    </div>
  );
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

// REGIC is the mesh and tipologia source (docs/DASHBOARD.md 5.1); falls back
// to the manifest's first source if REGIC is ever renamed or missing.
function rotuloFonte(fonte: FonteRef): string {
  return fonte.orgao ? `${fonte.nome} (${fonte.orgao})` : fonte.nome;
}

// The IDM itself has no single data_extracao in the manifest (it composes
// every source); the latest extraction date across sources is the honest
// stand-in for "quando os dados por tras do indice foram obtidos".
function dataMaisRecente(fontes: FonteRef[]): string {
  return fontes.reduce(
    (recente, f) => (f.data_extracao > recente ? f.data_extracao : recente),
    "",
  );
}
