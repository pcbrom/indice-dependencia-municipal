"""TypedDict schemas mirroring docs/CONTRATO_DADO.md.

These describe the JSON records the pipeline publishes to app/public/data/ and
that the React client programs against. They are documentation with runtime
teeth: the field lists drive the column selection and ordering when the flow
scripts serialize their frames. The contract is the boundary; divergence on
either side is a defect.

Key convention: codigo_ibge is always a seven-digit string with leading zeros
preserved, never numeric. Nulls are JSON null, never sentinel values.
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict

# Categorical domains fixed by the contract.
Tipologia = Literal["polo", "semi-polo", "orbitante"]
TipoServico = Literal["saude", "ensino_superior", "bancario"]


class MunicipioRecord(TypedDict):
    """One object per municipality in M, for municipios.json.

    Fields, types and units per the municipios.json table of CONTRATO_DADO.md.
    Optional[...] marks the columns the contract allows to be null: polo_ibge and
    distancia_polo_km (null or 0 for a pole).
    """

    codigo_ibge: str  # string(7), IBGE key
    nome: str
    uf: str  # string(2)
    populacao: int  # int32, habitantes, base-year estimate
    pib: float  # reais, base-year municipal GDP
    porte_faixa: str  # population band (categorical)
    tipologia: Tipologia  # polo, semi-polo or orbitante
    polo_ibge: Optional[str]  # string(7); null if the municipality is itself a pole
    # Name and state of the destination, carried from the REGIC frame. A pole
    # may sit outside the index universe for lack of valid fiscal data, so the
    # client cannot resolve every polo_ibge against municipios.json.
    polo_nome: Optional[str]
    polo_uf: Optional[str]  # string(2)
    distancia_polo_km: Optional[float]  # km; null or 0 for a pole
    fpm: float  # reais, FPM received in the base year
    receita_total: float  # reais, total revenue
    razao_fpm_receita: float  # f^(1), in [0, 1]
    razao_receita_pib: float  # f^(2), may exceed 1
    tem_hospital_mac: bool  # CNES medium/high-complexity hospital
    tem_ies: bool  # INEP higher-education institution
    eixo_orbitacao: float  # O_i, 0 to 1
    eixo_fiscal: float  # F_i, 0 to 1
    eixo_servicos: float  # S_i, 0 to 1
    idm: float  # composite index, 0 to 1
    idm_percentil: float  # percentile rank of the IDM, 0 to 1
    # Context layer (outside the index): official IBGE denominator and the
    # external development outcome. Never feed the three axes. idhm is null for
    # municipalities installed after the 2010 Census; nothing is imputed.
    populacao_estimada: Optional[int]  # IBGE estimated population, context year
    idhm: Optional[float]  # IDHM (Atlas Brasil, 2010 Census); 0 to 1, or null


# Column order for serialization of municipios.json, matching the contract table.
MUNICIPIO_FIELDS: tuple[str, ...] = (
    "codigo_ibge",
    "nome",
    "uf",
    "populacao",
    "pib",
    "porte_faixa",
    "tipologia",
    "polo_ibge",
    "polo_nome",
    "polo_uf",
    "distancia_polo_km",
    "fpm",
    "receita_total",
    "razao_fpm_receita",
    "razao_receita_pib",
    "tem_hospital_mac",
    "tem_ies",
    "eixo_orbitacao",
    "eixo_fiscal",
    "eixo_servicos",
    "idm",
    "idm_percentil",
    "populacao_estimada",
    "idhm",
)


class LigacaoRecord(TypedDict):
    """One object per orbitant-to-pole REGIC link, for ligacoes.json.

    Fields per the ligacoes.json table of CONTRATO_DADO.md, for the map flow layer.
    """

    origem_ibge: str  # string(7), origin municipality
    destino_ibge: str  # string(7), destination pole
    tipo_servico: TipoServico  # saude, ensino_superior, bancario
    uf_origem: str  # string(2), for aggregation by federative unit


LIGACAO_FIELDS: tuple[str, ...] = (
    "origem_ibge",
    "destino_ibge",
    "tipo_servico",
    "uf_origem",
)


class PesosManifesto(TypedDict):
    """Declared axis weights, mirrored from idm_core.DEFAULT_WEIGHTS."""

    orbitacao: float
    fiscal: float
    servicos: float


class CoberturaManifesto(TypedDict):
    """Coverage audit; percentual is the plan-B floor (minimum 0.90).

    abaixo_do_piso is true when percentual < 0.90; it makes the floor breach
    explicit in the published manifest instead of leaving it implicit.
    """

    municipios_universo: int
    municipios_validos: int
    percentual: float
    abaixo_do_piso: bool


class FonteManifesto(TypedDict):
    """One provenance entry per source, for the source-seal component."""

    nome: str
    orgao: str
    ano: int
    data_extracao: str  # ISO 8601
    url_catalogo: str  # catalog entry of the source in the open data portal
    uso: str


class Manifesto(TypedDict):
    """manifesto.json schema, per CONTRATO_DADO.md.

    An artifact without a corresponding manifest entry is not published.
    """

    ano_base: int
    idm_versao: str
    pesos: PesosManifesto
    cobertura: CoberturaManifesto
    fontes: list[FonteManifesto]
