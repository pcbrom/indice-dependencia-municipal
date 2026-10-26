// Data loading and filtering. The pipeline publishes pre-aggregated JSON under
// app/public/data/ (see docs/CONTRATO_DADO.md and docs/DECISAO_PAINEL.md);
// the client fetches it once and filters in memory with native arrays. There is
// no SQL engine in the browser: for ~5570 municipalities the payload fits in
// memory and the CDN is the cache.

import type {
  Destaques,
  FiltrosMapa,
  Ligacao,
  Manifesto,
  Municipio,
  Tipologia,
} from "./types";

export type {
  Destaques,
  EscalaIDM,
  FiltrosMapa,
  FonteRef,
  Ligacao,
  Manifesto,
  Municipio,
  Rota,
  Tipologia,
  TipoServico,
} from "./types";

// Base path honors Vite's configured base so the build works under any subpath.
const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

// In-session memo of resolved fetches. TanStack Query can replace this later;
// a plain map keeps the skeleton dependency-light.
const cache = new Map<string, Promise<unknown>>();

async function loadJson<T>(file: string): Promise<T> {
  const key = file;
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const promise = fetch(`${DATA_BASE}${file}`).then((res) => {
    if (!res.ok) {
      throw new Error(`Falha ao carregar ${file}: ${res.status}`);
    }
    return res.json() as Promise<T>;
  });
  cache.set(key, promise);
  return promise;
}

// Full national slice or a per-UF slice for on-demand loading. The pipeline
// serves recortes named municipios.json and municipios-<UF>.json.
export function carregarMunicipios(uf?: string): Promise<Municipio[]> {
  const file = uf ? `municipios-${uf.toLowerCase()}.json` : "municipios.json";
  return loadJson<Municipio[]>(file);
}

export function carregarLigacoes(): Promise<Ligacao[]> {
  return loadJson<Ligacao[]>("ligacoes.json");
}

// Service-structure badge of a functional region, read from its anchor: full
// (hospital and higher education), partial (one of them), weak (neither).
export interface EstruturaSelo {
  hospital: boolean;
  ies: boolean;
  // Effective access at the seat: UTI bed, in-person higher education, bank
  // branch. The nivel is read from these, not from mere presence.
  uti: boolean;
  presencial: boolean;
  agencia: boolean;
  nivel: "preservada" | "parcial" | "fraca";
}

// Effective-access layer per municipality (health, education, banking), a
// descriptive layer beside the IDM, never folded into the index. See
// pipeline/extrair_acesso_*.py and docs/DECISAO_ACESSO.md.
export interface AcessoMunicipio {
  codigo_ibge: string;
  uti: boolean;
  uti_leitos: number;
  presencial: boolean;
  n_cursos_presenciais: number;
  agencia: boolean;
  n_agencias: number;
  correspondente: boolean;
}

let acessoMap: Promise<Map<string, AcessoMunicipio>> | null = null;

export function carregarAcesso(): Promise<Map<string, AcessoMunicipio>> {
  if (!acessoMap) {
    acessoMap = Promise.all([
      loadJson<{ municipios: { codigo_ibge: string; tem_uti?: boolean; uti_leitos?: number }[] }>("acesso_saude.json"),
      loadJson<{ municipios: { codigo_ibge: string; ies_presencial?: boolean; n_cursos_presenciais?: number }[] }>("acesso_educacao.json"),
      loadJson<{ municipios: { codigo_ibge: string; tem_agencia?: boolean; n_agencias?: number; tem_correspondente?: boolean }[] }>("acesso_bancario.json"),
    ]).then(([saude, edu, banco]) => {
      const mapa = new Map<string, AcessoMunicipio>();
      const pegar = (c: string) =>
        mapa.get(c) ??
        mapa
          .set(c, {
            codigo_ibge: c,
            uti: false, uti_leitos: 0, presencial: false, n_cursos_presenciais: 0,
            agencia: false, n_agencias: 0, correspondente: false,
          })
          .get(c)!;
      for (const r of saude.municipios) {
        const a = pegar(r.codigo_ibge);
        a.uti = Boolean(r.tem_uti);
        a.uti_leitos = r.uti_leitos ?? 0;
      }
      for (const r of edu.municipios) {
        const a = pegar(r.codigo_ibge);
        a.presencial = Boolean(r.ies_presencial);
        a.n_cursos_presenciais = r.n_cursos_presenciais ?? 0;
      }
      for (const r of banco.municipios) {
        const a = pegar(r.codigo_ibge);
        a.agencia = Boolean(r.tem_agencia);
        a.n_agencias = r.n_agencias ?? 0;
        a.correspondente = Boolean(r.tem_correspondente);
      }
      return mapa;
    });
  }
  return acessoMap;
}

