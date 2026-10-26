"""Constroi os artefatos da analise Brasil em Cenarios:

- cenarios.json: custo da maquina publica por municipio (Legislativa,
  Administracao), lido da extracao da despesa por funcao em data/raw. Populacao,
  FPM e nome ja vivem em municipios.json; aqui so entra o que falta ao cliente.
- analise_agregacao.json: analise estrutural exaustiva da agregacao municipal.
  A unidade e a regiao funcional do REGIC (um polo ou semipolo ancora mais os
  orbitantes que dependem dele, campo polo_ibge), nao a adjacencia arbitraria.
  Para cada regiao funcional: custo da maquina, FPM hoje contra FPM se fundida
  na ancora, e a checagem de estrutura (a ancora tem hospital e faculdade). O
  agregado sobe por UF e por macrorregiao. Agrupar orbitantes na ancora preserva
  a estrutura de servico, o polo permanece como sede; ver docs/DECISAO_CENARIOS.md.

Os numeros da maquina sao medidos (Siconfi DCA Anexo I-E, 2024). A faixa
especulativa do consorcio e calculada no cliente.

Uso:
    pipeline/.venv/bin/python pipeline/construir_cenarios.py \
        --despesa data/raw/finbra_despesa_funcao_2024_ext2026-07-06.csv
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.ops import unary_union

# FPM coefficient bands, mirror of app/src/lib/fpm.ts.
FAIXAS_FPM: list[tuple[float, float]] = [
    (10188, 0.6), (13584, 0.8), (16980, 1.0), (23772, 1.2), (30564, 1.4),
    (37356, 1.6), (44148, 1.8), (50940, 2.0), (61128, 2.2), (71316, 2.4),
    (81504, 2.6), (91692, 2.8), (101880, 3.0), (115464, 3.2), (129048, 3.4),
    (142632, 3.6), (156216, 3.8), (float("inf"), 4.0),
]

# Five official IBGE macro-regions, by state abbreviation, so the ready-made
# scenarios are geographically balanced instead of narrative-driven.
REGIAO = {
    "RO": "Norte", "AC": "Norte", "AM": "Norte", "RR": "Norte", "PA": "Norte",
    "AP": "Norte", "TO": "Norte",
    "MA": "Nordeste", "PI": "Nordeste", "CE": "Nordeste", "RN": "Nordeste",
    "PB": "Nordeste", "PE": "Nordeste", "AL": "Nordeste", "SE": "Nordeste",
    "BA": "Nordeste",
    "MG": "Sudeste", "ES": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
    "PR": "Sul", "SC": "Sul", "RS": "Sul",
    "MS": "Centro-Oeste", "MT": "Centro-Oeste", "GO": "Centro-Oeste", "DF": "Centro-Oeste",
}

def coeficiente_fpm(pop: float) -> float:
    for limite, coef in FAIXAS_FPM:
        if pop <= limite:
            return coef
    return 4.0


def ibge7(v: str) -> str:
    return str(v).strip()[:7]


# Meaningful dependency drop, mirror of LIMIAR_QUEDA_IDM in the app.
LIMIAR_QUEDA_IDM = 0.05

# Tier promotion (semipolo -> polo) of the merged unit. The REGIC tier is not a
# population cutoff, so this is a transparent heuristic, not the REGIC
# classification: the merged unit ascends one tier only if it gains both the
# scale (combined population above this proxy) and the full service structure
# (hospital and higher education). Labelled as heuristic in the app.
LIMIAR_POP_POLO = 100000
TIER_RANK = {"orbitante": 0, "semi-polo": 1, "polo": 2}
TIER_NOME = {0: "orbitante", 1: "semi-polo", 2: "polo"}


def tipologia_fundida(ancora_tip: str, pop_total: float, uti: bool, presencial: bool) -> str:
    """Tier of the merged unit: the anchor's, promoted one step when it reaches
    both the population scale and effective access (UTI and in-person higher
    education) at the next level."""
    rank = TIER_RANK.get(ancora_tip, 1)
    if rank < 2 and pop_total >= LIMIAR_POP_POLO and uti and presencial:
        rank += 1
    return TIER_NOME[rank]


def veredito_classe(estrutura_nivel: str, queda_idm: float) -> str:
    """Technical verdict on the merge, by rule over structure and dependency
    only (mirror of vereditoDe in app/src/routes/cenarios.tsx)."""
    if estrutura_nivel == "fraca":
        return "desfavoravel"
    if estrutura_nivel == "preservada" and queda_idm >= LIMIAR_QUEDA_IDM:
        return "favoravel"
    return "parcial"


def nivel_estrutura(
    uti: bool, presencial: bool, agencia: bool, hospital: bool, ies: bool, banco: bool
) -> str:
    """Service structure of a functional region, read from the effective access
    at its anchor, not the mere presence of a facility: consolidated when the
    seat has UTI, in-person higher education and a bank branch; weak when it has
    no facility at all; partial in between (a hospital without UTI, an IES only
    of distance learning, a correspondent without a branch)."""
    if uti and presencial and agencia:
        return "preservada"
    if not (hospital or ies or banco):
        return "fraca"
    return "parcial"


def analisar_regiao_funcional(membros: list[str], m: dict, maquina: dict) -> dict:
    """Metrics for one functional region merged into its anchor: measured machine
    cost today, FPM today against FPM if it became a single municipality (by the
    coefficient of the summed population), and the council saved. The per-point
    FPM value is estimated from the region's own FPM, so the merged figure comes
    from the data, not a constant."""
    pop_total = sum(m[c]["pop"] for c in membros)
    fpm_hoje = sum(m[c]["fpm"] for c in membros)
    coef_somado = sum(coeficiente_fpm(m[c]["pop"]) for c in membros)
    coef_fundido = coeficiente_fpm(pop_total)
    por_ponto = fpm_hoje / coef_somado if coef_somado else 0.0
    fpm_fundido = por_ponto * coef_fundido
    perda = fpm_hoje - fpm_fundido
    # Machine cost per member, aligned (legis[i] and admin[i] are the same city).
    com_maquina = [c for c in membros if c in maquina]
    legis = [maquina[c]["legislativa"] for c in com_maquina]
    admin = [maquina[c]["administracao"] for c in com_maquina]
    legis_total = sum(legis)
    admin_total = sum(admin)
    # The seat kept on merger is taken as the member with the largest chamber (a
    # proxy for the anchor). Its chamber and administration persist; the others'
    # are absorbed. camara_suprimida is the deterministic floor of the economy;
    # admin_absorvida is the administration of the extinct municipalities. The
    # ceiling adds it, with the caveat (extrair_despesa_funcao.py) that the
    # Administracao function includes permanent activities, so the real economy
    # sits below the ceiling.
    i_sede = legis.index(max(legis)) if legis else -1
    legis_sede = legis[i_sede] if i_sede >= 0 else 0.0
    admin_sede = admin[i_sede] if i_sede >= 0 else 0.0
    camara_suprimida = max(0.0, legis_total - legis_sede)
    admin_absorvida = max(0.0, admin_total - admin_sede)
    economia_piso = camara_suprimida
    economia_teto = camara_suprimida + admin_absorvida
    return {
        "populacao": pop_total,
        "maquina": round(legis_total + admin_total, 2),
        "legislativa": round(legis_total, 2),
        "administracao": round(admin_total, 2),
        "admin_absorvida": round(admin_absorvida, 2),
        "fpm_hoje": round(fpm_hoje, 2),
        "coef_somado": round(coef_somado, 1),
        "coef_fundido": round(coef_fundido, 1),
        "fpm_fundido": round(fpm_fundido, 2),
        "perda": round(perda, 2),
        "frac_perdida": round(perda / fpm_hoje, 4) if fpm_hoje else 0.0,
        "camara_suprimida": round(camara_suprimida, 2),
        "economia_piso": round(economia_piso, 2),
        "economia_teto": round(economia_teto, 2),
    }


def construir_analise(munis: list[dict], maquina: dict, acesso: dict) -> dict:
    """Exhaustive structural analysis of municipal aggregation. The unit is the
    REGIC functional region: a polo/semipolo anchor plus the orbitantes that
    depend on it (polo_ibge). The structure of the seat is read from effective
    access (UTI, in-person higher education, bank branch), not mere presence, so
    a seat with a hospital but no UTI counts as partial. Aggregated by UF and by
    macro-region."""
    m: dict[str, dict] = {}
    for x in munis:
        c = ibge7(x["codigo_ibge"])
        ac = acesso.get(c, {})
        m[c] = {
            "nome": x["nome"], "uf": x["uf"],
            "pop": x.get("populacao_estimada") or x["populacao"],
            "fpm": x["fpm"], "tipologia": x["tipologia"], "idm": x["idm"],
            "hospital": bool(x["tem_hospital_mac"]), "ies": bool(x["tem_ies"]),
            "uti": bool(ac.get("uti")), "presencial": bool(ac.get("presencial")),
            "agencia": bool(ac.get("agencia")),
            "banco": bool(ac.get("agencia") or ac.get("correspondente")),
        }

    # Functional regions form a PARTITION of the universe: every municipality
    # belongs to exactly one region. This is a requirement of the scenario, not a
    # preference; a municipality cannot be merged into two different anchors at
    # once. Two rules make the partition:
    #
    #   1. A municipality that is itself an anchor (some other municipality
    #      orbits it) stays in its OWN region, even when it orbits a higher-tier
    #      centre. In the REGIC hierarchy a polo orbits a bigger polo; letting it
    #      also be absorbed elsewhere would double count it and make the merge
    #      scenario contradictory.
    #   2. A municipality that is nobody's anchor joins the region of its polo
    #      when that polo is an anchor; otherwise it forms a region of its own.
    #      Singletons keep the accounting complete: the merge is a no-op for them
    #      and the summed population must equal the population of the universe.
    ancoras = {
        ibge7(x["polo_ibge"])
        for x in munis
        if x.get("polo_ibge") and ibge7(x["polo_ibge"]) in m
    }
    membros_por_regiao: dict[str, list[str]] = defaultdict(list)
    for x in munis:
        c = ibge7(x["codigo_ibge"])
        if c not in m:
            continue
        p = x.get("polo_ibge")
        p = ibge7(p) if p else None
        if c in ancoras:
            destino = c
        elif p and p in ancoras:
            destino = p
        else:
            destino = c
        membros_por_regiao[destino].append(c)

    regioes_func: list[dict] = []
    for ancora, membros in membros_por_regiao.items():
        # The anchor leads its own member list, so metrics that read the seat
        # (structure, simulated IDM) always look at the right municipality.
        membros = [ancora, *[c for c in membros if c != ancora]]
        met = analisar_regiao_funcional(membros, m, maquina)
        a = m[ancora]
        pop_total = sum(m[c]["pop"] for c in membros)
        # IDM today is the population-weighted mean of the members (orbitantes
        # dependent, high IDM). The simulated IDM is the anchor's: merged into
        # the service center, the region takes the anchor's low-dependency
        # profile, so the drop measures the dependency the aggregation resolves.
        idm_atual = (
            sum(m[c]["pop"] * m[c]["idm"] for c in membros) / pop_total if pop_total else 0.0
        )
        idm_simulado = a["idm"]
        regioes_func.append({
            "id": ancora,
            "ancora": ancora,
            "ancora_nome": a["nome"],
            "ancora_tipologia": a["tipologia"],
            "uf": a["uf"],
            "regiao": REGIAO.get(a["uf"], "?"),
            "n": len(membros),
            "estrutura": {
                "hospital": a["hospital"], "ies": a["ies"],
                "uti": a["uti"], "presencial": a["presencial"], "agencia": a["agencia"],
                "nivel": nivel_estrutura(
                    a["uti"], a["presencial"], a["agencia"], a["hospital"], a["ies"], a["banco"]
                ),
            },
            "idm_atual": round(idm_atual, 4),
            "idm_simulado": round(idm_simulado, 4),
            "tipologia_fundida": tipologia_fundida(
                a["tipologia"], pop_total, a["uti"], a["presencial"]
            ),
            "membros": membros,
            **met,
        })

    # Aggregate by UF, then roll UFs up into their macro-region. The FPM total is
    # what would change hands, not a loss: the pool is fixed, so summed across
    # regions it is redistribution inside the state, not a saving for the Union.
    def resumo(rfs: list[dict]) -> dict:
        # Structure is only meaningful where a merge actually happens: a region
        # of one municipality has no seat to concentrate service into, so the
        # distribution is computed over the aggregating regions alone.
        agreg = [r for r in rfs if r["n"] > 1]
        n_estrut = sum(1 for r in agreg if r["estrutura"]["nivel"] == "preservada")
        pop = sum(r["populacao"] for r in rfs) or 1
        # n_regioes counts every cell of the partition; n_regioes_agregadoras
        # counts only the cells where the merge does something (more than one
        # municipality). n_municipios is a true headcount, never a sum of
        # memberships: the partition guarantees no municipality is counted twice.
        return {
            "n_regioes": len(rfs),
            "n_regioes_agregadoras": sum(1 for r in rfs if r["n"] > 1),
            "n_isolados": sum(1 for r in rfs if r["n"] == 1),
            "n_municipios": sum(r["n"] for r in rfs),
            "n_orbitantes": sum(r["n"] - 1 for r in rfs),
            "maquina": round(sum(r["maquina"] for r in rfs), 2),
            "fpm_hoje": round(sum(r["fpm_hoje"] for r in rfs), 2),
            "fpm_redistribuido": round(sum(r["perda"] for r in rfs), 2),
            "camara_suprimida": round(sum(r["camara_suprimida"] for r in rfs), 2),
            "admin_absorvida": round(sum(r["admin_absorvida"] for r in rfs), 2),
            # Economy of the merge as a measured interval: the floor is the
            # suppressed chambers (deterministic); the ceiling adds the absorbed
            # administration (upper bound, since part of Administracao is permanent).
            "economia_piso": round(sum(r["economia_piso"] for r in rfs), 2),
            "economia_teto": round(sum(r["economia_teto"] for r in rfs), 2),
            "pct_estrutura": round(n_estrut / len(agreg), 4) if agreg else 0.0,
            "idm_atual": round(sum(r["populacao"] * r["idm_atual"] for r in rfs) / pop, 4),
            "idm_simulado": round(sum(r["populacao"] * r["idm_simulado"] for r in rfs) / pop, 4),
            # Structural reading distribution: whether the seat of each region is
            # a full service center (hospital and higher education), partial, or
            # weak. Describes structure, never qualifies a merger.
            "estrutura_dist": {
                "preservada": sum(1 for r in agreg if r["estrutura"]["nivel"] == "preservada"),
                "parcial": sum(1 for r in agreg if r["estrutura"]["nivel"] == "parcial"),
                "fraca": sum(1 for r in agreg if r["estrutura"]["nivel"] == "fraca"),
            },
        }

    por_uf: dict[str, list[dict]] = defaultdict(list)
    for r in regioes_func:
        por_uf[r["uf"]].append(r)

    regioes: dict[str, dict] = {}
    for uf, rfs in por_uf.items():
        reg = REGIAO.get(uf, "?")
        rfs.sort(key=lambda r: (-r["n"], -r["perda"]))
        regioes.setdefault(reg, {"ufs": {}})
        regioes[reg]["ufs"][uf] = {"resumo": resumo(rfs), "regioes": rfs}
    for bloco in regioes.values():
        todas = [r for uf in bloco["ufs"].values() for r in uf["regioes"]]
        bloco["resumo"] = resumo(todas)

    return {
        "fonte": "REGIC 2018 (IBGE) e Siconfi DCA Anexo I-E 2024 (Tesouro)",
        "unidade": "regiao funcional (ancora mais os municipios que orbitam nela); "
                   "particao do universo, cada municipio em exatamente uma regiao",
        "n_regioes_funcionais": len(regioes_func),
        "n_regioes_agregadoras": sum(1 for r in regioes_func if r["n"] > 1),
        "nacional": resumo(regioes_func),
        "regioes": regioes,
    }


def construir_contornos(analise: dict, munis: list[dict], malha: Path) -> dict:
    """Dissolved outer boundary of each selectable scope, so the map can draw a
    clean single contour (not per-municipality borders). One feature per
    functional region (tipo=funcional, id=ancora), per UF (tipo=uf) and per
    macro-region (tipo=regiao). Geometry simplified to keep the artifact light."""
    g = gpd.read_file(malha)
    g["codigo_ibge"] = g["codigo_ibge"].map(ibge7)
    geom_por = dict(zip(g["codigo_ibge"], g.geometry, strict=False))
    uf_de = {ibge7(m["codigo_ibge"]): m["uf"] for m in munis}

    linhas = []
    for reg in analise["regioes"].values():
        for uf in reg["ufs"].values():
            for rf in uf["regioes"]:
                geoms = [geom_por[c] for c in rf["membros"] if c in geom_por]
                if geoms:
                    linhas.append(
                        {"tipo": "funcional", "id": rf["id"], "geometry": unary_union(geoms)}
                    )
    func_gdf = gpd.GeoDataFrame(linhas, geometry="geometry", crs=g.crs)

    # Restrict the mesh to the panel universe before dissolving: municipalities
    # outside M have no UF here and would otherwise collapse into an unlabeled
    # bucket, publishing a contour for "excluded municipalities".
    g["uf"] = g["codigo_ibge"].map(uf_de)
    g = g[g["uf"].notna()].copy()
    g["regiao"] = g["uf"].map(REGIAO)
    uf_gdf = g.dissolve(by="uf").reset_index()[["uf", "geometry"]]
    uf_gdf = uf_gdf.rename(columns={"uf": "id"})
    uf_gdf["tipo"] = "uf"
    reg_gdf = g.dissolve(by="regiao").reset_index()[["regiao", "geometry"]]
    reg_gdf = reg_gdf.rename(columns={"regiao": "id"})
    reg_gdf["tipo"] = "regiao"

    todos = pd.concat([
        func_gdf[["tipo", "id", "geometry"]],
        gpd.GeoDataFrame(uf_gdf[["tipo", "id", "geometry"]], geometry="geometry", crs=g.crs),
        gpd.GeoDataFrame(reg_gdf[["tipo", "id", "geometry"]], geometry="geometry", crs=g.crs),
    ], ignore_index=True)
    todos = gpd.GeoDataFrame(todos, geometry="geometry", crs=g.crs)
    todos["geometry"] = todos.geometry.simplify(0.008, preserve_topology=True)
    return json.loads(todos.to_json())


def carregar_maquina(despesa: Path) -> dict[str, dict]:
    """Read the per-municipality machine cost from the expense-by-function CSV
    (semicolon, Brazilian decimals already normalized to dot on write)."""
    out: dict[str, dict] = {}
    with despesa.open() as f:
        for row in csv.DictReader(f, delimiter=";"):
            c = ibge7(row["codigo_ibge"])
            out[c] = {
                "legislativa": round(float(row["legislativa"]), 2),
                "administracao": round(float(row["administracao"]), 2),
            }
    return out


def carregar_acesso(data: Path) -> dict[str, dict]:
    """Merge the effective-access layer (health, education, banking) by
    codigo_ibge: UTI, in-person higher education, and a bank branch. Files are
    the per-municipality artifacts produced by the extrair_acesso_* scripts;
    missing files degrade gracefully (the flags default to false)."""
    out: dict[str, dict] = defaultdict(dict)
    fontes = {
        "acesso_saude.json": lambda r: {"uti": bool(r.get("tem_uti"))},
        "acesso_educacao.json": lambda r: {"presencial": bool(r.get("ies_presencial"))},
        "acesso_bancario.json": lambda r: {
            "agencia": bool(r.get("tem_agencia")),
            "correspondente": bool(r.get("tem_correspondente")),
        },
    }
    for arq, extrair in fontes.items():
        caminho = data / arq
        if not caminho.exists():
            continue
        for r in json.loads(caminho.read_text()).get("municipios", []):
            out[ibge7(r["codigo_ibge"])].update(extrair(r))
    return dict(out)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Constroi cenarios.json e analise_agregacao.json.")
    ap.add_argument("--data", type=Path, default=Path("app/public/data"))
    ap.add_argument("--municipios", type=Path, default=Path("app/public/data/municipios.json"))
    ap.add_argument("--malha", type=Path, default=Path("app/public/data/malha.geojson"))
    ap.add_argument("--despesa", type=Path,
                    default=Path("data/raw/finbra_despesa_funcao_2024_ext2026-07-06.csv"))
    args = ap.parse_args()

    munis = json.loads(args.municipios.read_text())
    maquina = carregar_maquina(args.despesa)

    registros = []
    faltando = 0
    for m in munis:
        c = ibge7(m["codigo_ibge"])
        mq = maquina.get(c)
        if mq is None:
            faltando += 1
            continue
        registros.append({"codigo_ibge": c, "legislativa": mq["legislativa"],
                          "administracao": mq["administracao"]})
    (args.data / "cenarios.json").write_text(json.dumps(
        {"fonte": "Siconfi DCA Anexo I-E (Tesouro), 2024, Despesas Empenhadas",
         "n": len(registros), "municipios": registros},
        ensure_ascii=False, separators=(",", ":")))
    print(f"cenarios.json: {len(registros)} municipios com maquina, {faltando} sem dado")

    acesso = carregar_acesso(args.data)
    analise = construir_analise(munis, maquina, acesso)
    (args.data / "analise_agregacao.json").write_text(
        json.dumps(analise, ensure_ascii=False, separators=(",", ":")))
    n_estrut = sum(
        1 for reg in analise["regioes"].values() for uf in reg["ufs"].values()
        for r in uf["regioes"] if r["estrutura"]["nivel"] == "preservada"
    )
    print(f"analise_agregacao.json: {analise['n_regioes_funcionais']} regioes funcionais, "
          f"{n_estrut} com estrutura preservada")

    contornos = construir_contornos(analise, munis, args.malha)
    (args.data / "contornos.geojson").write_text(
        json.dumps(contornos, separators=(",", ":")))
    print(f"contornos.geojson: {len(contornos['features'])} contornos")


if __name__ == "__main__":
    main()
