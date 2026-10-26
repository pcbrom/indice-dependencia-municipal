"""IDHM ingestion (IpeaData series ADH_IDHM; Atlas Brasil, 2010 Census base).

Reads the consolidated CSV from data/raw (codigo_ibge;ano;idhm). Context and
external validation only: the IDHM is a development outcome, never an IDM axis.
Municipalities installed after the 2010 Census have no IDHM and stay null;
nothing is imputed, consistent with the no-imputation rule of IDM_SPEC.md.
"""
from __future__ import annotations

import glob
from pathlib import Path

import pandas as pd

from idm_pipeline.regic import ibge7


def load_idhm(raw_dir: Path) -> pd.DataFrame:
    """Return codigo_ibge, idhm (0 to 1) for the most recent CSV."""
    matches = sorted(glob.glob(str(raw_dir / "idhm_municipal_*.csv")))
    if not matches:
        raise FileNotFoundError("idhm_municipal_*.csv not found in raw dir")
    df = pd.read_csv(matches[-1], sep=";", dtype={"codigo_ibge": str})
    df["codigo_ibge"] = df["codigo_ibge"].map(ibge7)
    df["idhm"] = pd.to_numeric(df["idhm"], errors="coerce")
    return df[["codigo_ibge", "idhm"]]
