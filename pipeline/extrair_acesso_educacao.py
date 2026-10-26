"""Extrai o acesso efetivo ao ensino superior por municipio a partir dos
microdados do Censo da Educacao Superior (INEP), distinguindo curso de
graduacao PRESENCIAL de polo de educacao a distancia (EAD).

Camada de contexto do painel IDM ("acesso efetivo"), nao entra no indice.
A variavel TP_MODALIDADE_ENSINO do modulo de cursos separa a modalidade
(1 = presencial, 2 = a distancia) e CO_MUNICIPIO ja vem em 7 digitos nativos,
por local de oferta do curso. Ver docs/DECISAO_ACESSO.md e docs/DADOS.md.

A contagem presencial reflete a oferta fisica real do municipio; a contagem
EAD concentra-se nos municipios de polo, o que e a distincao desejada e nao um
defeito. O arquivo de cursos e grande (>450 MB descompactado), portanto a
leitura e feita em streaming, linha a linha, direto do ZIP, sem materializar o
CSV inteiro em memoria nem em disco.

Fonte: INEP, microdados do Censo da Educacao Superior 2024, divulgados em
30/12/2025. Download em https://download.inep.gov.br/microdados/ (o servidor
apresenta cadeia de certificado incompleta; o download usa o par User-Agent de
navegador mais verificacao de certificado relaxada, admissivel para dado aberto
oficial de governo). O nome do ZIP em data/raw carrega a data de extracao;
a base bruta fica fora do controle de versao (ver docs/DADOS.md), so o script e o
artefato agregado sao versionados.

Uso:
    pipeline/.venv/bin/python pipeline/extrair_acesso_educacao.py \
        --zip data/raw/censup_2024_ext2026-07-08.zip \
        --ano 2024 \
        --out app/public/data/acesso_educacao.json

Aceita tambem --csv apontando para o MICRODADOS_CADASTRO_CURSOS_<ano>.CSV ja
extraido, quando o ZIP nao estiver disponivel.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Iterator

from idm_pipeline.regic import ibge7

# CENSUP cursos module: fixed column positions in the semicolon-delimited CSV.
COL_MUNICIPIO = "CO_MUNICIPIO"
COL_MODALIDADE = "TP_MODALIDADE_ENSINO"
MODALIDADE_PRESENCIAL = "1"
MODALIDADE_EAD = "2"
ENCODING = "latin-1"
CSV_SUFFIX = "MICRODADOS_CADASTRO_CURSOS_{ano}.CSV"


def _open_stream(
    zip_path: Path | None, csv_path: Path | None, ano: int
) -> tuple[Iterator[str], object]:
    """Return (line iterator, closeable handle) for the cursos CSV, reading it
    from the ZIP without extracting, or from a standalone CSV path."""
    if csv_path is not None:
        handle = csv_path.open("r", encoding=ENCODING, newline="")
        return handle, handle
    if zip_path is None:
        raise ValueError("provide --zip or --csv")
    zf = zipfile.ZipFile(zip_path)
    target = CSV_SUFFIX.format(ano=ano)
    names = [n for n in zf.namelist() if n.endswith(target)]
    if not names:
        zf.close()
        raise FileNotFoundError(f"{target} not found inside {zip_path}")
    raw = zf.open(names[0])
    text = io.TextIOWrapper(raw, encoding=ENCODING, newline="")
    return text, zf


def _col_index(header: str, name: str) -> int:
    cols = header.rstrip("\r\n").split(";")
    return cols.index(name)


def agregar(lines: Iterator[str]) -> dict[str, dict[str, int]]:
    """Stream the cursos CSV and count, per seven-digit IBGE code, the number of
    face-to-face and distance-learning course records. One pass, O(rows)."""
    header = next(lines)
    i_muni = _col_index(header, COL_MUNICIPIO)
    i_mod = _col_index(header, COL_MODALIDADE)
    contagem: dict[str, dict[str, int]] = defaultdict(
        lambda: {"presencial": 0, "ead": 0})
    for line in lines:
        parts = line.rstrip("\r\n").split(";")
        cod = parts[i_muni].strip()
        if not cod or cod.upper() in ("", "NULL", "NA"):
            continue  # course without a municipality of offering
        modo = parts[i_mod].strip()
        code = ibge7(cod)
        if modo == MODALIDADE_PRESENCIAL:
            contagem[code]["presencial"] += 1
        elif modo == MODALIDADE_EAD:
            contagem[code]["ead"] += 1
    return contagem


def montar_json(contagem: dict[str, dict[str, int]], ano: int) -> dict:
    """Build the compact output: one entry per municipality that offers at least
    one course (any modality), flagging face-to-face presence and its count."""
    municipios = []
    for code in sorted(contagem):
        n_pres = contagem[code]["presencial"]
        municipios.append({
            "codigo_ibge": code,
            "ies_presencial": n_pres > 0,
            "n_cursos_presenciais": n_pres,
        })
    return {
        "fonte": "INEP Censo da Educacao Superior",
        "data_base": ano,
        "n": len(municipios),
        "municipios": municipios,
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Marca presenca de curso de graduacao presencial por municipio (INEP).")
    ap.add_argument("--zip", type=Path, default=None,
                    help="ZIP dos microdados do Censo da Educacao Superior")
    ap.add_argument("--csv", type=Path, default=None,
                    help="CSV de cursos ja extraido (alternativa ao ZIP)")
    ap.add_argument("--ano", type=int, default=2024, help="ano-base do censo")
    ap.add_argument("--out", type=Path,
                    default=Path("app/public/data/acesso_educacao.json"))
    args = ap.parse_args()

    lines, handle = _open_stream(args.zip, args.csv, args.ano)
    try:
        contagem = agregar(lines)
    finally:
        handle.close()

    saida = montar_json(contagem, args.ano)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(saida, ensure_ascii=False, separators=(",", ":")))

    com_pres = sum(1 for m in saida["municipios"] if m["ies_presencial"])
    total_cursos = sum(m["n_cursos_presenciais"] for m in saida["municipios"])
    print(f"municipios com curso (qualquer modalidade)={saida['n']} "
          f"com_curso_presencial={com_pres} total_cursos_presenciais={total_cursos} "
          f"-> {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
