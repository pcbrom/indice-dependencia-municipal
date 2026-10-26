"""Service presence ingestion: CNES hospital (medium/high complexity) and INEP IES.

Reads the two consolidated CSVs from data/raw. Each lists the municipalities
that HAVE the service; absence from the file means the service is absent, so the
caller fills missing municipalities with False (never imputed as present).
"""
from __future__ import annotations

import glob
from pathlib import Path

import pandas as pd

from idm_pipeline.regic import ibge7

_TRUE = {"true", "1", "sim", "t", "verdadeiro", "yes"}


def _read_flag(pattern: str, raw_dir: Path, col: str) -> pd.DataFrame:
    matches = sorted(glob.glob(str(raw_dir / pattern)))
    if not matches:
        return pd.DataFrame(
            {"codigo_ibge": pd.Series(dtype="string"), col: pd.Series(dtype="bool")}
        )
    df = pd.read_csv(matches[-1], sep=";", dtype=str)
    df["codigo_ibge"] = df["codigo_ibge"].map(ibge7)
    df[col] = df[col].astype(str).str.strip().str.lower().isin(_TRUE)
    return df.groupby("codigo_ibge", as_index=False)[col].max()


def load_servicos(raw_dir: Path) -> pd.DataFrame:
    """Return codigo_ibge, tem_hospital_mac, tem_ies for municipalities present."""
    cnes = _read_flag("cnes_hospital_mac_*.csv", raw_dir, "tem_hospital_mac")
    inep = _read_flag("inep_ies_*.csv", raw_dir, "tem_ies")
    return cnes.merge(inep, on="codigo_ibge", how="outer")
