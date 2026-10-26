"""Unit tests for idm_core, the pure IDM formula.

Synthetic, tiny datasets. These pin the formula to IDM_SPEC.md: percentile-rank
correctness (including averaged ties), each axis and the composite staying in
[0, 1], the invertible service axis, and the verifiable receita > PIB case.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from idm_pipeline import idm_core

# --- percentile_rank ---------------------------------------------------------


def test_percentile_rank_endpoints_and_spread():
    # Distinct ascending values: min -> 0, max -> 1, evenly spaced.
    x = pd.Series([10.0, 20.0, 30.0, 40.0, 50.0])
    r = idm_core.percentile_rank(x)
    assert r.iloc[0] == pytest.approx(0.0)
    assert r.iloc[-1] == pytest.approx(1.0)
    assert list(r) == pytest.approx([0.0, 0.25, 0.5, 0.75, 1.0])


def test_percentile_rank_ties_averaged():
    # Ties resolved by the average of the tied ranks (spec "Notacao").
    # Values [10, 20, 20, 40], N = 4. Ranks: 1, 2.5, 2.5, 4.
    # r = (rank - 1) / (N - 1) = 0, 0.5, 0.5, 1.
    x = pd.Series([10.0, 20.0, 20.0, 40.0])
    r = idm_core.percentile_rank(x)
    assert list(r) == pytest.approx([0.0, 0.5, 0.5, 1.0])


def test_percentile_rank_in_unit_interval():
    rng = np.random.default_rng(0)
    x = pd.Series(rng.normal(size=200))
    r = idm_core.percentile_rank(x)
    assert r.min() >= 0.0
    assert r.max() <= 1.0


def test_percentile_rank_single_element():
    x = pd.Series([42.0])
    r = idm_core.percentile_rank(x)
    assert r.iloc[0] == pytest.approx(0.0)


def test_percentile_rank_preserves_nan():
    # Denominator is N = len(x) = 3 (spec cardinality of M), not the non-NaN
    # count. A stray NaN is preserved (kept out of the ranking); the valid
    # values rank 1 and 2 -> r = 0 and 0.5. The upstream completeness gate is
    # what guarantees no NaN reaches here in production.
    x = pd.Series([1.0, np.nan, 3.0])
    r = idm_core.percentile_rank(x)
    assert math.isnan(r.iloc[1])
    assert r.iloc[0] == pytest.approx(0.0)
    assert r.iloc[2] == pytest.approx(0.5)


# --- axes --------------------------------------------------------------------


def test_axis_orbitation_pole_is_low():
    # Pole has distance 0 and must get the lowest orbitation.
    dist = pd.Series([0.0, 50.0, 120.0])
    o = idm_core.axis_orbitation(dist)
    assert o.iloc[0] == pytest.approx(0.0)
    assert o.iloc[-1] == pytest.approx(1.0)


def test_axis_fiscal_is_mean_of_two_ranks_and_in_unit():
    fpm = pd.Series([10.0, 20.0, 5.0])
    receita = pd.Series([100.0, 40.0, 50.0])
    pib = pd.Series([1000.0, 50.0, 200.0])
    f = idm_core.axis_fiscal(fpm, receita, pib)
    # Manual: f1 = fpm/receita = 0.1, 0.5, 0.1 -> ranks avg (1.5,3,1.5)-1/2 = .25,1,.25
    # f2 = receita/pib = 0.1, 0.8, 0.25 -> r = 0, 1, 0.5
    # F = mean: (.25+0)/2, (1+1)/2, (.25+.5)/2 = .125, 1, .375
    assert list(f) == pytest.approx([0.125, 1.0, 0.375])
    assert f.min() >= 0.0 and f.max() <= 1.0


def test_axis_services_inverted():
    # Both present -> 0; none present -> 1; one present -> 0.5.
    h = pd.Series([True, False, True])
    s = pd.Series([True, False, False])
    a = idm_core.axis_services(h, s)
    assert list(a) == pytest.approx([0.0, 1.0, 0.5])


def test_axis_services_accepts_numeric_binary():
    h = pd.Series([1, 0])
    s = pd.Series([0, 0])
    a = idm_core.axis_services(h, s)
    assert list(a) == pytest.approx([0.5, 1.0])


# --- composition -------------------------------------------------------------


def test_compose_idm_equal_weights_in_unit():
    o = pd.Series([0.0, 0.5, 1.0])
    f = pd.Series([1.0, 0.5, 0.0])
    s = pd.Series([0.5, 0.5, 0.5])
    idm = idm_core.compose_idm(o, f, s)
    assert list(idm) == pytest.approx([0.5, 0.5, 0.5])
    assert idm.min() >= 0.0 and idm.max() <= 1.0


def test_idm_stays_in_unit_for_random_axes():
    rng = np.random.default_rng(1)
    o = pd.Series(rng.uniform(size=500))
    f = pd.Series(rng.uniform(size=500))
    s = pd.Series(rng.uniform(size=500))
    idm = idm_core.compose_idm(o, f, s)
    assert idm.min() >= 0.0
    assert idm.max() <= 1.0


# --- receita > PIB verifiable case -------------------------------------------


def test_ratio_receita_pib_can_exceed_one():
    receita = pd.Series([120.0, 50.0])
    pib = pd.Series([100.0, 200.0])
    f2 = idm_core.ratio_receita_pib(receita, pib)
    assert f2.iloc[0] > 1.0
    assert f2.iloc[1] < 1.0


# --- full frame + validation -------------------------------------------------


def _synthetic_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "codigo_ibge": ["0000001", "0000002", "0000003", "0000004"],
            "populacao": [2000, 15000, 120000, 900000],
            "distancia_polo_km": [200.0, 90.0, 0.0, 0.0],
            "fpm": [30.0, 20.0, 5.0, 2.0],
            "receita_total": [40.0, 50.0, 60.0, 100.0],
            # Municipality 1: receita > pib (verifiable case f2 > 1).
            "pib": [30.0, 200.0, 5000.0, 800000.0],
            "tem_hospital_mac": [False, False, True, True],
            "tem_ies": [False, False, True, True],
        }
    )


def test_compute_idm_frame_adds_contract_columns_in_unit():
    out = idm_core.compute_idm_frame(_synthetic_frame())
    for col in ("eixo_orbitacao", "eixo_fiscal", "eixo_servicos", "idm", "idm_percentil"):
        assert col in out.columns
        assert out[col].min() >= 0.0
        assert out[col].max() <= 1.0


def test_compute_idm_frame_missing_column_raises():
    frame = _synthetic_frame().drop(columns=["pib"])
    with pytest.raises(KeyError):
        idm_core.compute_idm_frame(frame)


def test_national_highlights_partitions_and_shares():
    tipologia = pd.Series(["orbitante", "orbitante", "polo", "semi-polo"])
    pop = pd.Series([100, 200, 700, 400])
    h = idm_core.national_highlights(tipologia, pop)
    assert h["total_municipios"] == 4
    assert h["total_populacao"] == 1400
    assert h["por_tipologia"]["orbitante"] == {"n": 2, "populacao": 300}
    # The dependent aggregate is the orbitant role.
    assert h["dependentes"]["n_municipios"] == 2
    assert h["dependentes"]["populacao"] == 300
    assert h["dependentes"]["share_municipios"] == pytest.approx(0.5)
    assert h["dependentes"]["share_populacao"] == pytest.approx(300 / 1400)


def test_national_highlights_treats_missing_population_as_zero():
    tipologia = pd.Series(["orbitante", "polo"])
    pop = pd.Series([None, 500])
    h = idm_core.national_highlights(tipologia, pop)
    assert h["total_populacao"] == 500
    assert h["por_tipologia"]["orbitante"]["populacao"] == 0


def test_validate_reports_receita_over_pib_and_shapes():
    out = idm_core.compute_idm_frame(_synthetic_frame())
    report = idm_core.validate(
        idm=out["idm"],
        populacao=out["populacao"],
        eixo_orbitacao=out["eixo_orbitacao"],
        eixo_fiscal=out["eixo_fiscal"],
        eixo_servicos=out["eixo_servicos"],
        razao_receita_pib=out["razao_receita_pib"],
    )
    assert report.n_municipios == 4
    assert report.n_receita_maior_pib == 1  # municipality 1 has receita > pib
    assert report.corr_eixos.shape == (3, 3)
    assert -1.0 <= report.spearman_idm_log_pop <= 1.0


def test_spearman_perfect_monotonic():
    a = pd.Series([1.0, 2.0, 3.0, 4.0])
    b = pd.Series([10.0, 20.0, 30.0, 40.0])
    assert idm_core.spearman_corr(a, b) == pytest.approx(1.0)
    assert idm_core.spearman_corr(a, b.iloc[::-1].reset_index(drop=True)) == pytest.approx(-1.0)


# --- added: NaN propagation, custom weights, Spearman trigger boundary --------


def test_nan_axis_propagates_to_idm():
    # A NaN in a raw axis input must propagate to that axis and to the IDM for
    # the same row, and must not corrupt the other rows. In production the
    # completeness gate (idm.run) drops such a row before compute; the pure
    # transform still propagates rather than imputing.
    frame = _synthetic_frame()
    frame.loc[1, "distancia_polo_km"] = np.nan
    out = idm_core.compute_idm_frame(frame)
    assert math.isnan(out["eixo_orbitacao"].iloc[1])
    assert math.isnan(out["idm"].iloc[1])
    # Rows without a missing input keep a finite IDM in [0, 1].
    finite = out["idm"].drop(index=1)
    assert finite.notna().all()
    assert finite.min() >= 0.0 and finite.max() <= 1.0


def test_compose_idm_custom_weights():
    # Weights other than the equal-thirds default compose as a linear blend.
    o = pd.Series([1.0, 0.0])
    f = pd.Series([0.0, 1.0])
    s = pd.Series([0.0, 0.0])
    idm = idm_core.compose_idm(o, f, s, weights=(0.6, 0.3, 0.1))
    assert idm.iloc[0] == pytest.approx(0.6)
    assert idm.iloc[1] == pytest.approx(0.3)


def _validate_stratify(idm_vals: list[float], pop_vals: list[float]) -> idm_core.ValidationReport:
    n = len(idm_vals)
    zeros = pd.Series([0.0] * n)
    return idm_core.validate(
        idm=pd.Series(idm_vals, dtype=float),
        populacao=pd.Series(pop_vals, dtype=float),
        eixo_orbitacao=zeros,
        eixo_fiscal=zeros,
        eixo_servicos=zeros,
        razao_receita_pib=zeros,
    )


def test_spearman_stratify_trigger_boundary():
    # The ranking must be stratified by porte iff |rho(IDM, log pop)| > 0.8.
    # Two datasets bracket the 0.8 threshold: one just above, one just below.
    pop = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000]
    idm_above = [0.0, 2.0, 1.0, 5.0, 3.0, 4.0, 7.0, 6.0]  # rho ~ 0.881
    idm_below = [0.0, 1.0, 2.0, 3.0, 7.0, 5.0, 6.0, 4.0]  # rho ~ 0.786

    above = _validate_stratify(idm_above, pop)
    below = _validate_stratify(idm_below, pop)

    assert abs(above.spearman_idm_log_pop) > 0.8
    assert above.stratify_by_porte is True
    assert abs(below.spearman_idm_log_pop) < 0.8
    assert below.stratify_by_porte is False