// One REGIC functional region: a polo/semipolo anchor plus its orbitantes, the
// unit of the aggregation analysis (see pipeline/construir_cenarios.py). All
// euro figures are precomputed; membros drives the map and the panels.
export interface RegiaoFuncional {
  id: string;
  ancora: string;
  ancora_nome: string;
  ancora_tipologia: string;
  uf: string;
  regiao: string;
  n: number;
  populacao: number;
  maquina: number;
  legislativa: number;
  administracao: number;
  fpm_hoje: number;
  coef_somado: number;
  coef_fundido: number;
  fpm_fundido: number;
  perda: number;
  frac_perdida: number;
  camara_suprimida: number;
  // Administration of the absorbed (non-anchor) municipalities, and the economy
  // as a measured interval: floor = suppressed chambers (deterministic), ceiling
  // = floor + absorbed administration (upper bound; part of Administracao is
  // permanent, so the real economy sits below the ceiling). See construir_cenarios.py.
  admin_absorvida: number;
  economia_piso: number;
  economia_teto: number;
  estrutura: EstruturaSelo;
  idm_atual: number;
  idm_simulado: number;
  // Tier the merged unit would reach (heuristic, not the REGIC classification):
  // the anchor's tier, promoted one step when the merger gains scale and full
  // structure. See pipeline/construir_cenarios.py.
  tipologia_fundida: string;
  membros: string[];
}

export interface ResumoAgregacao {
  n_regioes: number;
  // Cells of the partition that actually aggregate (more than one
  // municipality), and cells of a single municipality, where merging is a no-op.
  n_regioes_agregadoras: number;
  n_isolados: number;
  n_municipios: number;
  n_orbitantes: number;
  maquina: number;
  fpm_hoje: number;
  // FPM that changes hands if the regions merge. The pool is fixed, so summed
  // across regions it is redistribution inside the state, never a national loss
  // nor a Union saving.
  fpm_redistribuido: number;
  camara_suprimida: number;
  admin_absorvida: number;
  // Potential economy of the merge as a measured interval, summed over the scope:
  // floor = suppressed chambers; ceiling = floor + absorbed administration.
  economia_piso: number;
  economia_teto: number;
  pct_estrutura: number;
  idm_atual: number;
  idm_simulado: number;
  // Distribution of the structural reading (service center at the seat) across
  // the functional regions in this scope.
  estrutura_dist: { preservada: number; parcial: number; fraca: number };
}

export interface BlocoUF {
  resumo: ResumoAgregacao;
  regioes: RegiaoFuncional[];
}

export interface BlocoRegiao {
  resumo: ResumoAgregacao;
  ufs: Record<string, BlocoUF>;
}

export interface AnaliseAgregacao {
  fonte: string;
  unidade: string;
  n_regioes_funcionais: number;
  nacional: ResumoAgregacao;
  regioes: Record<string, BlocoRegiao>;
}

export function carregarAnalise(): Promise<AnaliseAgregacao> {
  return loadJson<AnaliseAgregacao>("analise_agregacao.json");
}

// Dissolved outer boundary of each selectable scope (functional region, UF,
// macro-region), for the clean contour of the current selection. Each feature
// carries tipo and id in properties. See pipeline/construir_cenarios.py.
export interface ContornoGeoJSON {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { tipo: string; id: string }; geometry: unknown }[];
}

export function carregarContornos(): Promise<ContornoGeoJSON> {
  return loadJson<ContornoGeoJSON>("contornos.geojson");
}

export function carregarDestaques(): Promise<Destaques> {
  return loadJson<Destaques>("destaques.json");
}

export function carregarManifesto(): Promise<Manifesto> {
  return loadJson<Manifesto>("manifesto.json");
}

// Simplified municipal mesh. Each feature carries codigo_ibge in properties for
// the client-side join with the IDM (see pipeline malha.py).
export interface MalhaFeature {
  type: "Feature";
  properties: { codigo_ibge?: string; [k: string]: unknown };
  geometry: unknown;
}
export interface MalhaGeoJSON {
  type: "FeatureCollection";
  features: MalhaFeature[];
}

