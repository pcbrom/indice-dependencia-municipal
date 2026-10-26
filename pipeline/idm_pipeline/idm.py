"""Assemble the IDM: load the five sources, join on the seven-digit IBGE key,
gate on completeness, compute the three axes and the IDM, publish the contract
artifacts and the mandatory validation.

Sources: REGIC (typology, pole, distance, links), FINBRA (revenue, FPM,
population), PIB (IBGE), CNES/INEP (service presence flags). Nothing is imputed;
a municipality missing fiscal or PIB data drops out of M. Service flags absent
from CNES/INEP mean the service is absent (False), not missing.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import pandas as pd

from idm_pipeline import (
    finbra,
    idhm as idhm_mod,
    idm_core,
    manifesto,
    pib,
    populacao,
    regic,
    servicos,
)
from idm_pipeline.schemas import MUNICIPIO_FIELDS

ANO_IDHM = 2010

REQUIRED_COMPLETE_FIELDS = ("pib", "fpm", "receita_total")
UNIVERSO_NACIONAL = 5570


def porte(pop: object) -> str | None:
    if pop is None or pd.isna(pop):
        return None
    p = float(pop)
    if p < 5000:
        return "ate 5k"
    if p < 20000:
        return "5k a 20k"
    if p < 50000:
        return "20k a 50k"
    if p < 100000:
        return "50k a 100k"
    if p < 500000:
        return "100k a 500k"
    return "acima de 500k"


def _json_safe(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def frame_to_records(frame: pd.DataFrame) -> list[dict]:
    return [{c: _json_safe(row[c]) for c in frame.columns} for _, row in frame.iterrows()]


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))


def _load_acesso_presenca(acesso_dir: Path) -> dict[str, dict[str, bool]]:
    """Effective-access presence used to widen (never narrow) the service flags.

    The access layer (built by the extrair_acesso_* scripts) measures presence
    with newer and broader sources than the Etapa 0 flags: ICU beds (CNES leitos)
    for high-complexity health and in-person courses (INEP censup) for higher
    education. A municipality with an ICU necessarily has high-complexity care,
    and one with an in-person course necessarily retains higher education, so the
    coarse flag is set true wherever the access layer is positive. Returns
    {codigo_ibge: {"uti": bool, "presencial": bool}} for positives only.
    """
    def _positives(name: str, field: str) -> set[str]:
        p = acesso_dir / name
        if not p.exists():
            return set()
        recs = json.loads(p.read_text())["municipios"]
        return {r["codigo_ibge"] for r in recs if r.get(field)}
    uti = _positives("acesso_saude.json", "tem_uti")
    pres = _positives("acesso_educacao.json", "ies_presencial")
    return {"uti": uti, "presencial": pres}


def assemble(
    raw_dir: Path, acesso_dir: Path | None = None
) -> tuple[pd.DataFrame, pd.DataFrame, float, int]:
    """Return (municipios_M, ligacoes, cobertura, universo).

    When acesso_dir holds the access artifacts, the service presence flags are
    reconciled with that broader evidence before the services axis is computed.
    """
    muni, ligacoes = regic.load_regic(raw_dir)
    universo = len(muni)  # REGIC covers all Brazilian municipalities
    df = (
        muni.merge(finbra.load_finbra(raw_dir), on="codigo_ibge", how="left")
        .merge(pib.load_pib(raw_dir), on="codigo_ibge", how="left")
        .merge(servicos.load_servicos(raw_dir), on="codigo_ibge", how="left")
        # Context layer, left-joined so a missing value never drops a
        # municipality from M and never touches the completeness gate below.
        .merge(populacao.load_populacao_estimada(raw_dir), on="codigo_ibge", how="left")
        .merge(idhm_mod.load_idhm(raw_dir), on="codigo_ibge", how="left")
    )
    df["tem_hospital_mac"] = df["tem_hospital_mac"].fillna(False)
    df["tem_ies"] = df["tem_ies"].fillna(False)
    if acesso_dir is not None:
        acesso = _load_acesso_presenca(acesso_dir)
        df["tem_hospital_mac"] = df["tem_hospital_mac"] | df["codigo_ibge"].isin(acesso["uti"])
        df["tem_ies"] = df["tem_ies"] | df["codigo_ibge"].isin(acesso["presencial"])
    df["porte_faixa"] = df["populacao"].map(porte)

    mask = df[list(REQUIRED_COMPLETE_FIELDS)].notna().all(axis=1)
    m = df.loc[mask].copy()
    cobertura = len(m) / universo if universo else 0.0

    computed = idm_core.compute_idm_frame(m)
    municipios = computed.reindex(columns=list(MUNICIPIO_FIELDS))
    return municipios, ligacoes, cobertura, universo


def write_validation(municipios: pd.DataFrame, ligacoes: pd.DataFrame, out_dir: Path) -> idm_core.ValidationReport:
    report = idm_core.validate(
        idm=municipios["idm"],
        populacao=municipios["populacao"],
        eixo_orbitacao=municipios["eixo_orbitacao"],
        eixo_fiscal=municipios["eixo_fiscal"],
        eixo_servicos=municipios["eixo_servicos"],
        razao_receita_pib=municipios["razao_receita_pib"],
    )
    # verifiable cases: REGIC links resolve to municipalities in M
    codes = set(municipios["codigo_ibge"])
    dangling = int((~ligacoes["origem_ibge"].isin(codes)).sum() + (~ligacoes["destino_ibge"].isin(codes)).sum())
    # External descriptive validation against the IDHM (context layer). Hardened
    # per the adversarial debate: partial Spearman controlling population,
    # per-axis decomposition, bootstrap, stratification, no p-values.
    idm_idhm = idm_core.idm_idhm_report(
        idm=municipios["idm"],
        idhm=municipios["idhm"],
        populacao=municipios["populacao"],
        eixo_orbitacao=municipios["eixo_orbitacao"],
        eixo_fiscal=municipios["eixo_fiscal"],
        eixo_servicos=municipios["eixo_servicos"],
        porte_faixa=municipios["porte_faixa"],
        codigo_ibge=municipios["codigo_ibge"],
        ano_idhm=ANO_IDHM,
    )
    payload = {
        "n_municipios": report.n_municipios,
        "spearman_idm_log_pop": _json_safe(report.spearman_idm_log_pop),
        "stratify_by_porte": report.stratify_by_porte,
        "corr_eixos": {k: {kk: _json_safe(vv) for kk, vv in v.items()} for k, v in report.corr_eixos.to_dict().items()},
        "n_receita_maior_pib": report.n_receita_maior_pib,
        "n_ligacoes": int(len(ligacoes)),
        "ligacoes_dangling": dangling,
        "idm_idhm": idm_idhm,
    }
    write_json(out_dir / "validacao.json", payload)
    return report


def run(raw_dir: Path, out_dir: Path, *, ano_fiscal: int = 2024, ano_regic: int = 2018) -> None:
    # The access artifacts live alongside the published outputs; reconcile the
    # service presence with them (they must be built first, see pipeline/README).
    municipios, ligacoes, cobertura, universo = assemble(raw_dir, acesso_dir=out_dir)
    write_json(out_dir / "municipios.json", frame_to_records(municipios))
    write_json(out_dir / "ligacoes.json", frame_to_records(ligacoes))
    report = write_validation(municipios, ligacoes, out_dir)
    destaques = idm_core.national_highlights(
        tipologia=municipios["tipologia"],
        populacao_estimada=municipios["populacao_estimada"],
    )
    destaques["cobertura"] = _json_safe(cobertura)
    destaques["universo"] = int(universo)
    write_json(out_dir / "destaques.json", destaques)
    manifesto.generate(
        out_dir,
        cobertura=cobertura,
        universo=universo,
        validos=len(municipios),
        ano_fiscal=ano_fiscal,
        ano_regic=ano_regic,
    )
    print(f"IDM: {len(municipios)}/{universo} municipios ({100*cobertura:.2f}%)")
    print(f"Spearman IDM vs log-pop: {report.spearman_idm_log_pop:.3f} "
          f"(estratificar por porte: {report.stratify_by_porte})")
    print(f"municipios com receita > PIB: {report.n_receita_maior_pib}")
    print(f"ligacoes: {len(ligacoes)}, dangling: "
          f"{int((~ligacoes['origem_ibge'].isin(set(municipios['codigo_ibge']))).sum())}")


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Assemble and publish the IDM.")
    p.add_argument("--raw", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    return p.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    run(args.raw, args.out)
    sys.exit(0)
