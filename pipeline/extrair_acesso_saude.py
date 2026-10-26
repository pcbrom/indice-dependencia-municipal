"""Extrai o acesso efetivo em saude por municipio (camada de contexto do IDM).

Fonte: CNES/DATASUS via TabNet (agregado municipal, sem baixar DBC bruto). Duas
consultas, ambas com Linha=Municipio e Incremento=Quantidade existente, na
competencia mensal mais recente:

  - leiutibr.def  (Leitos complementares): matriz municipio x tipo de leito.
    Leitos de UTI (proxy de alta complexidade) e o total de leitos
    complementares. As colunas cujo nome comeca por "UTI" sao os leitos de UTI
    propriamente ditos; unidade intermediaria, isolamento, cuidados
    intermediarios e suporte ventilatorio ficam de fora da contagem de UTI mas
    entram no total de complementares.
  - leiintbr.def  (Leitos de internacao): total de leitos de internacao
    clinicos, cirurgicos, obstetricos, pediatricos e afins (proxy de media
    complexidade).

Metricas por municipio:
  - uti_leitos            = soma das colunas de UTI (leiutibr)
  - tem_uti               = uti_leitos > 0
  - leitos_totais         = internacao + complementares
  - alta_media_ratio      = complementares / internacao (alta sobre media
                            complexidade); null quando internacao == 0

Chave e conversao 6->7 digitos: o TabNet rotula cada linha com o codigo
municipal de 6 digitos do DATASUS (IBGE sem digito verificador). Os seis
primeiros digitos do codigo IBGE de 7 digitos identificam o municipio de forma
unica (o setimo e digito verificador derivado), entao a conversao e uma
biijecao: mapeia-se o codigo de 6 digitos para o de 7 casando os seis primeiros
digitos da tabela municipal do REGIC (universo de 5570). A funcao ibge7 de
idm_pipeline.regic normaliza os codigos de 7 digitos da tabela de referencia.
O zero-padding de ibge7 sozinho nao recupera o digito verificador; por isso a
conversao usa a tabela, com ibge7 apenas como normalizador do lado de 7 digitos.

Municipio ausente das consultas nao tem leito registrado no CNES e recebe zero,
que e o dado correto e nao um faltante a imputar (ver docs/DECISAO_ACESSO.md).

Uso:
    pipeline/.venv/bin/python pipeline/extrair_acesso_saude.py \
        --raw-dir data/raw \
        --out app/public/data/acesso_saude.json \
        --data-ext 2026-07-08

O nome dos CSV crus carrega a data de extracao (convencao de data/raw); essas
bases ficam fora do controle de versao, so o script e a documentacao entram.

Nao executa nada ao ser importado.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from idm_pipeline.regic import load_regic  # noqa: E402

TABNET_BASE = "http://tabnet.datasus.gov.br"
DEF_UTI = "/cgi/tabcgi.exe?cnes/cnv/leiutibr.def"
DEF_INT = "/cgi/tabcgi.exe?cnes/cnv/leiintbr.def"
TIMEOUT = 90  # seconds per request; TabNet can be slow


def _get(url: str) -> str:
    """HTTP GET returning latin-1 text, with an explicit timeout."""
    req = urllib.request.Request(url, headers={"User-Agent": "idm-pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("latin-1")


def latest_competencia(def_path: str) -> str:
    """Return the most recent Arquivos value (e.g. lubr2605.dbf) from a .def."""
    html = _get(TABNET_BASE + def_path)
    i = html.find('NAME="Arquivos"')
    seg = html[i : html.find("</SELECT>", i)]
    m = re.search(r'VALUE="([^"]+)"', seg)
    if not m:
        raise RuntimeError(f"no competencia found in {def_path}")
    return m.group(1)


def _tabnet_csv(def_path: str, coluna: str, arquivo: str) -> str:
    """POST a TabNet query (Linha=Municipio) and download the generated CSV.

    Returns the CSV text (latin-1). TabNet answers with an HTML result page that
    embeds a link to a freshly built .csv; we follow that link.
    """
    params = [
        ("Linha", "Município"),
        ("Coluna", coluna),
        ("Incremento", "Quantidade_existente"),
        ("Arquivos", arquivo),
        ("pesqmes1", "Digite o texto e ache fácil"),
        ("SMunicípio", "TODAS_AS_CATEGORIAS__"),
        ("formato", "table"),
        ("mostre", "Mostra"),
    ]
    data = urllib.parse.urlencode(params, encoding="latin-1").encode("latin-1")
    req = urllib.request.Request(
        TABNET_BASE + def_path,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "idm-pipeline/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        body = r.read().decode("latin-1")
    m = re.search(r"HREF=(/csv/[^ >]+\.csv)", body, re.I)
    if not m:
        raise RuntimeError(f"no CSV link in TabNet response for {def_path}")
    return _get(TABNET_BASE + m.group(1))


def _num(cell: str) -> int:
    """TabNet numeric cell: '-' or blank means zero."""
    s = cell.strip()
    return 0 if s in ("-", "") else int(s)


def _rows(csv_text: str) -> tuple[list[str], list[list[str]]]:
    """Split a TabNet CSV into (header cells, data rows). Data rows are the ones
    whose first cell is a quoted municipality label starting with a digit."""
    lines = csv_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    header = [c.strip('"') for c in lines[3].split(";")]
    data = [
        ln.split(";")
        for ln in lines[4:]
        if ln[:1] == '"' and ln[1:2].isdigit()
    ]
    return header, data


def parse_uti(csv_text: str) -> dict[str, tuple[int, int]]:
    """Return {code6: (uti_leitos, complementares_total)}.

    uti_leitos sums the columns whose header starts with 'UTI'; the total column
    is the full complementary-bed count.
    """
    header, data = _rows(csv_text)
    uti_cols = [i for i, h in enumerate(header) if h.startswith("UTI")]
    total_col = header.index("Total")
    out: dict[str, tuple[int, int]] = {}
    for cells in data:
        code6 = cells[0].strip('"').split(" ", 1)[0]
        uti = sum(_num(cells[i]) for i in uti_cols)
        out[code6] = (uti, _num(cells[total_col]))
    return out


def parse_internacao(csv_text: str) -> dict[str, int]:
    """Return {code6: internacao_total} (single quantity column)."""
    _, data = _rows(csv_text)
    out: dict[str, int] = {}
    for cells in data:
        code6 = cells[0].strip('"').split(" ", 1)[0]
        out[code6] = _num(cells[1])
    return out


def competencia_iso(arquivo: str) -> str:
    """Map a TabNet filename (lubr2605.dbf / ltbr2605.dbf) to 'AAAA-MM'."""
    m = re.search(r"(\d{2})(\d{2})\.dbf$", arquivo)
    yy, mm = m.group(1), m.group(2)
    return f"20{yy}-{mm}"


def build(raw_dir: Path, data_ext: str) -> tuple[dict, dict]:
    """Fetch, save the raw CSVs, and return (payload, coverage summary)."""
    muni, _ = load_regic(raw_dir)
    by6 = {c[:6]: c for c in muni["codigo_ibge"]}  # 6-digit -> 7-digit bijection

    arq_uti = latest_competencia(DEF_UTI)
    arq_int = latest_competencia(DEF_INT)

    csv_uti = _tabnet_csv(DEF_UTI, "Leitos_complementares", arq_uti)
    csv_int = _tabnet_csv(DEF_INT, "--Não-Ativa--", arq_int)

    (raw_dir / f"cnes_leitos_uti_ext{data_ext}.csv").write_text(csv_uti, encoding="latin-1")
    (raw_dir / f"cnes_leitos_internacao_ext{data_ext}.csv").write_text(csv_int, encoding="latin-1")

    uti = parse_uti(csv_uti)
    internacao = parse_internacao(csv_int)

    municipios = []
    tem_uti_n = 0
    for code6, code7 in sorted(by6.items(), key=lambda kv: kv[1]):
        uti_leitos, complementares = uti.get(code6, (0, 0))
        internacao_total = internacao.get(code6, 0)
        leitos_totais = internacao_total + complementares
        ratio = round(complementares / internacao_total, 4) if internacao_total else None
        tem = uti_leitos > 0
        tem_uti_n += tem
        municipios.append(
            {
                "codigo_ibge": code7,
                "uti_leitos": uti_leitos,
                "tem_uti": tem,
                "leitos_totais": leitos_totais,
                "alta_media_ratio": ratio,
            }
        )

    payload = {
        "fonte": "CNES/DATASUS",
        "data_base": competencia_iso(arq_uti),
        "n": len(municipios),
        "municipios": municipios,
    }
    cobertura = {
        "competencia_uti": competencia_iso(arq_uti),
        "competencia_internacao": competencia_iso(arq_int),
        "universo": len(municipios),
        "com_uti": tem_uti_n,
        "com_leito_complementar": len(uti),
        "com_leito_internacao": len(internacao),
        "uti_leitos_total": sum(v[0] for v in uti.values()),
        "complementares_total": sum(v[1] for v in uti.values()),
        "internacao_total": sum(internacao.values()),
    }
    return payload, cobertura


def main() -> None:
    ap = argparse.ArgumentParser(description="Extrai acesso efetivo em saude (CNES/DATASUS).")
    ap.add_argument("--raw-dir", type=Path, default=Path("data/raw"))
    ap.add_argument("--out", type=Path, default=Path("app/public/data/acesso_saude.json"))
    ap.add_argument("--data-ext", default=date.today().isoformat(),
                    help="extraction date tag for the raw CSVs (AAAA-MM-DD)")
    args = ap.parse_args()

    payload, cobertura = build(args.raw_dir, args.data_ext)
    args.out.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(json.dumps(cobertura, ensure_ascii=False, indent=2), file=sys.stderr)
    print(f"escrito {args.out} ({args.out.stat().st_size} bytes)", file=sys.stderr)


if __name__ == "__main__":
    main()
