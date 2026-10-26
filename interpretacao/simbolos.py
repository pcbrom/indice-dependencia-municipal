"""Dicionario de simbolos por municipio.

Cada valor exibivel (numero, porcentagem, distancia, populacao, nome de cidade)
vira um SIMBOLO textual entre chaves. O modelo de linguagem emite apenas o
simbolo; substituir() troca mecanicamente pelo valor canonico. Assim o valor
nunca e responsabilidade do modelo, o que elimina de uma vez alucinacao de
numero, rotulo trocado (IDM x IDHM) e formato. Os simbolos confundiveis sao
autorrotulados ({IDM} expande para "IDM 0,45"), de modo que o modelo nao
consegue escrever "IDM 0,65". Ver docs/INTERPRETACAO.md.

Puro, sem IO de rede: contexto() le as bases em memoria; as demais funcoes sao
deterministicas e testaveis.
"""
from __future__ import annotations

import re
import statistics


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def _num(x: float) -> str:
    return str(round(x, 2)).replace(".", ",")


def _populacao(pop: int) -> str:
    """Formata populacao dependente de forma legivel."""
    if pop >= 1_000_000:
        return f"{round(pop / 1_000_000, 1)} milhões".replace(".", ",")
    return f"{round(pop / 1000)} mil"


def contexto(municipios: list[dict], ligacoes: list[dict]) -> dict:
    """Precomputa indice por codigo, medianas fiscais por porte e a rede de
    dependencia (quem depende de cada polo)."""
    by_code = {m["codigo_ibge"]: m for m in municipios}
    dependentes: dict[str, list[str]] = {}
    for l in ligacoes:
        dependentes.setdefault(l["destino_ibge"], []).append(l["origem_ibge"])
    portes: dict[str, dict[str, float]] = {}
    for p in {m["porte_faixa"] for m in municipios}:
        grp = [m for m in municipios if m["porte_faixa"] == p]
        portes[p] = {
            "fpm": statistics.median(m["razao_fpm_receita"] for m in grp),
            "pib": statistics.median(m["razao_receita_pib"] for m in grp),
        }
    return {"by_code": by_code, "dependentes": dependentes, "portes": portes}


def construir_simbolos(m: dict, ctx: dict) -> dict[str, str]:
    """Mapa simbolo -> valor canonico ja formatado, para um municipio."""
    med = ctx["portes"][m["porte_faixa"]]
    perc = round(m["idm_percentil"] * 100)
    s: dict[str, str] = {
        "{NOME}": m["nome"],
        "{PORTE}": m["porte_faixa"],
        "{IDM}": f"IDM {_num(m['idm'])}",
        "{IDHM}": (f"IDHM {_num(m['idhm'])} (Censo 2010)" if m.get("idhm") is not None
                   else "sem IDHM (instalado após 2010)"),
        "{PERC}": f"{perc}%",
        "{PERCINV}": f"{100 - perc}%",
        "{FPM}": _pct(m["razao_fpm_receita"]),
        "{FPMMED}": _pct(med["fpm"]),
        "{RPIB}": _num(m["razao_receita_pib"]),
        "{RPIBMED}": _num(med["pib"]),
    }
    # O papel e decidido pela tipologia, nunca pela resolucao do codigo do polo.
    # Um orbitante pode apontar para um centro fora do universo do indice, caso
    # de Brasilia, e nesse caso o nome vem do proprio registro. Decidir pelo
    # lookup faria o orbitante ser descrito como polo sem dependentes.
    if m["tipologia"] == "orbitante":
        polo = ctx["by_code"].get(m["polo_ibge"]) if m["polo_ibge"] else None
        if polo:
            s["{POLO}"] = f"{polo['nome']} ({polo['uf']})"
        elif m.get("polo_nome"):
            uf = m.get("polo_uf")
            s["{POLO}"] = f"{m['polo_nome']} ({uf})" if uf else m["polo_nome"]
        else:
            s["{POLO}"] = "outro centro"
        s["{DIST}"] = f"{round(m['distancia_polo_km'] or 0)} km"
    else:
        deps = [d for d in ctx["dependentes"].get(m["codigo_ibge"], []) if d in ctx["by_code"]]
        n_deps = len(deps)
        s["{NORB}"] = str(n_deps)
        # Self-pluralizing count so the prose never reads "1 municipios": the noun
        # travels with the number and agrees with it.
        s["{NORBMUN}"] = f"{n_deps} município" + ("s" if n_deps != 1 else "")
        s["{POPREDE}"] = _populacao(sum(ctx["by_code"][d]["populacao_estimada"] or 0 for d in deps))
        s["{NSEMIES}"] = str(sum(1 for d in deps if not ctx["by_code"][d]["tem_ies"]))
        s["{NSEMHOSP}"] = str(sum(1 for d in deps if not ctx["by_code"][d]["tem_hospital_mac"]))
    return s


_SIMBOLO = re.compile(r"\{[A-Z]+\}")


def substituir(texto: str, simbolos: dict[str, str]) -> str:
    """Substituicao mecanica de todos os simbolos conhecidos pelo valor."""
    for sym, val in simbolos.items():
        texto = texto.replace(sym, val)
    return texto


def auditar(texto: str, simbolos: dict[str, str]) -> dict:
    """Confere a saida do modelo ANTES da substituicao.

    - desconhecidos: simbolos {X} que nao existem no dicionario (o modelo inventou);
    - digitos_vazados: digitos escritos fora de simbolo (o modelo emitiu numero literal).
    Uma saida limpa tem ambos vazios.
    """
    usados = _SIMBOLO.findall(texto)
    desconhecidos = sorted({u for u in usados if u not in simbolos})
    sem_simbolos = _SIMBOLO.sub("", texto)
    digitos_vazados = bool(re.search(r"\d", sem_simbolos))
    return {"desconhecidos": desconhecidos, "digitos_vazados": digitos_vazados,
            "n_simbolos": len(usados)}
