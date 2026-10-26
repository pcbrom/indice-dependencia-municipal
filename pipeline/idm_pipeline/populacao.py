"""Estimated population ingestion (IBGE, SIDRA table 6579, variable 9324).

Reads the consolidated CSV from data/raw (codigo_ibge;ano;populacao_estimada).
Context layer only: the IBGE official estimate is a canonical denominator and
does NOT feed the three IDM axes. The index keeps the FINBRA base-year
population for porte and for the log-population validation, so adding this
column never changes the index.
"""
from __future__ import annotations

import glob
from pathlib import Path

import pandas as pd

from idm_pipeline.regic import ibge7


def load_populacao_estimada(raw_dir: Path) -> pd.DataFrame:
    """Return codigo_ibge, populacao_estimada for the most recent CSV."""
    matches = sorted(glob.glob(str(raw_dir / "populacao_estimada_*.csv")))
    if not matches:
        raise FileNotFoundError("populacao_estimada_*.csv not found in raw dir")
    df = pd.read_csv(matches[-1], sep=";", dtype=str)
    df["codigo_ibge"] = df["codigo_ibge"].map(ibge7)
    df["populacao_estimada"] = pd.to_numeric(
        df["populacao_estimada"], errors="coerce"
    ).astype("Int64")
    return df[["codigo_ibge", "populacao_estimada"]]
