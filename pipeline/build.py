"""Pipeline entrypoint: orchestrate the full IDM build.

Reads the datestamped sources in data/raw (REGIC, FINBRA, PIB, CNES, INEP,
municipal mesh) and writes the contract artifacts to the output directory:

    municipios.json   national cut of M with the IDM
    ligacoes.json     orbitant-to-pole REGIC links
    validacao.json    mandatory validation report
    malha.geojson     simplified municipal mesh for MapLibre
    regioes.geojson   macro-region contours dissolved from the mesh
    manifesto.json    provenance and coverage

Single entrypoint the Dockerfile and CI call. Raw sources live outside version
control and are bind-mounted at run time. No secrets.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from idm_pipeline import idm, malha, regioes

DEFAULT_RAW = Path("/data/raw")
DEFAULT_OUT = Path("/pipeline/out")


def run(raw_dir: Path, out_dir: Path) -> None:
    if not raw_dir.exists():
        print(f"ERRO: diretorio de dados brutos ausente ({raw_dir}).", file=sys.stderr)
        raise SystemExit(1)
    out_dir.mkdir(parents=True, exist_ok=True)
    idm.run(raw_dir, out_dir)
    malha.run(out_dir, raw_dir=raw_dir)
    regioes.run(out_dir)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the full IDM data pipeline.")
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW, help="data/raw directory")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output directory")
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    run(args.raw, args.out)
