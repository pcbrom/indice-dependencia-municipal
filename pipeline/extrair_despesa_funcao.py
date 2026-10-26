"""Extrai a despesa por funcao municipal (DCA Anexo I-E, Siconfi) para medir o
custo da maquina publica: Legislativa (funcao 01) e Administracao (funcao 04),
com a despesa total como denominador. Agrega nacional, por regiao e por UF.

Fonte: API de Dados Abertos do Tesouro (Data Lake), endpoint tt/dca, uma chamada
por ente (a API nao expoe consulta multi-ente). Coluna Despesas Empenhadas como
o padrao de compromisso. Mesmo metodo das receitas em idm_pipeline/finbra.py.

O agregado mede o que a maquina custa, nao o que se economizaria em uma reforma:
a funcao Administracao inclui atividades permanentes (administracao financeira,
planejamento, arrecadacao, recursos humanos) que nao escalam com o numero de
municipios. Ver docs/DADOS.md e docs/DECISAO_CENARIOS.md.

Uso (universo do painel, ~5,5k entes, ~3 min a 14 conexoes):
    pipeline/.venv/bin/python pipeline/extrair_despesa_funcao.py \
        --exercicio 2024 \
        --out-csv data/raw/finbra_despesa_funcao_2024_ext2026-07-06.csv \
        --out-agg data/raw/agregado_maquina_2024_ext2026-07-06.json

O nome do arquivo carrega a data de extracao (convencao de data/raw); esta base
fica fora do controle de versao (ver docs/DADOS.md), so o script e a documentacao
sao versionados.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca"
ANEXO = "DCA-Anexo I-E"
COLUNA = "Despesas Empenhadas"
CONTA_LEGIS = "01 - legislativa"
CONTA_ADMIN_PREFIXO = "04 - admin"  # accents/spelling vary; matched by prefix
CONTA_TOTAL_PREFIXO = "despesas exceto intra"

# Five official IBGE macro-regions, by state abbreviation.
REGIAO = {
    "RO": "Norte", "AC": "Norte", "AM": "Norte", "RR": "Norte", "PA": "Norte",
    "AP": "Norte", "TO": "Norte",
    "MA": "Nordeste", "PI": "Nordeste", "CE": "Nordeste", "RN": "Nordeste",
    "PB": "Nordeste", "PE": "Nordeste", "AL": "Nordeste", "SE": "Nordeste",
    "BA": "Nordeste",
    "MG": "Sudeste", "ES": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
    "PR": "Sul", "SC": "Sul", "RS": "Sul",
    "MS": "Centro-Oeste", "MT": "Centro-Oeste", "GO": "Centro-Oeste", "DF": "Centro-Oeste",
}


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def fetch(code: str, exercicio: int, session: requests.Session, retries: int = 3) -> dict:
    """Fetch one ente's expense-by-function and reduce to legislativa,
    administracao and the total (Despesas Empenhadas). Retries on transient
    failures and backs off on HTTP 429."""
    params = {"an_exercicio": exercicio, "no_anexo": ANEXO, "id_ente": code}
    for attempt in range(retries):
        try:
            r = session.get(URL, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(1.5 * (attempt + 1))
                continue
            r.raise_for_status()
            items = r.json().get("items", [])
            if not items:
                return {"codigo_ibge": code, "sem_dado": True}
            legis = admin = total = 0.0
            for it in items:
                if _norm(it.get("coluna")) != _norm(COLUNA):
                    continue
                conta = _norm(it.get("conta"))
                val = it.get("valor") or 0.0
                if conta == CONTA_LEGIS:
                    legis = val
                elif conta.startswith(CONTA_ADMIN_PREFIXO):
                    admin = val
                elif conta.startswith(CONTA_TOTAL_PREFIXO):
                    total = val
            return {"codigo_ibge": code, "legislativa": legis,
                    "administracao": admin, "despesa_total": total}
        except (requests.RequestException, ValueError):
            time.sleep(0.8 * (attempt + 1))
    return {"codigo_ibge": code, "erro": True}


def agrega(rows: list[dict]) -> dict:
    legis = sum(r["legislativa"] for r in rows)
    admin = sum(r["administracao"] for r in rows)
    total = sum(r["despesa_total"] for r in rows)
    maquina = legis + admin
    return {"n": len(rows), "legislativa": legis, "administracao": admin,
            "maquina": maquina, "despesa_total": total,
            "maquina_pct": (maquina / total) if total else None}


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Extrai a despesa por funcao municipal (custo da maquina).")
    ap.add_argument("--municipios", type=Path,
                    default=Path("app/public/data/municipios.json"),
                    help="fonte do universo de entes (codigo_ibge e uf)")
    ap.add_argument("--exercicio", type=int, default=2024)
    ap.add_argument("--out-csv", type=Path, default=Path("data/raw/finbra_despesa_funcao.csv"))
    ap.add_argument("--out-agg", type=Path, default=Path("data/raw/agregado_maquina.json"))
    ap.add_argument("--concurrency", type=int, default=14)
    ap.add_argument("--limit", type=int, default=0, help="0 = todos; N = amostra dos N primeiros")
    args = ap.parse_args()

    munis = json.loads(args.municipios.read_text())
    uf_de = {m["codigo_ibge"]: m["uf"] for m in munis}
    nome_de = {m["codigo_ibge"]: m["nome"] for m in munis}
    codes = [m["codigo_ibge"] for m in munis]
    if args.limit:
        codes = codes[: args.limit]

    t0 = time.time()
    session = requests.Session()
    resultados: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futs = {pool.submit(fetch, c, args.exercicio, session): c for c in codes}
        for i, fut in enumerate(as_completed(futs), 1):
            rec = fut.result()
            resultados[rec["codigo_ibge"]] = rec
            if i % 500 == 0:
                print(f"  {i}/{len(codes)} ({time.time()-t0:.0f}s)", file=sys.stderr)

    com_dado = [r for r in resultados.values() if "legislativa" in r]
    sem_dado = sum(1 for r in resultados.values() if r.get("sem_dado"))
    erro = sum(1 for r in resultados.values() if r.get("erro"))
    print(f"total={len(codes)} com_dado={len(com_dado)} sem_dado={sem_dado} "
          f"erro={erro} tempo={time.time()-t0:.0f}s", file=sys.stderr)

    with args.out_csv.open("w", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["codigo_ibge", "nome", "uf", "legislativa", "administracao",
                    "maquina", "despesa_total"])
        for c in codes:
            r = resultados.get(c, {})
            if "legislativa" not in r:
                continue
            maquina = r["legislativa"] + r["administracao"]
            w.writerow([c, nome_de.get(c, ""), uf_de.get(c, ""),
                        f"{r['legislativa']:.2f}", f"{r['administracao']:.2f}",
                        f"{maquina:.2f}", f"{r['despesa_total']:.2f}"])

    por_uf: dict[str, list] = {}
    por_reg: dict[str, list] = {}
    for r in com_dado:
        uf = uf_de.get(r["codigo_ibge"], "??")
        por_uf.setdefault(uf, []).append(r)
        por_reg.setdefault(REGIAO.get(uf, "??"), []).append(r)

    agg = {
        "fonte": (f"Siconfi DCA Anexo I-E (Tesouro), exercicio {args.exercicio}, "
                  "Despesas Empenhadas"),
        "cobertura": {"universo": len(codes), "com_dado": len(com_dado),
                      "sem_dado": sem_dado, "erro": erro},
        "nacional": agrega(com_dado),
        "por_regiao": {k: agrega(v) for k, v in sorted(por_reg.items())},
        "por_uf": {k: agrega(v) for k, v in sorted(por_uf.items())},
    }
    args.out_agg.write_text(json.dumps(agg, ensure_ascii=False, indent=2))
    print(f"escrito {args.out_csv} e {args.out_agg}", file=sys.stderr)


if __name__ == "__main__":
    main()
