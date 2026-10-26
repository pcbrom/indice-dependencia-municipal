"""Use idm_core as a library on the published artifact, with no raw data.

Three uses, all from municipios.json:

  1. conferir   recompute the national IDM with the default weights and report
                the largest difference to the published value;
  2. pesos      recompute with alternative weights and compare the rankings;
  3. recorte    recompute with the percentile normalization restricted to one
                state (UF), a state-level reading of the same method.

Run from the repository root, for example:

    uv run --project pipeline python pipeline/exemplos/recalcular_idm.py
    uv run --project pipeline python pipeline/exemplos/recalcular_idm.py --pesos 0.5,0.25,0.25
    uv run --project pipeline python pipeline/exemplos/recalcular_idm.py --uf PE --saida idm_pe.csv
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from idm_pipeline import idm_core

TOLERANCIA = 1e-9  # largest accepted difference to the published IDM in "conferir"

COLUNAS = ["codigo_ibge", "nome", "uf", "distancia_polo_km", "fpm", "receita_total", "pib",
           "tem_hospital_mac", "tem_ies", "idm", "idm_percentil"]


def carregar(caminho: Path) -> pd.DataFrame:
    bruto = json.loads(caminho.read_text(encoding="utf-8"))
    registros = bruto if isinstance(bruto, list) else bruto["municipios"]
    return pd.DataFrame(registros)[COLUNAS].rename(
        columns={"idm": "idm_publicado", "idm_percentil": "percentil_publicado"}
    )


def conferir(df: pd.DataFrame) -> pd.DataFrame:
    out = idm_core.compute_idm_frame(df)
    dif = (out["idm"] - out["idm_publicado"]).abs().max()
    print(f"Conferência: {len(out)} municípios, maior diferença absoluta "
          f"para o IDM publicado = {dif:.2e}")
    if not dif <= TOLERANCIA:
        raise SystemExit(f"Divergência acima da tolerância {TOLERANCIA:.0e}: o artefato "
                         "não reproduz a fórmula de idm_core.")
    return out


def comparar_pesos(df: pd.DataFrame, pesos: tuple[float, float, float]) -> pd.DataFrame:
    if abs(sum(pesos) - 1.0) > 1e-9:
        raise ValueError(f"os pesos devem somar 1, receberam {sum(pesos)}")
    out = idm_core.compute_idm_frame(df, weights=pesos)
    rho = idm_core.spearman_corr(out["idm"], out["idm_publicado"])
    out["variacao_percentil"] = out["idm_percentil"] - out["percentil_publicado"]
    print(f"Pesos (orbitação, fiscal, serviços) = {pesos}: "
          f"Spearman com o IDM publicado = {rho:.3f}")
    movem = out.reindex(out["variacao_percentil"].abs().sort_values(ascending=False).index).head(10)
    print("Municípios que mais mudam de posição relativa:")
    for _, r in movem.iterrows():
        print(f"  {r['nome']} ({r['uf']}): percentil "
              f"{r['percentil_publicado']:.2f} -> {r['idm_percentil']:.2f}")
    return out


def recorte_uf(df: pd.DataFrame, uf: str) -> pd.DataFrame:
    sub = df[df["uf"] == uf.upper()]
    if sub.empty:
        raise ValueError(f"nenhum município para a UF {uf}")
    out = idm_core.compute_idm_frame(sub)
    rho = idm_core.spearman_corr(out["idm"], out["idm_publicado"])
    print(f"Recorte {uf.upper()}: {len(out)} municípios normalizados dentro do estado; "
          f"Spearman com o IDM nacional = {rho:.3f}")
    print("Mais dependentes no recorte estadual:")
    for _, r in out.sort_values("idm", ascending=False).head(5).iterrows():
        print(f"  {r['nome']}: IDM estadual {r['idm']:.2f}, nacional {r['idm_publicado']:.2f}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Recalcula o IDM a partir do artefato publicado.")
    ap.add_argument("--municipios", type=Path, default=Path("dados/municipios.json"),
                    help="municipios.json publicado (no painel: app/public/data/municipios.json)")
    ap.add_argument("--pesos", default=None,
                    help="pesos alternativos 'orbitacao,fiscal,servicos', somando 1")
    ap.add_argument("--uf", default=None, help="sigla da UF para o recorte estadual")
    ap.add_argument("--saida", type=Path, default=None, help="CSV com o resultado")
    args = ap.parse_args()

    df = carregar(args.municipios)
    if args.uf:
        out = recorte_uf(df, args.uf)
    elif args.pesos:
        out = comparar_pesos(df, tuple(float(x) for x in args.pesos.split(",")))
    else:
        out = conferir(df)
    if args.saida:
        out.to_csv(args.saida, index=False)
        print(f"Resultado gravado em {args.saida}")


if __name__ == "__main__":
    main()
