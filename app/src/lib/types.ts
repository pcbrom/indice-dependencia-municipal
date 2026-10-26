// Domain types. Data shapes mirror docs/CONTRATO_DADO.md field for field:
// the pipeline guarantees these fields, types and units; the client programs
// against them. The unique key is always codigo_ibge as a seven-digit string,
// never numeric, so leading zeros survive.

export type Tipologia = "polo" | "semi-polo" | "orbitante";

export type TipoServico = "saude" | "ensino_superior" | "bancario";

// Routes of the core plus methodology. Contexto is out of the premiable core.
export type Rota =
  | "mapa"
  | "municipio"
  | "fiscal"
  | "cenarios"
  | "ranking"
  | "metodologia"
  | "contexto";

// One object per municipality (municipios.json).
export interface Municipio {
  codigo_ibge: string; // string(7), leading zeros preserved
  nome: string;
  uf: string; // string(2)
  populacao: number; // int32, inhabitants
  pib: number; // reais
  porte_faixa: string; // categorical population band
  tipologia: Tipologia;
  polo_ibge: string | null; // null when the municipality is itself a polo
  // Name and state of the destination, carried by the pipeline. A polo may sit
  // outside the index universe for lack of valid fiscal data, so polo_ibge is
  // not always resolvable against the loaded list.
  polo_nome: string | null;
  polo_uf: string | null;
  distancia_polo_km: number | null; // null or 0 for a polo
  fpm: number; // reais
  receita_total: number; // reais
  razao_fpm_receita: number; // f^(1), 0..1
  razao_receita_pib: number; // f^(2), may exceed 1
  tem_hospital_mac: boolean;
  tem_ies: boolean;
  eixo_orbitacao: number; // O_i, 0..1
  eixo_fiscal: number; // F_i, 0..1
  eixo_servicos: number; // S_i, 0..1
  idm: number; // composite, 0..1
  idm_percentil: number; // percentile rank, 0..1
  // Context layer (outside the index). IBGE estimated population as the official
  // denominator; IDHM (Atlas Brasil, 2010 Census) as an external development
  // reference, null for municipalities installed after 2010. Never feed the axes.
  populacao_estimada: number | null;
  idhm: number | null;
}

// One object per orbiting-to-polo link (ligacoes.json).
export interface Ligacao {
  origem_ibge: string;
  destino_ibge: string;
  uf_origem: string;
  // Service dimension of the link. Not yet published by the pipeline (a REGIC
  // link carries multiple service flags); the service filter lands in M3.
  tipo_servico?: TipoServico;
}

// Provenance per source, read from manifesto.json.
export interface FonteRef {
  nome: string;
  orgao: string;
  ano: number;
  data_extracao: string; // ISO 8601
  url_catalogo: string;
  uso: string;
}

export interface Manifesto {
  ano_base_fiscal: number;
  ano_base_regic: number;
  idm_versao: string;
  pesos: { orbitacao: number; fiscal: number; servicos: number };
  cobertura: {
    municipios_universo: number;
    municipios_validos: number;
    percentual: number;
    abaixo_do_piso?: boolean;
  };
  fontes: FonteRef[];
}

// National headline aggregates, read from destaques.json (see
// docs/CONTRATO_DADO.md). Additive artifact: a missing file only hides the
// headline band, never the map.
export interface Destaques {
  total_municipios: number;
  total_populacao: number;
  por_tipologia: Record<Tipologia, { n: number; populacao: number }>;
  dependentes: {
    papel: Tipologia;
    n_municipios: number;
    populacao: number;
    share_municipios: number;
    share_populacao: number;
  };
  cobertura: number;
  universo: number;
}

// Client-side filter state shared by the map and fiscal screens. All optional
// slices are applied in memory over the pre-aggregated JSON, no server call.
export interface FiltrosMapa {
  uf?: string;
  servico?: TipoServico;
  faixaIdm?: [number, number];
  porte?: string;
  tipologiaAtiva: Tipologia[];
}

// Escala consumed by the IDM legend and ramps.
export interface EscalaIDM {
  min: number;
  max: number;
  passos: string[]; // ordered light-to-dark ramp of hex or var() references
}