export function carregarMalha(): Promise<MalhaGeoJSON> {
  return loadJson<MalhaGeoJSON>("malha.geojson");
}

// Macro-region contours dissolved from the mesh (see pipeline regioes.py). Each
// feature carries the region name and a representative interior point (centro)
// for label placement on the map.
export interface RegiaoFeature {
  type: "Feature";
  properties: { regiao: string; centro: [number, number] };
  geometry: unknown;
}
export interface RegioesGeoJSON {
  type: "FeatureCollection";
  features: RegiaoFeature[];
}

export function carregarRegioes(): Promise<RegioesGeoJSON> {
  return loadJson<RegioesGeoJSON>("regioes.geojson");
}

// World countries (Natural Earth 110m, public domain), Brazil removed since it
// is the choropleth. Decorative scenery drawn faint behind the map.
export function carregarMundo(): Promise<MalhaGeoJSON> {
  return loadJson<MalhaGeoJSON>("mundo.geojson");
}

export function carregarValidacao(): Promise<Record<string, unknown>> {
  return loadJson<Record<string, unknown>>("validacao.json");
}

// Automatic interpretive reading per municipality (interpretacoes.json), produced
// by the batch harness (interpretacao/, docs/INTERPRETACAO.md). Descriptive, never
// causal or a management judgement. A municipality the GATE could not clear carries
// sem_leitura true and only the templated ranking slice.
export interface Interpretacao {
  codigo_ibge: string;
  como_esta?: string;
  problema?: string;
  rede?: string;
  para_o_gestor?: string[];
  telas: { mapa?: string; perfil?: string; fiscal?: string; ranking?: string };
  sem_leitura?: boolean;
  // True when the harness composed the reading deterministically from the
  // resolved hooks, because the model could not phrase them without inverting
  // the role even after retries. The text is gate-safe and correct; only its
  // attribution differs, so the UI labels it as harness-composed, not model-written.
  deterministica?: boolean;
}

// The artifact is a single file (~7 MB); load once and index by codigo_ibge. The
// built map is memoized on top of loadJson's per-file cache.
let interpretacoesMap: Promise<Map<string, Interpretacao>> | null = null;
export function carregarInterpretacoes(): Promise<Map<string, Interpretacao>> {
  if (!interpretacoesMap) {
    interpretacoesMap = loadJson<{ municipios: Interpretacao[] }>("interpretacoes.json").then(
      (d) => new Map(d.municipios.map((r) => [r.codigo_ibge, r])),
    );
  }
  return interpretacoesMap;
}

export function carregarMunicipio(
  codigoIbge: string,
): Promise<Municipio | undefined> {
  return carregarMunicipios().then((lista) =>
    lista.find((m) => m.codigo_ibge === codigoIbge),
  );
}

// Accent- and case-insensitive normalization for the municipality search.
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Autocomplete by name, tolerant to accent and spelling; resolves to codigo_ibge
// at the call site. Returns a bounded list to keep the dropdown light.
export function buscarMunicipios(
  query: string,
  lista: Municipio[],
  limite = 20,
): Municipio[] {
  const q = normalizar(query);
  if (q.length === 0) return [];
  const out: Municipio[] = [];
  for (const m of lista) {
    if (normalizar(m.nome).includes(q)) {
      out.push(m);
      if (out.length >= limite) break;
    }
  }
  return out;
}

// In-memory filter for the map and fiscal screens. Every predicate is optional
// except the tipologia toggle, which acts as an on/off per class.
export function filtrarMunicipios(
  lista: Municipio[],
  filtros: FiltrosMapa,
): Municipio[] {
  const { uf, faixaIdm, porte, tipologiaAtiva } = filtros;
  const ativas = new Set<Tipologia>(tipologiaAtiva);
  return lista.filter((m) => {
    if (uf && m.uf !== uf) return false;
    if (porte && m.porte_faixa !== porte) return false;
    if (ativas.size > 0 && !ativas.has(m.tipologia)) return false;
    if (faixaIdm) {
      const [lo, hi] = faixaIdm;
      if (m.idm < lo || m.idm > hi) return false;
    }
    return true;
  });
}

// Median IDM of a slice, for the map summary strip.
export function medianaIdm(lista: Municipio[]): number {
  if (lista.length === 0) return 0;
  const ordenado = lista.map((m) => m.idm).sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  if (ordenado.length % 2 === 1) return ordenado[meio] ?? 0;
  return ((ordenado[meio - 1] ?? 0) + (ordenado[meio] ?? 0)) / 2;
}

