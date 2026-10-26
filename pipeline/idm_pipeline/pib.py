"""PIB municipal ingestion (IBGE, SIDRA table 5938).

Reads the consolidated CSV from data/raw (codigo_ibge;ano;pib, pib in reais).
"""
from __future__ import annotations

import glob
from pathlib import Path

import pandas as pd

from idm_pipeline.regic import ibge7


def load_pib(raw_dir: Path) -> pd.DataFrame:
    """Return codigo_ibge, pib (reais) for the most recent available year."""
    matches = sorted(glob.glob(str(raw_dir / "pib_municipal_*.csv")))
    if not matches:
        raise FileNotFoundError("pib_municipal_*.csv not found in raw dir")
    df = pd.read_csv(matches[-1], sep=";", dtype=str)
    df["codigo_ibge"] = df["codigo_ibge"].map(ibge7)
    df["pib"] = pd.to_numeric(df["pib"], errors="coerce")
    return df[["codigo_ibge", "pib"]]
