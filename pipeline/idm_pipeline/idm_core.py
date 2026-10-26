"""Pure implementation of the IDM formula, per docs/IDM_SPEC.md.

This module is the single reference for the index in code. It has no IO: every
function takes and returns in-memory pandas/numpy objects, so it is unit-testable
in isolation. Divergence between this module and IDM_SPEC.md is a code defect.

Notation (spec section "Notacao"): for a variable x over the set M of valid
municipalities with N = |M|, the percentile-rank normalization is

    r(x_i) = (rank(x_i) - 1) / (N - 1)  in [0, 1],

with rank ascending and ties resolved by the average of the tied ranks.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

# Equal weights in version 1 (spec section "Composicao"). Declared here and in
# the manifest; any change is a documented decision, not a silent edit.
DEFAULT_WEIGHTS: tuple[float, float, float] = (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0)


def percentile_rank(x: pd.Series) -> pd.Series:
    """Percentile-rank normalization r(x) in [0, 1].

    Ascending rank, ties averaged, denominator N - 1 with N = |M| = len(x), the
    cardinality of the valid set M (spec section "Notacao"). The completeness
    gate upstream (idm.run) removes municipalities with any missing contract
    field before this is called, so in M there is no NaN in the ranked columns
    and N = len(x). A NaN that still appears is preserved (pandas keeps it out of
    the ranking) rather than silently receiving a rank. For len(x) <= 1 the single
    element maps to 0.0 (no spread to normalize).
    """
    n = len(x)
    if n <= 1:
        # Single observation: define r = 0.0 for it, NaN stays NaN.
        return x.where(x.isna(), 0.0).astype(float)
    ranks = x.rank(method="average", ascending=True)
    return (ranks - 1.0) / (n - 1.0)


def axis_orbitation(distance_polo_km: pd.Series) -> pd.Series:
    """Eixo 1, orbitacao: O_i = r(d_i).

    d_i is the distance in km to the REGIC destination pole, with d_i = 0 for
    poles and semi-poles that do not orbit. Poles get low O; distant orbitants
    get high O.
    """
    return percentile_rank(distance_polo_km)


def ratio_fpm_receita(fpm: pd.Series, receita_total: pd.Series) -> pd.Series:
    """f^(1)_i = FPM_i / receita_total_i, in [0, 1]."""
    return fpm / receita_total


def ratio_receita_pib(receita_total: pd.Series, pib: pd.Series) -> pd.Series:
    """f^(2)_i = receita_total_i / PIB_i; may exceed 1."""
    return receita_total / pib


def axis_fiscal(
    fpm: pd.Series,
    receita_total: pd.Series,
    pib: pd.Series,
) -> pd.Series:
    """Eixo 2, dependencia fiscal: F_i = 0.5 * [ r(f^(1)) + r(f^(2)) ].

    Mean of the two percentile ranks. Both ratios are normalized independently
    before averaging, so the axis is scale-free.
    """
    f1 = ratio_fpm_receita(fpm, receita_total)
    f2 = ratio_receita_pib(receita_total, pib)
    return 0.5 * (percentile_rank(f1) + percentile_rank(f2))


def axis_services(tem_hospital_mac: pd.Series, tem_ies: pd.Series) -> pd.Series:
    """Eixo 3, autossuficiencia de servicos invertida: S_i = 1 - (h_i + s_i)/2.

    h and s are binary presence indicators (CNES hospital of medium/high
    complexity; INEP higher-education institution). Absence of service raises
    the index. Accepts bool or 0/1 numeric input.
    """
    h = tem_hospital_mac.astype(float)
    s = tem_ies.astype(float)
    return 1.0 - (h + s) / 2.0


def compose_idm(
    eixo_orbitacao: pd.Series,
    eixo_fiscal: pd.Series,
    eixo_servicos: pd.Series,
    weights: tuple[float, float, float] = DEFAULT_WEIGHTS,
) -> pd.Series:
    """IDM_i = w1*O_i + w2*F_i + w3*S_i, with IDM_i in [0, 1].

    Weights default to equal thirds. When they sum to 1 and each axis is in
    [0, 1], the composite is in [0, 1] by convexity.
    """
    w1, w2, w3 = weights
    return w1 * eixo_orbitacao + w2 * eixo_fiscal + w3 * eixo_servicos


def idm_percentile(idm: pd.Series) -> pd.Series:
    """r(IDM_i): percentile rank of the IDM itself, for the lay relative reading."""
    return percentile_rank(idm)


def spearman_corr(a: pd.Series, b: pd.Series) -> float:
    """Spearman rho between two series, computed as Pearson of the ranks.

    Avoids a scipy dependency. Pairs with any NaN are dropped. Returns NaN when
    fewer than two complete pairs remain or when a rank vector has zero variance.
    """
    frame = pd.concat([a, b], axis=1).dropna()
    if len(frame) < 2:
        return float("nan")
    ra = frame.iloc[:, 0].rank(method="average")
    rb = frame.iloc[:, 1].rank(method="average")
    va = ra.to_numpy(dtype=float)
    vb = rb.to_numpy(dtype=float)
    if np.std(va) == 0.0 or np.std(vb) == 0.0:
        return float("nan")
    return float(np.corrcoef(va, vb)[0, 1])


def partial_spearman(a: pd.Series, b: pd.Series, c: pd.Series) -> float:
    """Spearman partial correlation of a and b controlling for c.

    Partial correlation computed as Pearson on the ranks: rank a, b and c, then

        r(ab.c) = (r_ab - r_ac * r_bc) / sqrt((1 - r_ac^2)(1 - r_bc^2)).

    Isolates the a-b monotonic association net of the common driver c (here the
    control is log-population, the shared size/centrality confounder). Rows with
    any NaN are dropped. Returns NaN with fewer than three complete rows or a
    degenerate denominator.
    """
    frame = pd.concat([a, b, c], axis=1).dropna()
    if len(frame) < 3:
        return float("nan")
    ra = frame.iloc[:, 0].rank(method="average").to_numpy(dtype=float)
    rb = frame.iloc[:, 1].rank(method="average").to_numpy(dtype=float)
    rc = frame.iloc[:, 2].rank(method="average").to_numpy(dtype=float)
    if np.std(ra) == 0.0 or np.std(rb) == 0.0 or np.std(rc) == 0.0:
        return float("nan")
    r_ab = float(np.corrcoef(ra, rb)[0, 1])
    r_ac = float(np.corrcoef(ra, rc)[0, 1])
    r_bc = float(np.corrcoef(rb, rc)[0, 1])
    denom = math.sqrt((1.0 - r_ac**2) * (1.0 - r_bc**2))
    if denom == 0.0:
        return float("nan")
    return (r_ab - r_ac * r_bc) / denom


def _bootstrap_ci(
    columns: list[pd.Series],
    statistic: Callable[..., float],
    *,
    n_boot: int = 2000,
    seed: int = 20260704,
    alpha: float = 0.05,
) -> tuple[float, float]:
    """Percentile bootstrap CI for a statistic of one or more aligned series.

    Resamples municipalities with replacement, recomputes the statistic, and
    returns the (alpha/2, 1 - alpha/2) percentiles. Seeded for reproducibility;
    used to communicate resampling uncertainty in the strata without p-values,
    since the panel is a census of municipalities, not a sample.
    """
    frame = pd.concat(columns, axis=1).dropna()
    n = len(frame)
    if n < 3:
        return (float("nan"), float("nan"))
    arr = frame.to_numpy(dtype=float)
    rng = np.random.default_rng(seed)
    values: list[float] = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        sample = [pd.Series(arr[idx, k]) for k in range(arr.shape[1])]
        v = statistic(*sample)
        if np.isfinite(v):
            values.append(v)
    if not values:
        return (float("nan"), float("nan"))
    lo, hi = np.percentile(values, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return (float(lo), float(hi))


REGIAO_POR_DIGITO = {
    "1": "Norte",
    "2": "Nordeste",
    "3": "Sudeste",
    "4": "Sul",
    "5": "Centro-Oeste",
}


def idm_idhm_report(
    idm: pd.Series,
    idhm: pd.Series,
    populacao: pd.Series,
    eixo_orbitacao: pd.Series,
    eixo_fiscal: pd.Series,
    eixo_servicos: pd.Series,
    porte_faixa: pd.Series,
    codigo_ibge: pd.Series,
    *,
    ano_idhm: int,
    n_min_celula: int = 50,
) -> dict:
    """External descriptive validation of the IDM against the IDHM.

    Reports the raw Spearman AND the partial
    Spearman controlling for log-population (the common size confounder), the
    per-axis decomposition so the reader sees which axes carry the association
    independently of the confounder, bootstrap confidence intervals, and a
    stratification by porte and macro-region suppressing cells below n_min_celula.
    No p-values: the IDM covers the near-complete population of municipalities,
    not a sample, so rho is a descriptive parameter, and the only uncertainty
    reported is resampling uncertainty via the bootstrap. This is an association,
    never a causal estimate (docs/DECISAO_CAUSAL.md).
    """
    log_pop = np.log(populacao.astype(float))
    rho_bruto = spearman_corr(idm, idhm)
    rho_parcial = partial_spearman(idm, idhm, log_pop)

    ci_bruto = _bootstrap_ci([idm, idhm], spearman_corr)
    ci_parcial = _bootstrap_ci([idm, idhm, log_pop], partial_spearman)

    por_eixo = {
        "orbitacao": spearman_corr(eixo_orbitacao, idhm),
        "fiscal": spearman_corr(eixo_fiscal, idhm),
        "servicos": spearman_corr(eixo_servicos, idhm),
    }

    regiao = codigo_ibge.astype(str).str[0].map(REGIAO_POR_DIGITO)
    strat = pd.DataFrame(
        {
            "porte": porte_faixa.to_numpy(),
            "regiao": regiao.to_numpy(),
            "idm": idm.to_numpy(),
            "idhm": idhm.to_numpy(),
        }
    ).dropna(subset=["idm", "idhm", "porte", "regiao"])

    celulas: list[dict] = []
    suprimidas = 0
    for (p, r), grp in strat.groupby(["porte", "regiao"], sort=True):
        n = len(grp)
        if n < n_min_celula:
            suprimidas += 1
            continue
        celulas.append(
            {
                "porte": p,
                "regiao": r,
                "n": int(n),
                "rho": _finite_or_none(spearman_corr(grp["idm"], grp["idhm"])),
            }
        )

    n_pareado = int(pd.concat([idm, idhm], axis=1).dropna().shape[0])
    return {
        "ano_idhm": ano_idhm,
        "n_pareado": n_pareado,
        "n_sem_idhm": int(idhm.isna().sum()),
        "rho_bruto": _finite_or_none(rho_bruto),
        "rho_bruto_ic95": [_finite_or_none(ci_bruto[0]), _finite_or_none(ci_bruto[1])],
        "rho_parcial_log_pop": _finite_or_none(rho_parcial),
        "rho_parcial_ic95": [_finite_or_none(ci_parcial[0]), _finite_or_none(ci_parcial[1])],
        "rho_por_eixo": {k: _finite_or_none(v) for k, v in por_eixo.items()},
        "n_min_celula": n_min_celula,
        "celulas_suprimidas": int(suprimidas),
        "estratos": celulas,
    }


def _finite_or_none(value: float) -> float | None:
    return float(value) if value is not None and np.isfinite(value) else None


@dataclass(frozen=True)
class ValidationReport:
    """Mandatory validation output, per spec section "Validacao obrigatoria"."""

    n_municipios: int
    spearman_idm_log_pop: float
    stratify_by_porte: bool  # True when |rho| > 0.8
    corr_eixos: pd.DataFrame  # 3x3 correlation matrix of the three axes
    redundant_axis_pairs: list[tuple[str, str, float]]  # |corr| >= threshold
    n_receita_maior_pib: int  # verifiable cases f^(2) > 1


def validate(
    idm: pd.Series,
    populacao: pd.Series,
    eixo_orbitacao: pd.Series,
    eixo_fiscal: pd.Series,
    eixo_servicos: pd.Series,
    razao_receita_pib: pd.Series,
    *,
    spearman_threshold: float = 0.8,
    redundancy_threshold: float = 0.8,
) -> ValidationReport:
    """Run the mandatory pre-publication validation.

    - Spearman between IDM and log(population); if |rho| > threshold the ranking
      must be stratified by porte as the primary reading.
    - Pairwise correlation matrix of the three axes; pairs above the redundancy
      threshold are flagged for the methodological note.
    - Count of verifiable cases where receita exceeds PIB (f^(2) > 1).
    """
    log_pop = np.log(populacao.astype(float))
    rho = spearman_corr(idm, log_pop)
    stratify = bool(np.isfinite(rho) and abs(rho) > spearman_threshold)

    axes = pd.DataFrame(
        {
            "orbitacao": eixo_orbitacao,
            "fiscal": eixo_fiscal,
            "servicos": eixo_servicos,
        }
    )
    corr = axes.corr(method="pearson")

    names = list(corr.columns)
    redundant: list[tuple[str, str, float]] = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            c = float(corr.iloc[i, j])
            if np.isfinite(c) and abs(c) >= redundancy_threshold:
                redundant.append((names[i], names[j], c))

    n_receita_maior_pib = int((razao_receita_pib > 1.0).sum())

    return ValidationReport(
        n_municipios=int(idm.notna().sum()),
        spearman_idm_log_pop=rho,
        stratify_by_porte=stratify,
        corr_eixos=corr,
        redundant_axis_pairs=redundant,
        n_receita_maior_pib=n_receita_maior_pib,
    )


# The three REGIC roles partition M. "orbitante" is the dependent role, by
# definition oriented toward another city for higher-order services; its
# population is the headline "people who depend on another city" figure.
_PAPEL_DEPENDENTE = "orbitante"


def national_highlights(
    tipologia: pd.Series,
    populacao_estimada: pd.Series,
) -> dict:
    """National headline figures derived from the typology partition.

    Returns, per role, the municipality count and the summed current population
    estimate, plus the dependent aggregate (orbitants) with its share of the
    national total. Population uses the current IBGE estimate, the same figure
    the interpretation layer sums per pole in {POPREDE}, so the national number
    reconciles with the per-pole readings. Pure and testable: no IO, no rounding
    for display (the front formats).
    """
    pop = pd.to_numeric(populacao_estimada, errors="coerce").fillna(0.0)
    total_municipios = int(len(tipologia))
    total_populacao = int(pop.sum())
    por_tipologia: dict[str, dict[str, int]] = {}
    for papel in tipologia.dropna().unique():
        sel = tipologia == papel
        por_tipologia[str(papel)] = {
            "n": int(sel.sum()),
            "populacao": int(pop[sel].sum()),
        }
    dep = por_tipologia.get(_PAPEL_DEPENDENTE, {"n": 0, "populacao": 0})
    return {
        "total_municipios": total_municipios,
        "total_populacao": total_populacao,
        "por_tipologia": por_tipologia,
        "dependentes": {
            "papel": _PAPEL_DEPENDENTE,
            "n_municipios": dep["n"],
            "populacao": dep["populacao"],
            "share_municipios": (dep["n"] / total_municipios) if total_municipios else 0.0,
            "share_populacao": (dep["populacao"] / total_populacao) if total_populacao else 0.0,
        },
    }


def compute_idm_frame(
    df: pd.DataFrame,
    weights: tuple[float, float, float] = DEFAULT_WEIGHTS,
) -> pd.DataFrame:
    """Compute the three axes, the derived ratios, the IDM and its percentile.

    Pure transform: takes a frame with the raw input columns and returns a copy
    with the computed columns added. The caller is responsible for having
    restricted the frame to M (valid municipalities) beforehand; nothing is
    imputed here.

    Required input columns:
        distancia_polo_km, fpm, receita_total, pib, tem_hospital_mac, tem_ies

    Added columns:
        razao_fpm_receita, razao_receita_pib,
        eixo_orbitacao, eixo_fiscal, eixo_servicos, idm, idm_percentil
    """
    required = [
        "distancia_polo_km",
        "fpm",
        "receita_total",
        "pib",
        "tem_hospital_mac",
        "tem_ies",
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise KeyError(f"missing required input columns: {missing}")

    out = df.copy()
    out["razao_fpm_receita"] = ratio_fpm_receita(out["fpm"], out["receita_total"])
    out["razao_receita_pib"] = ratio_receita_pib(out["receita_total"], out["pib"])
    out["eixo_orbitacao"] = axis_orbitation(out["distancia_polo_km"])
    out["eixo_fiscal"] = axis_fiscal(out["fpm"], out["receita_total"], out["pib"])
    out["eixo_servicos"] = axis_services(out["tem_hospital_mac"], out["tem_ies"])
    out["idm"] = compose_idm(
        out["eixo_orbitacao"], out["eixo_fiscal"], out["eixo_servicos"], weights
    )
    out["idm_percentil"] = idm_percentile(out["idm"])
    return out