// Fiscal quadrant of a municipality, cut by the median of its own porte (never
// the national average, per docs/DECISAO_CAUSAL). Descriptive of revenue
// structure only, not a management grade: the horizontal axis is dependence on
// the FPM transfer, the vertical axis is the budget size relative to local GDP.
export interface CortesPorte {
  fpm: number; // median FPM/receita of the porte
  pib: number; // median receita/PIB of the porte
}

export interface QuadranteFiscal {
  chave: "base-propria" | "orcamento-repasse" | "autonomo" | "dependente" | "sem-referencia";
  rotulo: string;
}

export function medianaNumeros(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 1
    ? (ord[meio] ?? 0)
    : ((ord[meio - 1] ?? 0) + (ord[meio] ?? 0)) / 2;
}

// Median FPM/receita and receita/PIB per porte, computed once over the national
// list so a municipality is always compared with peers of the same size.
export function medianasPorPorteFiscal(
  municipios: Municipio[],
): Map<string, CortesPorte> {
  const grupos = new Map<string, { fpm: number[]; pib: number[] }>();
  for (const m of municipios) {
    const g = grupos.get(m.porte_faixa) ?? { fpm: [], pib: [] };
    g.fpm.push(m.razao_fpm_receita);
    g.pib.push(m.razao_receita_pib);
    grupos.set(m.porte_faixa, g);
  }
  const cortes = new Map<string, CortesPorte>();
  for (const [porte, g] of grupos) {
    cortes.set(porte, {
      fpm: medianaNumeros(g.fpm),
      pib: medianaNumeros(g.pib),
    });
  }
  return cortes;
}

export function quadranteFiscal(
  m: Municipio,
  cortes: Map<string, CortesPorte>,
): QuadranteFiscal {
  const corte = cortes.get(m.porte_faixa);
  if (!corte) return { chave: "sem-referencia", rotulo: "sem referência de porte" };
  const dependeRepasse = m.razao_fpm_receita >= corte.fpm;
  const orcamentoAlto = m.razao_receita_pib >= corte.pib;
  if (!dependeRepasse && orcamentoAlto) {
    return { chave: "base-propria", rotulo: "Base própria robusta" };
  }
  if (dependeRepasse && orcamentoAlto) {
    return { chave: "orcamento-repasse", rotulo: "Orçamento sustentado pelo repasse" };
  }
  if (!dependeRepasse && !orcamentoAlto) {
    return { chave: "autonomo", rotulo: "Autônomo e enxuto" };
  }
  return { chave: "dependente", rotulo: "Dependente do repasse" };
}

// Per-class counts for the tipologia filter chips.
export function contarTipologia(
  lista: Municipio[],
): Record<Tipologia, number> {
  const base: Record<Tipologia, number> = {
    polo: 0,
    "semi-polo": 0,
    orbitante: 0,
  };
  for (const m of lista) base[m.tipologia] += 1;
  return base;
}

// Display formatting lives in the client; the contract ships raw reais.
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatarReais(valor: number): string {
  return brl.format(valor);
}

// Display label for a porte band. Only "ate 5k" needs an accent; the other
// bands render as-is. The underlying data value ("ate 5k") stays unaccented so
// joins, filters, grouping and ORDEM_PORTE keep working; this only affects text.
export function rotuloPorte(porte: string): string {
  return porte === "ate 5k" ? "até 5k" : porte;
}

export function formatarPercentual(fracao: number, casas = 0): string {
  // pt-BR decimal separator (comma), consistent with the other figures.
  return `${(fracao * 100).toFixed(casas).replace(".", ",")}%`;
}

const inteiroBr = new Intl.NumberFormat("pt-BR");

// pt-BR integer with thousands separators: 4069 -> "4.069".
export function formatarInteiro(valor: number): string {
  return inteiroBr.format(Math.round(valor));
}

// Readable population for the headline: 49_827_100 -> "49,8 milhões",
// 700_000 -> "700 mil". Mirrors interpretacao/simbolos.py _populacao so the
// national figure reads like the per-pole {POPREDE}.
export function formatarPopulacao(pop: number): string {
  if (pop >= 1_000_000) {
    return `${(pop / 1_000_000).toFixed(1).replace(".", ",")} milhões`;
  }
  return `${formatarInteiro(Math.round(pop / 1000))} mil`;
}
