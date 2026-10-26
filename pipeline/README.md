# idm-pipeline

Data pipeline for the "Brasil em Orbita: Indice de Dependencia Municipal (IDM)"
panel. Ingests open federal sources, standardizes the seven-digit IBGE key,
computes the IDM as specified in [`docs/IDM_SPEC.md`](../docs/IDM_SPEC.md), runs
the mandatory validation, and publishes the JSON artifacts described in
[`docs/CONTRATO_DADO.md`](../docs/CONTRATO_DADO.md).

## Layout

```
pipeline/
  pyproject.toml          <- uv/hatchling project, deps and dev deps
  build.py                <- single entrypoint: index, mesh and region contours
  idm_pipeline/
    idm_core.py           <- pure, IO-free IDM formula and weights (single source of truth)
    schemas.py            <- TypedDict schemas mirroring the data contract
    regic.py              <- REGIC 2018 -> typology, distance to pole, links
    finbra.py             <- FINBRA/Siconfi -> FPM and total revenue
    pib.py, populacao.py  <- IBGE GDP and population estimates
    servicos.py           <- CNES and INEP service presence
    idhm.py               <- IDHM context layer (left join, outside the index)
    idm.py                <- join + idm_core -> municipios.json, ligacoes.json, validacao.json
    malha.py, regioes.py  <- simplified municipal mesh and macro-region contours
    manifesto.py          <- manifesto.json with provenance and coverage
  extrair_acesso_*.py     <- effective-access context layers (health, education, banking)
  extrair_despesa_funcao.py, construir_cenarios.py <- "Brasil em Cenarios" artifacts
  estratos_idhm.py        <- prints the stratified IDM x IDHM validation figures
  tests/                  <- unit tests of the formula on synthetic data
```

## Usage

Raw sources go in `../data/raw/` with the extraction date in the file name; the
list of sources, URLs and dates is in [`docs/DADOS.md`](../docs/DADOS.md).

```
uv sync --extra dev
uv run python build.py --raw ../data/raw --out ../app/public/data
uv run pytest
uv run ruff check .
```

The auxiliary scripts read the `municipios.json` produced by `build.py` and use
paths relative to the repository root, so they run from there afterwards:

```
uv run --project pipeline python pipeline/extrair_acesso_saude.py
uv run --project pipeline python pipeline/extrair_despesa_funcao.py
uv run --project pipeline python pipeline/construir_cenarios.py
```

The same build runs in a container through `pipeline/Dockerfile`. Nothing runs on
import; every script guards execution under `if __name__ == "__main__"`.
