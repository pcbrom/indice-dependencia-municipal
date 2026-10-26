"""Provenance manifest for the published artifacts.

Weights come from idm_core (single source of truth); coverage is the measured
validos/universo from the Etapa 0 gate; source entries carry the real extraction
date, download URL, catalog URL and use. An artifact without a manifest entry is
not published (CONTRATO_DADO.md). No secrets.
"""
from __future__ import annotations

import json
from pathlib import Path

from idm_pipeline.idm_core import DEFAULT_WEIGHTS

COVERAGE_FLOOR = 0.90
EXTRACAO = "2026-07-03"
# Context layer (v0.2.0) collected later than the core Etapa 0 sources.
EXTRACAO_CONTEXTO = "2026-07-04"
# Effective-access layer (hospital -> UTI, IES -> presencial, banco -> agencia).
EXTRACAO_ACESSO = "2026-07-08"

FONTES = [
    {
        "nome": "REGIC",
        "orgao": "IBGE",
        "ano": 2018,
        "data_extracao": EXTRACAO,
        "url_download": "https://geoftp.ibge.gov.br/organizacao_do_territorio/divisao_regional/regioes_de_influencia_das_cidades/Regioes_de_influencia_das_cidades_2018_Resultados_definitivos/base_tabular/",
        "url_catalogo": "https://dados.gov.br/dataset/regioes-de-influencia-das-cidades-regic-ligacoes-entre-centros-brasil",
        "uso": "hierarquia, tipologia, ligação orbitante para polo, distância",
    },
    {
        "nome": "FINBRA/DCA",
        "orgao": "Tesouro Nacional (Siconfi)",
        "ano": 2024,
        "data_extracao": EXTRACAO,
        "url_download": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca",
        "url_catalogo": "https://dados.gov.br/dataset/dcam",
        "uso": "receita total, FPM, população",
    },
    {
        "nome": "PIB dos Municípios",
        "orgao": "IBGE (SIDRA tabela 5938)",
        "ano": 2023,
        "data_extracao": EXTRACAO,
        "url_download": "https://apisidra.ibge.gov.br/values/t/5938/n6/all/v/37/p/last",
        "url_catalogo": "https://dados.gov.br/dataset/produto-interno-bruto-dos-municipios",
        "uso": "PIB municipal, razão receita sobre PIB",
    },
    {
        "nome": "CNES (estabelecimentos)",
        "orgao": "DATASUS",
        "ano": 2026,
        "data_extracao": EXTRACAO,
        "url_download": "https://cnes.datasus.gov.br/",
        "url_catalogo": "https://dados.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude",
        "uso": "presença de hospital de média e alta complexidade",
    },
    {
        "nome": "CNES (leitos)",
        "orgao": "DATASUS",
        "ano": 2026,
        "data_extracao": EXTRACAO_ACESSO,
        "url_download": "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?cnes/cnv/leiutibr.def",
        "url_catalogo": "https://dados.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude",
        "uso": "leitos de internação e complementares; o leito de UTI reconcilia a "
               "presença de saúde de alta complexidade no eixo de serviços",
    },
    {
        "nome": "Cadastro de IES (e-MEC)",
        "orgao": "INEP/MEC",
        "ano": 2026,
        "data_extracao": EXTRACAO,
        "url_download": "https://emec.mec.gov.br/",
        "url_catalogo": "https://dados.gov.br/dataset/instituicoes-de-ensino-superior",
        "uso": "presença de instituição de ensino superior (cadastro)",
    },
    {
        "nome": "ESTBAN",
        "orgao": "Banco Central do Brasil",
        "ano": 2026,
        "data_extracao": EXTRACAO_ACESSO,
        "url_download": "https://www.bcb.gov.br/content/estatisticas/estatistica_bancaria_estban/municipio/202603_ESTBAN.csv.zip",
        "url_catalogo": "https://dados.gov.br/dados/conjuntos-dados/estatistica-bancaria-por-municipio-estban",
        "uso": "saldo de operações de crédito por município, base do crédito por "
               "habitante na camada de contexto de acesso bancário",
    },
    {
        "nome": "Censo da Educação Superior",
        "orgao": "INEP/MEC",
        "ano": 2024,
        "data_extracao": EXTRACAO_ACESSO,
        "url_download": "https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_2024.zip",
        "url_catalogo": "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior",
        "uso": "modalidade do curso de graduação (presencial x a distância); o curso presencial reconcilia a presença de ensino superior no eixo de serviços",
    },
    {
        "nome": "Informes de agências e correspondentes",
        "orgao": "Banco Central do Brasil",
        "ano": 2026,
        "data_extracao": EXTRACAO_ACESSO,
        "url_download": "https://olinda.bcb.gov.br/olinda/servico/Informes_Agencias/versao/v1/odata/Agencias",
        "url_catalogo": "https://dadosabertos.bcb.gov.br/",
        "uso": "presença de agência bancária, distinta de correspondente, na camada de contexto de acesso",
    },
    {
        "nome": "DCA Anexo I-E (despesa por função)",
        "orgao": "Tesouro Nacional (Siconfi)",
        "ano": 2024,
        "data_extracao": "2026-07-06",
        "url_download": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca",
        "url_catalogo": "https://dados.gov.br/dataset/dcam",
        "uso": "despesa das funções Legislativa e Administração, custo da máquina na análise de agregação",
    },
    {
        "nome": "Malha municipal",
        "orgao": "IBGE",
        "ano": 2022,
        "data_extracao": EXTRACAO,
        "url_download": "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=municipio&qualidade=minima&formato=application/vnd.geo+json",
        "url_catalogo": "https://dados.gov.br/dataset/malha-de-municipios-do-brasil",
        "uso": "base cartográfica do mapa",
    },
    {
        "nome": "População Estimada",
        "orgao": "IBGE (SIDRA tabela 6579)",
        "ano": 2024,
        "data_extracao": EXTRACAO_CONTEXTO,
        "url_download": "https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/2024",
        "url_catalogo": "https://dados.gov.br/dados/conjuntos-dados/estimativas-de-populacao",
        "uso": "camada de contexto: denominador populacional oficial, fora dos eixos do IDM",
    },
    {
        "nome": "IDHM (Atlas Brasil)",
        "orgao": "PNUD, Ipea e FJP (via IpeaData, série ADH_IDHM)",
        "ano": 2010,
        "data_extracao": EXTRACAO_CONTEXTO,
        "url_download": "http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='ADH_IDHM')",
        "url_catalogo": "https://dados.gov.br/dados/conjuntos-dados/atlasbrasil",
        "uso": "camada de contexto e validação descritiva externa; referente de desenvolvimento, nunca eixo do IDM; base do Censo 2010",
    },
]


def generate(
    out_dir: Path,
    *,
    cobertura: float,
    universo: int,
    validos: int,
    ano_fiscal: int = 2024,
    ano_regic: int = 2018,
) -> None:
    """Write manifesto.json with the real weights, coverage and sources."""
    w1, w2, w3 = DEFAULT_WEIGHTS
    manifesto = {
        "ano_base_fiscal": ano_fiscal,
        "ano_base_regic": ano_regic,
        "idm_versao": "0.1.0",
        "pesos": {"orbitacao": round(w1, 4), "fiscal": round(w2, 4), "servicos": round(w3, 4)},
        "cobertura": {
            "municipios_universo": universo,
            "municipios_validos": validos,
            "percentual": round(cobertura, 4),
            "abaixo_do_piso": cobertura < COVERAGE_FLOOR,
        },
        "fontes": FONTES,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "manifesto.json").open("w", encoding="utf-8") as fh:
        json.dump(manifesto, fh, ensure_ascii=False, indent=2)
