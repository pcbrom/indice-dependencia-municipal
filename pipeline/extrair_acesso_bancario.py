"""Extrai indicadores de acesso bancario efetivo por municipio, a partir de dados
abertos do Banco Central (BACEN), para a camada de contexto "acesso efetivo" do
painel IDM. NAO alimenta o indice IDM nem altera seus eixos.

Tres fontes, todas com chave conversivel para o codigo IBGE de sete digitos:

  (a) Agencias de instituicoes supervisionadas (servico Olinda Informes_Agencias):
      presenca e contagem de AGENCIA por municipio. A agencia oferta credito e
      servico pleno, distinta do correspondente de escopo limitado.
  (b) Correspondentes no pais (servico Olinda Informes_Correspondentes):
      presenca de ponto de correspondente por municipio.
  (c) ESTBAN, Estatistica Bancaria Mensal por Municipio (documento COSIF 4500):
      saldo de operacoes de credito por municipio, dividido pela populacao
      estimada para obter credito por habitante. A ESTBAN cobre bancos comerciais
      e multiplos com carteira comercial, nao a totalidade do sistema financeiro;
      o saldo de credito e, portanto, uma medida parcial, declarada como tal.

Chave de juncao: codigo IBGE de sete digitos. As bases do BACEN trazem o codigo
IBGE de sete digitos de forma nativa (agencias e correspondentes) ou de seis
digitos sem digito verificador na ESTBAN, caso em que a funcao ibge7 completa
para sete. O denominador populacional e populacao_estimada de 2024, ja presente
em app/public/data/municipios.json, alinhado ao ano-base fiscal do painel.

Uso (baixa das APIs se os arquivos brutos nao existirem em data/raw):
    pipeline/.venv/bin/python pipeline/extrair_acesso_bancario.py \
        --agencias data/raw/bacen_agencias_ext2026-07-08.json \
        --correspondentes data/raw/bacen_correspondentes_ext2026-07-08.json \
        --estban data/raw/estban_municipio_202512_ext2026-07-08.zip \
        --municipios app/public/data/municipios.json \
        --out app/public/data/acesso_bancario.json

Os arquivos brutos carregam a data de extracao no nome (convencao de data/raw) e
ficam fora do controle de versao; apenas este script e a documentacao sao
versionados. Sem execucao automatica ao importar.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import zipfile
from pathlib import Path

import requests

# Olinda OData endpoints (BACEN open data). JSON, monthly position.
URL_AGENCIAS = (
    "https://olinda.bcb.gov.br/olinda/servico/Informes_Agencias/versao/v1/"
    "odata/Agencias?$format=json&$select=MunicipioIbge,UF,Posicao"
)
URL_CORRESPONDENTES = (
    "https://olinda.bcb.gov.br/olinda/servico/Informes_Correspondentes/versao/v1/"
    "odata/Correspondentes?$format=json&$select=MunicipioIBGE,UF,Posicao"
)

# ESTBAN municipal file: the credit balance is verbete 160, the aggregate
# "OPERACOES DE CREDITO". Its sub-items (161 financiamentos, 171 outras, etc.)
# are already contained in 160; summing them too would double count, so match
# only the 160 aggregate column. The file also carries a SISBACEN municipality
# code (CODMUN) and the real seven-digit IBGE code (CODMUN_IBGE); the IBGE one is
# the join key, so it is preferred over the plain CODMUN.
ESTBAN_CREDITO_PATTERN = re.compile(r"160_operacoes_de_credito", re.I)
ESTBAN_IBGE_HINTS = ("codmun_ibge", "municipio_ibge", "cod_ibge", "ibge")
ESTBAN_MUNI_HINTS = ("codmun", "cod_mun")


def ibge7(value: object) -> str:
    """Normalize any municipality code to a seven-digit zero-padded string.

    Mirrors idm_pipeline.regic.ibge7 so this script stays standalone. A six-digit
    DATASUS/ESTBAN code (IBGE without the check digit) is NOT the same as the
    seven-digit code; ESTBAN handling below reconstructs the check digit by
    matching against the six-digit prefix of the official universe.
    """
    return str(value).strip().split(".")[0].zfill(7)


def _num_br(text: str) -> float:
    """Parse a Brazilian numeric string (thousands dot, decimal comma)."""
    text = (text or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _get_json(url: str, session: requests.Session, timeout: int = 180) -> list[dict]:
    """Fetch an Olinda OData resource and return its value list."""
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    return r.json().get("value", [])


def load_agencias(session: requests.Session, cache: Path | None) -> dict[str, int]:
    """Return {codigo_ibge7: n_agencias}. Reads the cached raw JSON if present,
    otherwise downloads from the Olinda service."""
    if cache and cache.exists():
        rows = json.loads(cache.read_text())["value"]
    else:
        rows = _get_json(URL_AGENCIAS, session)
    counts: dict[str, int] = {}
    for r in rows:
        code = r.get("MunicipioIbge")
        if not code:
            continue
        counts[ibge7(code)] = counts.get(ibge7(code), 0) + 1
    return counts


def load_correspondentes(session: requests.Session, cache: Path | None) -> set[str]:
    """Return the set of codigo_ibge7 with at least one correspondente. Presence
    is deduplicated by municipality; the raw base repeats a municipality once per
    bank-correspondent-service line."""
    if cache and cache.exists():
        rows = json.loads(cache.read_text())["value"]
    else:
        rows = _get_json(URL_CORRESPONDENTES, session)
    return {ibge7(r["MunicipioIBGE"]) for r in rows if r.get("MunicipioIBGE")}


def _open_estban_csv(path: Path) -> io.TextIOWrapper:
    """Open the ESTBAN municipal CSV, transparently unzipping if needed.
    ESTBAN files are latin-1 encoded and semicolon separated."""
    if path.suffix.lower() == ".zip":
        zf = zipfile.ZipFile(path)
        name = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
        return io.TextIOWrapper(zf.open(name), encoding="latin-1", newline="")
    return path.open(encoding="latin-1", newline="")


def load_estban_credito(path: Path, universe6: dict[str, str]) -> dict[str, float]:
    """Return {codigo_ibge7: credit_balance} from the ESTBAN municipal file.

    The header row is detected by the presence of a municipality-code column; any
    leading metadata lines (for example a "#DATA_BASE" comment) are skipped. The
    credit balance is the sum of every column whose name matches the credit-
    operations verbete pattern. The six-digit ESTBAN municipality code is mapped
    to the seven-digit universe by its six-digit prefix (universe6).
    """
    valid7 = set(universe6.values())
    with _open_estban_csv(path) as fh:
        # Find the header line: the first line that names a municipality column.
        reader = csv.reader(fh, delimiter=";")
        header = None
        for row in reader:
            joined = ";".join(row).lower()
            if any(h in joined for h in ESTBAN_MUNI_HINTS + ESTBAN_IBGE_HINTS):
                header = [c.strip() for c in row]
                break
        if header is None:
            raise ValueError("ESTBAN header row with a municipality code not found")
        idx = {name: i for i, name in enumerate(header)}
        # Prefer the seven-digit IBGE column; fall back to the SISBACEN CODMUN,
        # which needs the six-digit-prefix mapping to reach the IBGE universe.
        muni_col = next(
            (i for name, i in idx.items() if any(h in name.lower() for h in ESTBAN_IBGE_HINTS)),
            None,
        )
        muni_is_ibge = muni_col is not None
        if muni_col is None:
            muni_col = next(
                i for name, i in idx.items()
                if any(h in name.lower() for h in ESTBAN_MUNI_HINTS)
            )
        credit_cols = [
            i for name, i in idx.items() if ESTBAN_CREDITO_PATTERN.search(name)
        ]
        if not credit_cols:
            raise ValueError("ESTBAN credit-operations column not found")

        credito: dict[str, float] = {}
        for row in reader:
            if len(row) <= muni_col:
                continue
            raw = re.sub(r"\D", "", row[muni_col])
            if not raw:
                continue
            if muni_is_ibge and len(raw) == 7:
                code7 = raw if raw in valid7 else None
            else:
                code6 = raw.zfill(7)[:6] if len(raw) >= 7 else raw.zfill(6)
                code7 = universe6.get(code6)
            if code7 is None:
                continue
            total = sum(_num_br(row[i]) for i in credit_cols if i < len(row))
            credito[code7] = credito.get(code7, 0.0) + total
    return credito


def build(
    municipios: list[dict],
    agencias: dict[str, int],
    correspondentes: set[str],
    credito: dict[str, float],
    data_base: str,
) -> dict:
    """Assemble the compact acesso_bancario payload over the panel universe."""
    registros = []
    for m in municipios:
        code = m["codigo_ibge"]
        n_ag = agencias.get(code, 0)
        pop = m.get("populacao_estimada")
        cred = credito.get(code)
        credito_pc = (cred / pop) if (cred is not None and pop) else None
        registros.append({
            "codigo_ibge": code,
            "tem_agencia": n_ag > 0,
            "n_agencias": n_ag,
            "tem_correspondente": code in correspondentes,
            "credito_pc": round(credito_pc, 2) if credito_pc is not None else None,
        })
    return {
        "fonte": "BACEN (agencias, correspondentes, ESTBAN)",
        "data_base": data_base,
        "n": len(registros),
        "municipios": registros,
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Extrai acesso bancario efetivo por municipio (BACEN).")
    ap.add_argument("--municipios", type=Path,
                    default=Path("app/public/data/municipios.json"),
                    help="universo do painel e populacao_estimada (denominador)")
    ap.add_argument("--agencias", type=Path, default=None,
                    help="JSON bruto de agencias (Olinda); baixa se ausente")
    ap.add_argument("--correspondentes", type=Path, default=None,
                    help="JSON bruto de correspondentes (Olinda); baixa se ausente")
    ap.add_argument("--estban", type=Path, default=None,
                    help="ZIP/CSV da ESTBAN municipal; credito_pc nulo se ausente")
    ap.add_argument("--data-base", default="2026-07",
                    help="posicao AAAA-MM das bases de pontos (agencias e corresp.)")
    ap.add_argument("--out", type=Path,
                    default=Path("app/public/data/acesso_bancario.json"))
    args = ap.parse_args()

    municipios = json.loads(args.municipios.read_text())
    # Six-digit prefix -> seven-digit code, to map the ESTBAN six-digit key.
    universe6 = {m["codigo_ibge"][:6]: m["codigo_ibge"] for m in municipios}

    session = requests.Session()
    agencias = load_agencias(session, args.agencias)
    correspondentes = load_correspondentes(session, args.correspondentes)

    credito: dict[str, float] = {}
    if args.estban and args.estban.exists():
        credito = load_estban_credito(args.estban, universe6)
    else:
        print("ESTBAN ausente: credito_pc sera nulo.", file=sys.stderr)

    payload = build(municipios, agencias, correspondentes, credito, args.data_base)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

    n = payload["n"]
    com_ag = sum(1 for r in payload["municipios"] if r["tem_agencia"])
    com_co = sum(1 for r in payload["municipios"] if r["tem_correspondente"])
    com_cr = sum(1 for r in payload["municipios"] if r["credito_pc"] is not None)
    print(f"escrito {args.out}: n={n} com_agencia={com_ag} "
          f"com_correspondente={com_co} com_credito={com_cr}", file=sys.stderr)


if __name__ == "__main__":
    main()
