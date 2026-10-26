"""REGIC 2018 ingestion: typology, pole, distance, and orbitant links.

Reads the IBGE REGIC 2018 tabular base (XLSX) from data/raw and returns:
- a municipality frame (codigo_ibge, nome, uf, tipologia, polo_ibge,
  distancia_polo_km);
- a links frame of orbitant-to-pole ties (vinculo == "sim").

Join key: seven-digit IBGE code. Nothing is imputed.
"""
from __future__ import annotations

from pathlib import Path

import openpyxl
import pandas as pd

HIERARQUIA_FILE = "regic2018_municipios_hierarquia_e_regiao_2026-07-03.xlsx"
LIGACOES_FILE = "regic2018_ligacoes_entre_cidades_2026-07-03.xlsx"


def ibge7(value: object) -> str:
    """Normalize any municipality code to a seven-digit zero-padded string."""
    return str(value).strip().split(".")[0].zfill(7)


def _tipologia(hierarquia: str | None) -> str:
    """Map the REGIC hierarchy label to the three functional classes."""
    h = (hierarquia or "").lower()
    if "centro local" in h:
        return "orbitante"
    if "centro de zona" in h:
        return "semi-polo"
    return "polo"  # metropole, capital regional, centro sub-regional


def _read_sheet(path: Path, sheet: str) -> tuple[list, list[tuple]]:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb[sheet]
    rows = ws.iter_rows(values_only=True)
    header = list(next(rows))
    data = list(rows)
    wb.close()
    return header, data


def load_regic(raw_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (municipios, ligacoes) from the REGIC tabular base."""
    h_header, h_rows = _read_sheet(raw_dir / HIERARQUIA_FILE, "Hierarquia e região")
    hi = {name: i for i, name in enumerate(h_header)}
    muni = pd.DataFrame(
        {
            "codigo_ibge": ibge7(r[hi["codmun"]]),
            "nome": r[hi["Município"]],
            "uf": r[hi["siguf"]],
            "tipologia": _tipologia(r[hi["Hierarquia"]]),
        }
        for r in h_rows
        if r[hi["codmun"]] is not None
    )

    l_header, l_rows = _read_sheet(raw_dir / LIGACOES_FILE, "REGIC2018_Ligacoes_entre_Cidade")
    li = {name: i for i, name in enumerate(l_header)}
    lig = pd.DataFrame(
        {
            "origem_ibge": ibge7(r[li["cod_ori"]]),
            "destino_ibge": ibge7(r[li["cod_dest"]]),
            "uf_origem": r[li["uf_ori"]],
            "dist_km": r[li["dist_km"]],
            "vinculo": (r[li["vinculo"]] or "").strip().lower(),
        }
        for r in l_rows
        if r[li["cod_ori"]] is not None
    )

    vin = lig[lig["vinculo"] == "sim"].copy()
    vin["dist_km"] = pd.to_numeric(vin["dist_km"], errors="coerce")
    polo = (
        vin.sort_values("dist_km")
        .groupby("origem_ibge", as_index=False)
        .first()
        .rename(
            columns={
                "origem_ibge": "codigo_ibge",
                "destino_ibge": "polo_ibge",
                "dist_km": "distancia_polo_km",
            }
        )[["codigo_ibge", "polo_ibge", "distancia_polo_km"]]
    )
    muni = muni.merge(polo, on="codigo_ibge", how="left")
    muni["distancia_polo_km"] = muni["distancia_polo_km"].fillna(0.0)

    # Carry the destination name from the REGIC frame, which covers every
    # municipality of the study, not only those that survive into M. A pole may
    # be dropped from the index universe for lack of valid fiscal data (Brasilia
    # is the largest case), and without the name here the client would have no
    # way to say where those municipalities orbit.
    nomes = muni[["codigo_ibge", "nome", "uf"]].rename(
        columns={"codigo_ibge": "polo_ibge", "nome": "polo_nome", "uf": "polo_uf"}
    )
    muni = muni.merge(nomes, on="polo_ibge", how="left")

    ligacoes = vin[["origem_ibge", "destino_ibge", "uf_origem"]].reset_index(drop=True)
    return muni, ligacoes
