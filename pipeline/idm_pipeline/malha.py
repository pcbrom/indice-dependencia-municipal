"""Municipal mesh: fetch the simplified IBGE GeoJSON and publish malha.geojson.

A size check measured the minimum-quality IBGE mesh at ~486 KB brotli, well
under the 2 MB budget, so a static simplified GeoJSON served to MapLibre GL is
sufficient; PMTiles/tippecanoe is not needed for the base choropleth. Each
feature is normalized to carry codigo_ibge (seven digits) for the client join.
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

IBGE_MALHA_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
    "?intrarregiao=municipio&qualidade=minima&formato=application/vnd.geo+json"
)
CACHE_FILE = "malha_municipios_minima_2026-07-03.geojson"


def _normalize(geojson: dict) -> dict:
    """Ensure each feature exposes codigo_ibge (from the IBGE codarea property)."""
    for feat in geojson.get("features", []):
        props = feat.setdefault("properties", {})
        code = props.get("codarea") or props.get("codigo_ibge") or props.get("CD_MUN")
        if code is not None:
            props["codigo_ibge"] = str(code).strip().split(".")[0].zfill(7)
    return geojson


def run(out_dir: Path, raw_dir: Path | None = None) -> None:
    """Fetch (or reuse cached) IBGE mesh, normalize, write malha.geojson."""
    data: bytes | None = None
    if raw_dir is not None and (raw_dir / CACHE_FILE).exists():
        data = (raw_dir / CACHE_FILE).read_bytes()
    if data is None:
        req = urllib.request.Request(IBGE_MALHA_URL, headers={"User-Agent": "idm-pipeline/1.0"})
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = resp.read()
        if raw_dir is not None:
            raw_dir.mkdir(parents=True, exist_ok=True)
            (raw_dir / CACHE_FILE).write_bytes(data)

    geojson = _normalize(json.loads(data))
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "malha.geojson").open("w", encoding="utf-8") as fh:
        json.dump(geojson, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"malha.geojson: {len(geojson.get('features', []))} feicoes")
