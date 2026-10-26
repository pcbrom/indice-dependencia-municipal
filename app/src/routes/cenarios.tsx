import { ChevronRight, Map as MapIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { EgoGraphOrbita, EstadoCarregando, EstadoVazio, MapaOrbitas } from "../components";
import type { MapaProntoInfo } from "../components/MapaOrbitas";
import { carregarAnalise, carregarContornos, carregarLigacoes, carregarMunicipios } from "../lib/data";
import type {
  AnaliseAgregacao,
  BlocoRegiao,
  BlocoUF,
  ContornoGeoJSON,
  EstruturaSelo,
  MalhaGeoJSON,
  RegiaoFuncional,
  ResumoAgregacao,
} from "../lib/data";
import type { FiltrosMapa, Ligacao, Municipio } from "../lib/types";

// No tipologia filter here: the whole mesh and every polo/semi-polo point stays
// available so each functional region reads against the full orbit context.
const FILTROS_CENARIOS: FiltrosMapa = { tipologiaAtiva: [] };

const VERDE = "var(--status-good)";
const VERMELHO = "var(--status-critical)";
const AMBAR = "var(--status-warning)";

const ORDEM_REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

// Consorcio parameter ranges. Still uncalibrated for Brazil, but tightened to
// the range the international evidence supports: procurement and shared-staff
// savings are modest (single digits) and the governance overhead is likewise
// small, so the net sits close to zero. The band spans escala 0..8% minus
// governanca 3..8%, i.e. a net of about -8% to +5% of the shared administrative
// cost, narrow and centred near zero. Still a band, never a single value; the
// sign reads as assumption, not data.
const ESCALA_MIN = 0;
const ESCALA_MAX = 0.08;
const GOV_MIN = 0.03;
const GOV_MAX = 0.08;

// IDM color on the map's spectral ramp, resolved to a hex the GL fill accepts
// (blue = less dependent, red = more). Snapped to the nearest ramp step; good
// enough for the single-tone simulated fill.
function corIdmHex(v: number): string {
  const token =
    v <= 0.2 ? "--idm-100" : v <= 0.4 ? "--idm-300" : v <= 0.6 ? "--idm-450" : v <= 0.8 ? "--idm-600" : "--idm-700";
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#4575b4";
}

function idm2(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lerTokenCen(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Compact money for the summary cards, where sums reach billions.
function reaisCompacto(v: number): string {
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mi`;
  return reais(v);
}

function pct(v: number): string {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

function coef1(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const NIVEL_COR: Record<EstruturaSelo["nivel"], string> = {
  preservada: VERDE,
  parcial: AMBAR,
  fraca: VERMELHO,
};

const NIVEL_ROTULO: Record<EstruturaSelo["nivel"], string> = {
  preservada: "estrutura preservada",
  parcial: "estrutura parcial",
  fraca: "estrutura fraca",
};

// Structural reading of the region's seat, for the headline. Describes the
// service center, never qualifies a merger as good or bad (the comprehension
// rehearsal in docs/GATE_ENSAIO.md flagged that any "fusao favoravel" wording
// reads as a recommendation; see docs/DECISAO_CENARIOS.md).
const NIVEL_CENTRO: Record<EstruturaSelo["nivel"], string> = {
  preservada: "Centro de serviço consolidado",
  parcial: "Centro de serviço parcial",
  fraca: "Sem centro de serviço próprio",
};

interface Calculo {
  n: number;
  populacaoTotal: number;
  maquinaTotal: number;
  legislativaTotal: number;
  administracaoTotal: number;
  fpmSomado: number;
  coefSomado: number;
  coefFundido: number;
  fpmFundido: number;
  perdaFpm: number;
  fracaoPerdida: number;
  camaraSuprimida: number;
  consorcioMin: number;
  consorcioMax: number;
}

// The panels read the precomputed functional-region figures (identical to the
// pipeline); only the speculative consorcio band is derived here from the shared
// administrative cost.
function calcDeFuncional(f: RegiaoFuncional): Calculo {
  return {
    n: f.n,
    populacaoTotal: f.populacao,
    maquinaTotal: f.maquina,
    legislativaTotal: f.legislativa,
    administracaoTotal: f.administracao,
    fpmSomado: f.fpm_hoje,
    coefSomado: f.coef_somado,
    coefFundido: f.coef_fundido,
    fpmFundido: f.fpm_fundido,
    perdaFpm: f.perda,
    fracaoPerdida: f.frac_perdida,
    camaraSuprimida: f.camara_suprimida,
    consorcioMin: (ESCALA_MIN - GOV_MAX) * f.administracao,
    consorcioMax: (ESCALA_MAX - GOV_MIN) * f.administracao,
  };
}

// Brasil em Cenarios: a complete structural analysis of municipal aggregation,
// browsed by macro-region and UF. The unit is the REGIC functional region (a
// polo/semipolo anchor plus its orbitantes); merging keeps the anchor as the
// seat, so the service structure is preserved. Not a build-your-own tool: the
// analysis is served, the map supports it. See docs/DECISAO_CENARIOS.md.
export default function Cenarios() {
  const [analise, setAnalise] = useState<AnaliseAgregacao | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const [contornos, setContornos] = useState<ContornoGeoJSON | null>(null);
  const [mapaPronto, setMapaPronto] = useState<MaplibreMap | null>(null);
  const [malha, setMalha] = useState<MalhaGeoJSON | null>(null);

  const [regiaoSel, setRegiaoSel] = useState<string | null>(null);
  const [ufSel, setUfSel] = useState<string | null>(null);
  const [funcionalSel, setFuncionalSel] = useState<RegiaoFuncional | null>(null);
  const [simular, setSimular] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([carregarAnalise(), carregarMunicipios(), carregarLigacoes(), carregarContornos()])
      .then(([a, m, l, c]) => {
        if (!vivo) return;
        setAnalise(a);
        setMunicipios(m);
        setLigacoes(l);
        setContornos(c);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);

  const aoMapaPronto = useCallback((info: MapaProntoInfo) => {
    setMapaPronto(info.mapa);
    setMalha(info.malha);
  }, []);

  // Index each municipality to the functional region that contains it, so a map
  // click resolves to a structural region instead of building one by hand.
  const funcionalPorCodigo = useMemo(() => {
    const idx = new Map<string, RegiaoFuncional>();
    if (!analise) return idx;
    for (const reg of Object.values(analise.regioes)) {
      for (const uf of Object.values(reg.ufs)) {
        for (const rf of uf.regioes) {
          for (const c of rf.membros) idx.set(c, rf);
        }
      }
    }
    return idx;
  }, [analise]);

  const abrirFuncional = useCallback((rf: RegiaoFuncional) => {
    setRegiaoSel(rf.regiao);
    setUfSel(rf.uf);
    setFuncionalSel(rf);
  }, []);

  const aoClicarMapa = useCallback(
    (codigo: string) => {
      const rf = funcionalPorCodigo.get(codigo);
      if (rf) abrirFuncional(rf);
    },
    [funcionalPorCodigo, abrirFuncional],
  );

  const nomePorCodigo = useMemo(
    () => new Map(municipios.map((m) => [m.codigo_ibge, m.nome])),
    [municipios],
  );

  // Simulated colors for the current scope: every municipality in view painted
  // its functional region's simulated IDM (its anchor's). Built for the selected
  // functional region, or the whole UF, region or country being browsed.
  const simuladoPorCodigo = useMemo(() => {
    if (!simular || !analise) return undefined;
    const out: Record<string, string> = {};
    const add = (rf: RegiaoFuncional) => {
      const cor = corIdmHex(rf.idm_simulado);
      for (const c of rf.membros) out[c] = cor;
    };
    if (funcionalSel) add(funcionalSel);
    else if (ufSel && regiaoSel) analise.regioes[regiaoSel]?.ufs[ufSel]?.regioes.forEach(add);
    else if (regiaoSel)
      Object.values(analise.regioes[regiaoSel]?.ufs ?? {}).forEach((uf) => uf.regioes.forEach(add));
    else
      Object.values(analise.regioes).forEach((reg) =>
        Object.values(reg.ufs).forEach((uf) => uf.regioes.forEach(add)),
      );
    return out;
  }, [simular, analise, funcionalSel, ufSel, regiaoSel]);

  // Codigos in view for the current level: one functional region, a whole UF, a
  // whole macro-region, or null at the national root (reset to Brazil).
  const escopo = useMemo((): { codigos: Set<string>; maxZoom: number } | null => {
    if (funcionalSel) return { codigos: new Set(funcionalSel.membros), maxZoom: 8.5 };
    if (!analise) return null;
    const s = new Set<string>();
    if (ufSel && regiaoSel) {
      analise.regioes[regiaoSel]?.ufs[ufSel]?.regioes.forEach((rf) => rf.membros.forEach((c) => s.add(c)));
      return { codigos: s, maxZoom: 7 };
    }
    if (regiaoSel) {
      Object.values(analise.regioes[regiaoSel]?.ufs ?? {}).forEach((uf) =>
        uf.regioes.forEach((rf) => rf.membros.forEach((c) => s.add(c))),
      );
      return { codigos: s, maxZoom: 6 };
    }
    return null;
  }, [funcionalSel, ufSel, regiaoSel, analise]);

  // Zoom the map to that exact area when a card is opened; fly back to Brazil at
  // the national root.
  useEffect(() => {
    if (!mapaPronto || !malha) return;
    if (!escopo) {
      mapaPronto.flyTo({ center: [-52, -14], zoom: 3, duration: 700 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of malha.features) {
      if (!escopo.codigos.has(f.properties.codigo_ibge ?? "")) continue;
      percorrerCoordenadas((f.geometry as { coordinates?: unknown }).coordinates, (x, y) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
    }
    if (Number.isFinite(minX)) {
      // Extra right padding clears the analysis dock, so the area centers in the
      // visible part of the map rather than behind the panel.
      mapaPronto.fitBounds([[minX, minY], [maxX, maxY]], {
        padding: { top: 70, bottom: 70, left: 70, right: 480 },
        maxZoom: escopo.maxZoom,
        duration: 700,
      });
    }
  }, [escopo, mapaPronto, malha]);

  // The dissolved contour of the current selection: the functional region, the
  // UF or the macro-region. Null at the national root.
  const contornoAtivo = useMemo(() => {
    if (funcionalSel) return { tipo: "funcional", id: funcionalSel.ancora };
    if (ufSel) return { tipo: "uf", id: ufSel };
    if (regiaoSel) return { tipo: "regiao", id: regiaoSel };
    return null;
  }, [funcionalSel, ufSel, regiaoSel]);

  // Add the contour source and its casing layers (a light halo under an accent
  // line) once the map and the contours are both ready.
  useEffect(() => {
    const mapa = mapaPronto;
    if (!mapa || !contornos || mapa.getSource("contorno-cen")) return;
    const vazio = ["==", ["get", "id"], "__none__"] as unknown;
    mapa.addSource("contorno-cen", { type: "geojson", data: contornos as never });
    mapa.addLayer({
      id: "contorno-halo",
      type: "line",
      source: "contorno-cen",
      layout: { "line-join": "round" },
      paint: { "line-color": lerTokenCen("--surface-page"), "line-width": 6, "line-opacity": 0.85 },
      filter: vazio as never,
    } as never);
    mapa.addLayer({
      id: "contorno-linha",
      type: "line",
      source: "contorno-cen",
      layout: { "line-join": "round" },
      paint: { "line-color": lerTokenCen("--accent"), "line-width": 3 },
      filter: vazio as never,
    } as never);
  }, [mapaPronto, contornos]);

  // Filter the contour to the active scope, or hide it at the national root.
  useEffect(() => {
    const mapa = mapaPronto;
    if (!mapa || !mapa.getLayer("contorno-linha")) return;
    const filtro = (contornoAtivo
      ? ["all", ["==", ["get", "tipo"], contornoAtivo.tipo], ["==", ["get", "id"], contornoAtivo.id]]
      : ["==", ["get", "id"], "__none__"]) as unknown;
    mapa.setFilter("contorno-halo", filtro as never);
    mapa.setFilter("contorno-linha", filtro as never);
  }, [mapaPronto, contornoAtivo]);

  if (erro) {
    return <EstadoVazio titulo="Sem dados" mensagem="A análise de agregação não está disponível neste ambiente." />;
  }
  if (!analise) return <EstadoCarregando rotulo="Carregando a análise" />;

  const calc = funcionalSel ? calcDeFuncional(funcionalSel) : null;
  const modoSemente = funcionalSel?.ancora_tipologia === "orbitante" ? "saida" : "ambos";

  return (
    <div className="mapa-tela">
      <div className="mapa-canvas-area">
        <div className="mapa-canvas">
          <MapaOrbitas
            filtros={FILTROS_CENARIOS}
            municipioSelecionado={funcionalSel?.ancora}
            ligacoes={ligacoes}
            simuladoPorCodigo={simuladoPorCodigo}
            onSelecionarMunicipio={aoClicarMapa}
            onMapaPronto={aoMapaPronto}
          />
          {funcionalSel && mapaPronto && malha && (
            <EgoGraphOrbita
              municipio={funcionalSel.ancora}
              ligacoes={ligacoes}
              modo={modoSemente}
              mapa={mapaPronto}
              malha={malha}
              municipios={municipios}
            />
          )}
        </div>

        <div className="mapa-dock-direita">
          <div className="mapa-card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4)" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                margin: "calc(-1 * var(--space-4)) calc(-1 * var(--space-4)) 0",
                padding: "var(--space-3) var(--space-4)",
                background: "color-mix(in srgb, var(--accent) 9%, var(--surface-1))",
                borderBottom: "2px solid var(--accent)",
                borderRadius: "var(--radius-card) var(--radius-card) 0 0",
              }}
            >
              <Trilha
                regiao={regiaoSel}
                uf={ufSel}
                funcional={funcionalSel}
                onTudo={() => {
                  setRegiaoSel(null);
                  setUfSel(null);
                  setFuncionalSel(null);
                }}
                onRegiao={() => {
                  setUfSel(null);
                  setFuncionalSel(null);
                }}
                onUf={() => setFuncionalSel(null)}
              />
              <AlternaSimulado simular={simular} onSimular={setSimular} />
            </div>
            {funcionalSel && calc ? (
              <AnaliseFuncional funcional={funcionalSel} calc={calc} nomes={nomePorCodigo} />
            ) : ufSel && regiaoSel ? (
              <ListaFuncionais
                uf={ufSel}
                bloco={analise.regioes[regiaoSel]?.ufs[ufSel]}
                onEscolher={abrirFuncional}
              />
            ) : regiaoSel ? (
              <CartoesUF regiao={regiaoSel} bloco={analise.regioes[regiaoSel]} onEscolher={setUfSel} />
            ) : (
              <CartoesRegiao analise={analise} nomes={nomePorCodigo} onEscolher={setRegiaoSel} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Breadcrumb across the three levels: all regions, the region, the UF, the
// functional region. Each crumb up to the current one is clickable.
function Trilha({
  regiao,
  uf,
  funcional,
  onTudo,
  onRegiao,
  onUf,
}: {
  regiao: string | null;
  uf: string | null;
  funcional: RegiaoFuncional | null;
  onTudo: () => void;
  onRegiao: () => void;
  onUf: () => void;
}) {
  const sep = <ChevronRight size={14} aria-hidden style={{ color: "var(--ink-muted)" }} />;
  const link = (texto: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: "var(--text-body)" }}
    >
      {texto}
    </button>
  );
  const atual = (texto: string) => (
    <span style={{ fontSize: "var(--text-body)", color: "var(--ink-primary)", fontWeight: 600 }}>{texto}</span>
  );
  return (
    <nav aria-label="Trilha" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
      {regiao ? link("Brasil", onTudo) : atual("Brasil por região")}
      {regiao && sep}
      {regiao && (uf ? link(regiao, onRegiao) : atual(regiao))}
      {uf && sep}
      {uf && (funcional ? link(uf, onUf) : atual(uf))}
      {funcional && sep}
      {funcional && atual(funcional.ancora_nome)}
    </nav>
  );
}

// A compact resumo row shared by the region and UF summary cards. The headline
// is the dependency drop (IDM today to simulated); the FPM is redistribution
// inside the state (fixed pool), never a loss nor a Union saving.
function ResumoLinhas({ resumo }: { resumo: ResumoAgregacao }) {
  const quedaIdm = resumo.idm_atual - resumo.idm_simulado;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <MiniLinha
        rotulo="IDM médio, atual → simulado"
        valor={`${idm2(resumo.idm_atual)} → ${idm2(resumo.idm_simulado)}`}
        cor={quedaIdm > 0 ? VERDE : undefined}
      />
      <MiniLinha rotulo="orbitantes que reduzem dependência" valor={resumo.n_orbitantes.toLocaleString("pt-BR")} />
      <MiniLinha rotulo="regiões que agregam" valor={`${resumo.n_regioes_agregadoras}`} />
      <MiniLinha rotulo="municípios sem região" valor={`${resumo.n_isolados}`} />
      <MiniLinha rotulo="municípios" valor={resumo.n_municipios.toLocaleString("pt-BR")} />
      <MiniLinha rotulo="máquina hoje" valor={reaisCompacto(resumo.maquina)} />
      <MiniLinha rotulo="FPM redistribuído no estado" valor={reaisCompacto(resumo.fpm_redistribuido)} />
      <MiniLinha
        rotulo="economia potencial"
        valor={`${reaisCompacto(resumo.economia_piso)} a ${reaisCompacto(resumo.economia_teto)}`}
        cor={VERDE}
      />
      <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
        piso: câmaras suprimidas (determinístico); teto: mais a administração dos
        municípios absorvidos, parte dela permanente, então o real fica abaixo do teto.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", alignItems: "baseline" }}>
        <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-secondary)" }}>centro de serviço na sede</span>
        <span className="tabular" style={{ fontSize: "var(--text-caption)" }}>
          <span style={{ color: VERDE }}>{resumo.estrutura_dist.preservada} consolidado</span>{" · "}
          <span style={{ color: AMBAR }}>{resumo.estrutura_dist.parcial} parcial</span>{" · "}
          <span style={{ color: VERMELHO }}>{resumo.estrutura_dist.fraca} ausente</span>
        </span>
      </div>
    </div>
  );
}

function MiniLinha({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", alignItems: "baseline" }}>
      <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-secondary)" }}>{rotulo}</span>
      <span className="tabular" style={{ fontSize: "var(--text-caption)", color: cor ?? "var(--ink-primary)" }}>{valor}</span>
    </div>
  );
}

// Level 1: the five macro-regions, each a card of totals.
function CartoesRegiao({
  analise,
  nomes,
  onEscolher,
}: {
  analise: AnaliseAgregacao;
  nomes: Map<string, string>;
  onEscolher: (r: string) => void;
}) {
  const regioes = ORDEM_REGIOES.filter((r) => analise.regioes[r]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Cabecalho
        titulo="Agregação por região funcional"
        sub="E se cada região funcional fosse um só município, com sede na cidade que já presta o serviço? Escolha uma macrorregião para descer até o estado e a região."
      />
      <ComoLerAgregacao analise={analise} nomes={nomes} />

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          padding: "var(--space-3)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-card)",
          background: "color-mix(in srgb, var(--accent) 8%, transparent)",
        }}
      >
        <span style={{ fontSize: "var(--text-body)", fontWeight: 700 }}>Brasil, agregação por região funcional</span>
        <ResumoLinhas resumo={analise.nacional} />
      </section>

      {regioes.map((r) => (
        <CartaoBotao key={r} titulo={r} onClick={() => onEscolher(r)}>
          <ResumoLinhas resumo={analise.regioes[r]!.resumo} />
        </CartaoBotao>
      ))}
    </div>
  );
}

// Reading guide for the aggregation cards: what a functional region is and what
// each summary line measures, in the order the lines appear in ResumoLinhas.
// Definitions mirror pipeline/construir_cenarios.py. The worked example reads a
// real functional region from the artifact, so its figures never drift from the
// cards; it is omitted if that region is absent from a regenerated artifact.
const ANCORA_EXEMPLO = "3527207"; // Lorena (SP): small, consolidated seat, clear IDM drop

function ComoLerAgregacao({ analise, nomes }: { analise: AnaliseAgregacao; nomes: Map<string, string> }) {
  const exemplo = Object.values(analise.regioes)
    .flatMap((r) => (r ? Object.values(r.ufs) : []))
    .flatMap((u) => u?.regioes ?? [])
    .find((rf) => rf.ancora === ANCORA_EXEMPLO);
  const absorvidos = exemplo
    ? exemplo.membros.filter((c) => c !== exemplo.ancora).map((c) => nomes.get(c)).filter(Boolean)
    : [];
  const item = (termo: string, texto: string) => (
    <li>
      <strong style={{ color: "var(--ink-primary)" }}>{termo}:</strong> {texto}
    </li>
  );
  return (
    <details
      open
      style={{
        padding: "var(--space-2) var(--space-3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-1)",
        fontSize: "var(--text-caption)",
        color: "var(--ink-secondary)",
        lineHeight: 1.5,
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink-primary)" }}>
        O que é e como ler
      </summary>
      <p style={{ margin: "var(--space-2) 0" }}>
        Uma <strong style={{ color: "var(--ink-primary)" }}>região funcional</strong> é uma
        cidade âncora, polo ou semipolo do REGIC, mais os municípios que dependem
        dela para hospital, faculdade e banco. As 1.443 regiões cobrem o país
        inteiro, e cada município está em exatamente uma. A análise pergunta o que
        mudaria se cada região funcional fosse um só município, com sede na
        âncora. É uma leitura estrutural e descritiva, não uma recomendação de
        fusão.
      </p>
      <ul style={{ margin: 0, paddingLeft: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {item(
          "IDM médio, atual → simulado",
          "dependência média ponderada pela população, hoje e na simulação, em que cada região passa a ter o IDM da sua âncora. Quanto maior a queda, mais dependência a rede urbana já resolve na âncora.",
        )}
        {item(
          "orbitantes que reduzem dependência",
          "municípios que seriam absorvidos pela âncora da sua região.",
        )}
        {item(
          "regiões que agregam e municípios sem região",
          "regiões em que a âncora absorve ao menos um município, e municípios que não orbitam nenhum outro e por isso ficam como estão.",
        )}
        {item(
          "máquina hoje",
          "despesa atual com as funções Legislativa e Administração (Siconfi, DCA 2024).",
        )}
        {item(
          "FPM redistribuído no estado",
          "o Fundo de Participação dos Municípios é um valor fixo por estado, então o que a região fundida deixaria de receber volta aos demais municípios do mesmo estado. Não é economia da União.",
        )}
        {item(
          "economia potencial",
          "faixa entre o piso, só as câmaras municipais suprimidas, e o teto, que soma a administração dos municípios absorvidos. Parte da administração é permanente, então o valor real fica abaixo do teto.",
        )}
        {item(
          "centro de serviço na sede",
          "nas regiões que agregam, o acesso efetivo na âncora. Consolidado: tem UTI, curso superior presencial e agência bancária. Parcial: tem o equipamento sem o acesso completo, como hospital sem UTI, faculdade só a distância ou correspondente sem agência. Ausente: não tem hospital, faculdade nem banco.",
        )}
      </ul>
      {exemplo && absorvidos.length > 0 && (
        <p style={{ margin: "var(--space-2) 0 0" }}>
          <strong style={{ color: "var(--ink-primary)" }}>Exemplo:</strong> a região
          funcional de {exemplo.ancora_nome} ({exemplo.uf}) reúne {exemplo.ancora_nome}{" "}
          e {absorvidos.join(", ").replace(/, ([^,]*)$/, " e $1")}, com{" "}
          {exemplo.populacao.toLocaleString("pt-BR")} habitantes. Se fosse um só
          município, o IDM médio cairia de {idm2(exemplo.idm_atual)} para{" "}
          {idm2(exemplo.idm_simulado)}
          {exemplo.estrutura.nivel === "preservada"
            ? ", e a sede tem UTI, curso presencial e agência bancária, um centro de serviço consolidado"
            : ""}
          . A máquina pública custa hoje {reaisCompacto(exemplo.maquina)}{" "}
          por ano, a economia potencial fica entre {reaisCompacto(exemplo.economia_piso)}{" "}
          e {reaisCompacto(exemplo.economia_teto)}, e {reaisCompacto(exemplo.perda)} de
          FPM passariam aos demais municípios de {exemplo.uf}.
        </p>
      )}
    </details>
  );
}

// Level 2: the UFs of a region.
function CartoesUF({ regiao, bloco, onEscolher }: { regiao: string; bloco?: BlocoRegiao; onEscolher: (uf: string) => void }) {
  if (!bloco) return <EstadoVazio mensagem="Sem dados para esta região." />;
  const ufs = Object.keys(bloco.ufs).sort();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Cabecalho titulo={`${regiao}: por UF`} sub="Escolha um estado para ver suas regiões funcionais." />
      {ufs.map((uf) => (
        <CartaoBotao key={uf} titulo={uf} onClick={() => onEscolher(uf)}>
          <ResumoLinhas resumo={bloco.ufs[uf]!.resumo} />
        </CartaoBotao>
      ))}
    </div>
  );
}

// Level 3: the functional regions of a UF, each a row with its structure badge
// and the FPM it would lose on merging.
function ListaFuncionais({ uf, bloco, onEscolher }: { uf: string; bloco?: BlocoUF; onEscolher: (rf: RegiaoFuncional) => void }) {
  if (!bloco) return <EstadoVazio mensagem="Sem dados para este estado." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Cabecalho
        titulo={`${uf}: regiões funcionais`}
        sub={`${bloco.regioes.length} regiões, da maior para a menor. Escolha uma para a análise completa.`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {bloco.regioes.map((rf) => (
          <button
            key={rf.id}
            type="button"
            onClick={() => onEscolher(rf)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              textAlign: "left",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              background: "var(--surface-1)",
              color: "var(--ink-primary)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", alignItems: "center" }}>
              <span style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{rf.ancora_nome}</span>
              <SeloEstrutura nivel={rf.estrutura.nivel} compacto />
            </div>
            <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-secondary)" }}>
              {rf.n} municípios · IDM{" "}
              <span style={{ color: rf.idm_atual > rf.idm_simulado ? VERDE : undefined }}>
                {idm2(rf.idm_atual)} → {idm2(rf.idm_simulado)}
              </span>{" "}
              · máquina {reaisCompacto(rf.maquina)}
              {rf.economia_teto > 0 && (
                <>
                  {" "}· economia{" "}
                  <span style={{ color: VERDE }}>
                    {reaisCompacto(rf.economia_piso)} a {reaisCompacto(rf.economia_teto)}
                  </span>
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Cabecalho({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>{titulo}</h2>
      <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>{sub}</p>
    </div>
  );
}

function CartaoBotao({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        textAlign: "left",
        padding: "var(--space-3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-1)",
        color: "var(--ink-primary)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--text-body)", fontWeight: 700 }}>{titulo}</span>
        <ChevronRight size={16} aria-hidden style={{ color: "var(--ink-muted)" }} />
      </div>
      {children}
    </button>
  );
}

// Structure badge: preservada (green), parcial (amber), fraca (red).
function SeloEstrutura({ nivel, compacto }: { nivel: EstruturaSelo["nivel"]; compacto?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: compacto ? "0 var(--space-2)" : "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-full)",
        border: `1px solid ${NIVEL_COR[nivel]}`,
        color: NIVEL_COR[nivel],
        fontSize: "var(--text-caption)",
        whiteSpace: "nowrap",
      }}
    >
      {NIVEL_ROTULO[nivel]}
    </span>
  );
}

// The full analysis of one functional region: the IDM dependency drop and the
// structure panel first (the point of the aggregation), then the cost readings
// and the report.
function AnaliseFuncional({
  funcional,
  calc,
  nomes,
}: {
  funcional: RegiaoFuncional;
  calc: Calculo;
  nomes: Map<string, string>;
}) {
  const orbitantes = funcional.membros
    .filter((c) => c !== funcional.ancora)
    .map((c) => nomes.get(c))
    .filter((n): n is string => Boolean(n));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>{funcional.ancora_nome}</h2>
          <SeloEstrutura nivel={funcional.estrutura.nivel} />
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
          {funcional.ancora_tipologia} de {funcional.uf} e {funcional.n - 1} orbitantes.
        </p>
        {funcional.tipologia_fundida !== funcional.ancora_tipologia && (
          <p style={{ margin: 0, fontSize: "var(--text-caption)", color: VERDE }}>
            Somada, a sede alcançaria escala e estrutura de {funcional.tipologia_fundida}
            {" "}(heurística de porte, não a classificação do REGIC).
          </p>
        )}
      </div>

      <PainelVeredito funcional={funcional} calc={calc} />

      <PainelIDM funcional={funcional} />

      <PainelEstrutura funcional={funcional} />

      <Cartao rotulo="medido" cor="var(--idm-100)" titulo="Custo hoje" nota="Siconfi DCA 2024; soma da região funcional.">
        <Linha rotulo="Máquina (Legislativa + Administração)" valor={reais(calc.maquinaTotal)} forte />
        <Linha rotulo="Legislativa (câmaras)" valor={reais(calc.legislativaTotal)} />
        <Linha rotulo="Administração" valor={reais(calc.administracaoTotal)} />
        <Linha rotulo="FPM recebido" valor={reais(calc.fpmSomado)} />
        <Linha rotulo="População" valor={calc.populacaoTotal.toLocaleString("pt-BR")} />
      </Cartao>

      <Cartao
        rotulo="aritmética da regra"
        cor="var(--idm-450)"
        titulo="Se fundida na âncora"
        nota="A cota cai para a região; o FPM é bolo fixo, o valor é redistribuído no estado e a União paga o mesmo."
      >
        <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-caption)", color: "var(--ink-secondary)" }}>
          <strong>{funcional.ancora_nome}</strong> vira a sede e absorve {orbitantes.length}{" "}
          {orbitantes.length === 1 ? "município" : "municípios"}: {orbitantes.join(", ")}.
        </p>
        <Linha rotulo="Coeficiente do FPM" valor={`${coef1(calc.coefSomado)} → ${coef1(calc.coefFundido)}`} />
        <Linha rotulo="FPM após a fusão" valor={reais(calc.fpmFundido)} />
        <Linha
          rotulo="FPM a menos para a região"
          valor={`- ${reais(calc.perdaFpm)} (${pct(calc.fracaoPerdida)})`}
          cor={calc.perdaFpm > 0 ? VERMELHO : undefined}
          forte
        />
        <Linha
          rotulo="Câmara suprimida (economia)"
          valor={`+ ${reais(calc.camaraSuprimida)}`}
          cor={calc.camaraSuprimida > 0 ? VERDE : undefined}
        />
      </Cartao>

      <Cartao
        rotulo="especulativo"
        cor="var(--idm-700)"
        titulo="Consórcio: líquido possível"
        nota="Faixa dirigida pelas premissas; sem calibração brasileira."
      >
        <FaixaConsorcio min={calc.consorcioMin} max={calc.consorcioMax} />
        <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)", maxWidth: "70ch" }}>
          O consórcio é as cidades cooperando sem virar uma só: compram juntas,
          dividem equipes e serviços, e cada prefeitura continua existindo, com
          seu próprio FPM. Pode gerar alguma economia ao juntar compras e pessoal,
          mas manter a estrutura compartilhada também custa. Pela conta, o
          resultado anual fica entre um prejuízo de {reais(-calc.consorcioMin)} e
          uma economia de {reais(calc.consorcioMax)}, a depender de suposições
          ainda não medidas no Brasil; por isso não dá para cravar se sobra ou
          falta dinheiro.
        </p>
      </Cartao>

      <RelatorioHonesto funcional={funcional} calc={calc} />
    </div>
  );
}

// Structural reading of the region's seat, first block of the analysis. It
// describes the service center and states the measured dependency drop as a
// fact; it never says a merger is favorable or advised (the comprehension
// rehearsal showed that wording reads as a recommendation). Color reflects the
// structure level, not a verdict on merging.
function PainelVeredito({ funcional, calc }: { funcional: RegiaoFuncional; calc: Calculo }) {
  const nivel = funcional.estrutura.nivel;
  const cor = NIVEL_COR[nivel];
  const de = `de ${idm2(funcional.idm_atual)} para ${idm2(funcional.idm_simulado)}`;
  let texto: string;
  if (nivel === "preservada") {
    texto =
      `A sede ${funcional.ancora_nome} tem UTI, curso superior presencial e agência bancária, e ` +
      `concentra o serviço que os ${funcional.n - 1} orbitantes já procuram. Somada, a dependência ` +
      `medida da região iria ${de}, porque a unidade passa a conter o centro de serviço. A cota de ` +
      `FPM que muda nesse arranjo (${reais(calc.perdaFpm)}) é redistribuída no estado, não ` +
      `economizada pela União.`;
  } else if (nivel === "parcial") {
    texto =
      `A sede ${funcional.ancora_nome} tem o equipamento, mas não o acesso efetivo em ao menos um ` +
      `serviço (por exemplo hospital sem UTI, ou faculdade só de EAD): o centro de serviço é ` +
      `parcial, e parte do serviço permanece em um polo maior. A dependência medida iria ${de}.`;
  } else {
    texto =
      `A sede ${funcional.ancora_nome} não tem hospital, faculdade nem banco próprios: a região não ` +
      `tem um centro de serviço interno, e permanece dependente de um polo externo.`;
  }
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: `2px solid ${cor}`,
        borderRadius: "var(--radius-card)",
      }}
    >
      <span style={{ fontSize: "var(--text-caption)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-muted)" }}>
        leitura estrutural
      </span>
      <strong style={{ fontSize: "var(--text-lg)", color: cor }}>{NIVEL_CENTRO[nivel]}</strong>
      <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-body)", color: "var(--ink-secondary)", maxWidth: "74ch" }}>
        {texto}
      </p>
    </section>
  );
}

// The point of the aggregation: the dependency drop. IDM today (orbitantes
// dependent) against the simulated IDM (the merged unit takes the anchor's
// low-dependency profile). A toggle recolors the cluster on the map.
function PainelIDM({ funcional }: { funcional: RegiaoFuncional }) {
  const queda = funcional.idm_atual - funcional.idm_simulado;
  return (
    <Cartao
      rotulo="dependência"
      cor={queda > 0 ? VERDE : "var(--idm-450)"}
      titulo="IDM: atual e simulado"
      nota="A queda vem de a unidade passar a conter o polo, não de nova obra: formaliza o acesso que a órbita já usa."
    >
      <Linha rotulo="IDM médio hoje" valor={idm2(funcional.idm_atual)} />
      <Linha
        rotulo="IDM se agregada na âncora"
        valor={idm2(funcional.idm_simulado)}
        cor={queda > 0 ? VERDE : undefined}
        forte
      />
      <Linha rotulo="Queda de dependência" valor={`- ${idm2(Math.max(0, queda))}`} cor={queda > 0 ? VERDE : undefined} />
    </Cartao>
  );
}

// The map recolor toggle, one control for every level: current per-municipality
// IDM against the simulated IDM of each municipality's functional region. Made
// prominent so the reader spots the comparison at once.
function AlternaSimulado({ simular, onSimular }: { simular: boolean; onSimular: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--ink-primary)" }}>
        <MapIcon size={16} aria-hidden style={{ color: "var(--accent)" }} />
        IDM no mapa
      </span>
      <div
        role="group"
        aria-label="Colorir o mapa por IDM atual ou simulado"
        style={{ display: "inline-flex", border: "1px solid var(--accent)", borderRadius: "var(--radius-control)", overflow: "hidden" }}
      >
        {([["atual", false], ["simulado", true]] as const).map(([rotulo, v]) => (
          <button
            key={rotulo}
            type="button"
            aria-pressed={simular === v}
            onClick={() => onSimular(v)}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-body)",
              fontWeight: simular === v ? 700 : 400,
              color: simular === v ? "var(--on-accent)" : "var(--accent)",
              background: simular === v ? "var(--accent)" : "transparent",
            }}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

// Structure reading: does the aggregate keep a service center? The whole point
// of the analysis, the answer to "showing FPM falls is fine as long as cities
// do not lose structure".
function PainelEstrutura({ funcional }: { funcional: RegiaoFuncional }) {
  const { estrutura, ancora_nome } = funcional;
  return (
    <Cartao
      rotulo="estrutura"
      cor={NIVEL_COR[estrutura.nivel]}
      titulo="A sede tem acesso, não só presença?"
      nota="CNES (UTI), INEP (curso presencial) e BACEN (agência); presença não é acesso."
    >
      <LinhaAcesso servico="Saúde" presenca={estrutura.hospital} rotuloPresenca="hospital" acesso={estrutura.uti} rotuloAcesso="UTI" />
      <LinhaAcesso servico="Ensino" presenca={estrutura.ies} rotuloPresenca="faculdade" acesso={estrutura.presencial} rotuloAcesso="presencial" />
      <LinhaAcesso servico="Banco" presenca={estrutura.hospital || estrutura.ies || estrutura.agencia} rotuloPresenca="correspondente" acesso={estrutura.agencia} rotuloAcesso="agência" />
      <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-body)", color: "var(--ink-secondary)" }}>
        {estrutura.nivel === "preservada"
          ? `${ancora_nome} reúne UTI, curso presencial e agência: é um centro de serviço de fato. Fundir na sede não deixa a região sem acesso.`
          : estrutura.nivel === "parcial"
            ? `${ancora_nome} tem o equipamento, mas não o acesso efetivo em ao menos um serviço; para esse, a região seguiria dependente de um polo maior.`
            : `${ancora_nome} não tem hospital, faculdade nem banco próprios; a região continuaria dependente de um polo externo.`}
      </p>
    </Cartao>
  );
}

// One service row: the facility (presence) against effective access, so the
// reader sees a hospital without UTI, or a correspondent without a branch.
function LinhaAcesso({
  servico,
  presenca,
  rotuloPresenca,
  acesso,
  rotuloAcesso,
}: {
  servico: string;
  presenca: boolean;
  rotuloPresenca: string;
  acesso: boolean;
  rotuloAcesso: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", alignItems: "baseline" }}>
      <span style={{ fontSize: "var(--text-body)", color: "var(--ink-secondary)" }}>{servico}</span>
      <span style={{ fontSize: "var(--text-caption)" }}>
        <span style={{ color: presenca ? "var(--ink-secondary)" : "var(--ink-muted)" }}>
          {presenca ? rotuloPresenca : `sem ${rotuloPresenca}`}
        </span>
        {" · "}
        <span style={{ color: acesso ? VERDE : VERMELHO, fontWeight: 600 }}>
          {acesso ? rotuloAcesso : `sem ${rotuloAcesso}`}
        </span>
      </span>
    </div>
  );
}

function Cartao({
  rotulo,
  cor,
  titulo,
  nota,
  children,
}: {
  rotulo: string;
  cor: string;
  titulo: string;
  nota: string;
  children: ReactNode;
}) {
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
        borderTop: `3px solid ${cor}`,
      }}
    >
      <span style={{ fontSize: "var(--text-caption)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-muted)" }}>
        {rotulo}
      </span>
      <h3 style={{ margin: 0, fontSize: "var(--text-body)", color: "var(--ink-primary)" }}>{titulo}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>{children}</div>
      <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>{nota}</span>
    </section>
  );
}

function Linha({ rotulo, valor, forte, cor }: { rotulo: string; valor: string; forte?: boolean; cor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "baseline" }}>
      <span style={{ fontSize: "var(--text-body)", color: "var(--ink-secondary)" }}>{rotulo}</span>
      <span className="tabular" style={{ fontSize: "var(--text-body)", fontWeight: forte ? 700 : 400, color: cor ?? "var(--ink-primary)", textAlign: "right" }}>
        {valor}
      </span>
    </div>
  );
}

// Consorcio net band, red (prejuizo) to green (economia), straddling zero.
function FaixaConsorcio({ min, max }: { min: number; max: number }) {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  const span = hi - lo || 1;
  const esq = ((min - lo) / span) * 100;
  const larg = ((max - min) / span) * 100;
  const zero = ((0 - lo) / span) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <div style={{ position: "relative", height: "var(--space-4)" }} aria-hidden>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${esq}%`,
            width: `${larg}%`,
            height: "var(--space-2)",
            transform: "translateY(-50%)",
            background: `linear-gradient(90deg, ${VERMELHO}, ${VERDE})`,
            borderRadius: "var(--radius-full)",
          }}
        />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${zero}%`, width: "1.5px", background: "var(--ink-muted)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-caption)" }}>
        <span style={{ color: VERMELHO }}>{reais(min)} prejuízo</span>
        <span style={{ color: "var(--ink-muted)" }}>zero</span>
        <span style={{ color: VERDE }}>economia {reais(max)}</span>
      </div>
    </div>
  );
}

// The report in plain language, templated on the functional region: measured
// cost first, then the FPM-rule verdict with the structure guarantee, then the
// uncertain consorcio, then a synthesis.
function RelatorioHonesto({ funcional, calc }: { funcional: RegiaoFuncional; calc: Calculo }) {
  const solto = { margin: 0, fontSize: "var(--text-body)", color: "var(--ink-secondary)", maxWidth: "74ch" } as const;
  const forte = (cor: string) => ({ color: cor, fontWeight: 700 });
  const liquidoFusao = calc.perdaFpm - calc.camaraSuprimida;
  const coberturaCamara = calc.perdaFpm > 0 ? calc.camaraSuprimida / calc.perdaFpm : 0;
  const preservada = funcional.estrutura.nivel === "preservada";

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--surface-page)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Visão geral</h3>

      <p style={solto}>
        <strong>Primeira: o custo atual é o único número medido.</strong> Os{" "}
        {funcional.n} municípios que orbitam {funcional.ancora_nome} custam hoje{" "}
        <strong>{reais(calc.maquinaTotal)}</strong> de máquina ao ano. O resto é
        conta de cenário.
      </p>

      <p style={solto}>
        <strong>Segunda: fundir na âncora reduz o FPM; a estrutura de serviço
        permanece na sede.</strong>{" "}
        {preservada
          ? `${funcional.ancora_nome} tem UTI, curso presencial e agência e já serve essas cidades; virar sede formaliza a dependência que já existe. `
          : `${funcional.ancora_nome} não reúne o acesso efetivo em todos os serviços, então parte permanece em um polo maior. `}
        O repasse passa de {reais(calc.fpmSomado)} para {reais(calc.fpmFundido)},
        uma variação de{" "}
        <strong style={forte(VERMELHO)}>- {reais(calc.perdaFpm)} ({pct(calc.fracaoPerdida)})</strong>.
        A economia com as câmaras
        (<strong style={forte(VERDE)}>+ {reais(calc.camaraSuprimida)}</strong>) equivale
        a {pct(coberturaCamara)} dessa redução; o valor a menos não é economizado
        pela União: é redistribuído aos demais municípios do estado.
      </p>

      <p style={solto}>
        <strong>Terceira: o consórcio não altera o FPM; o ganho é incerto.</strong>{" "}
        Como não há fusão, o repasse não muda. O líquido calculado vai de{" "}
        <strong style={forte(VERMELHO)}>{reais(calc.consorcioMin)}</strong> (prejuízo) a{" "}
        <strong style={forte(VERDE)}>{reais(calc.consorcioMax)}</strong> (economia)
        por ano; a literatura internacional o situa perto de zero no longo prazo.
      </p>

      <p style={solto}>
        <strong>Síntese:</strong> a variação da fusão é determinada pela regra do
        FPM, uma redução líquida da ordem de{" "}
        <strong style={forte(VERMELHO)}>{reais(liquidoFusao)}</strong> por ano para a
        região; a do consórcio depende de premissas ainda não calibradas para o
        Brasil, com sinal em aberto. Boa parte da administração (arrecadação,
        folha, planejamento) permanece em qualquer arranjo.
      </p>
    </section>
  );
}

// Walk any GeoJSON coordinate nesting applying a visitor to each [lng, lat] pair.
function percorrerCoordenadas(coords: unknown, visit: (x: number, y: number) => void): void {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    visit(coords[0], coords[1]);
    return;
  }
  for (const c of coords) percorrerCoordenadas(c, visit);
}
