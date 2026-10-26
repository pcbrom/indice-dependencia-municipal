"""FINBRA / DCA 2024 ingestion: municipal revenue, FPM, population.

Reads the consolidated Siconfi CSV from data/raw (compiled per municipality
from the Tesouro Data Lake API, endpoint dca). Seven-digit IBGE code is native
in the DCA API; no six-plus-check-digit conversion is needed for 2024.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from idm_pipeline.regic import ibge7

FINBRA_FILE = "finbra_receitas_fpm_2024_ext2026-07-03.csv"


def _to_num(series: pd.Series) -> pd.Series:
    """Parse Brazilian numeric strings (thousands dot, decimal comma)."""
    return pd.to_numeric(
        series.str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
        errors="coerce",
    )


def load_finbra(raw_dir: Path) -> pd.DataFrame:
    """Return codigo_ibge, populacao, receita_total, fpm."""
    df = pd.read_csv(raw_dir / FINBRA_FILE, sep=";", dtype=str)
    df["codigo_ibge"] = df["codigo_ibge"].map(ibge7)
    for col in ("populacao", "receita_total", "fpm"):
        df[col] = _to_num(df[col])
    return df[["codigo_ibge", "populacao", "receita_total", "fpm"]]
