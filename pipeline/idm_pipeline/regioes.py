"""Macro-region contours: dissolve the municipal mesh into the five Brazilian
macro-regions and publish regioes.geojson.

No external source is read: the macro-region of a municipality is the first
digit of its seven-digit IBGE code (1 Norte, 2 Nordeste, 3 Sudeste, 4 Sul,
5 Centro-Oeste). Dissolving the mesh by that key gives the map a structural
contour above the choropleth without adding a second color channel to the IDM.
Geometry is coarsely simplified (a guide line, not a survey boundary) so the
artifact stays small, and a representative interior point per region is emitted
for label placement on the client.
"""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping

# First digit of the IBGE code -> macro-region name.
REGIOES = {
    "1": "Norte",
    "2": "Nordeste",
    "3": "Sudeste",
    "4": "Sul",
    "5": "Centro-Oeste",
}

# Douglas-Peucker tolerance in degrees. The contour is a structural guide, not a
# survey boundary, so a coarse simplification keeps the artifact light.
SIMPLIFY_TOL = 0.02


def run(out_dir: Path) -> None:
    """Read the mesh written by malha.run, dissolve by region, write regioes.geojson."""
    gdf = gpd.read_file(out_dir / "malha.geojson")
    gdf["codigo_ibge"] = gdf["codigo_ibge"].astype(str).str.zfill(7)
    gdf["regiao"] = gdf["codigo_ibge"].str[0].map(REGIOES)
    gdf = gdf.dropna(subset=["regiao"])

    dissolved = gdf.dissolve(by="regiao")
    dissolved["geometry"] = dissolved.geometry.simplify(
        SIMPLIFY_TOL, preserve_topology=True
    )

    features = []
    for regiao, row in dissolved.iterrows():
        ponto = row.geometry.representative_point()
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "regiao": regiao,
                    "centro": [round(ponto.x, 4), round(ponto.y, 4)],
                },
                "geometry": mapping(row.geometry),
            }
        )

    fc = {"type": "FeatureCollection", "features": features}
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "regioes.geojson").open("w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"regioes.geojson: {len(features)} regioes")
