"""Harness de interpretacao do painel IDM.

Tres camadas somadas (ver docs/INTERPRETACAO.md):
1. NUMERO, dicionario de simbolos (simbolos.py): o modelo emite so simbolos, a
   substituicao e mecanica, entao valor, rotulo e formato nunca sao do modelo.
2. PROSA, andaime calibrado: o modelo costura ganchos ja resolvidos (traco
   central, orbita, servicos, rede, para o gestor), sem raciocinar sobre dados.
3. GATE: reprova juizo de gestao, causa, ordem a prefeitura e intensidade, mais
   a auditoria de simbolo (digito vazado ou simbolo inventado).

prep_ganchos(), gate() e ranking_template() sao puros; a chamada ao modelo vive
em gerar.py.
"""
from __future__ import annotations

import re

from simbolos import auditar

_ORDEM = re.compile(
    r"\b(deve|deveria|devem|dever[aá]|precisa|precisam|tem que|t[eê]m que|recomenda|"
    r"recomendamos|sugere-se|sugerimos|aumente|amplie|explore|invista|reduza|"
    r"necessidade de fortalecimento|precisa fortalecer)\b", re.I)
_MORAL = re.compile(r"\b(ruim|ruins|bom|boa gest|m[aá] gest|eficien|incompeten|corrup|culpa|neglig|fracass|prec[aá]ri)", re.I)
_CAUSAL = re.compile(r"\b(porque|causa|causou|causam|leva a|levou a|resulta em|resultam em|devido a|faz com que|provoca)", re.I)
_INTENS = re.compile(r"(alta|alto|elevad|significativ)\w*\s+(depend)", re.I)


def nivel_dependencia(perc: int) -> str:
    return "baixa" if perc < 33 else ("média" if perc <= 66 else "alta")


def ranking_template(perc: int) -> str:
    """Fatia ranking, deterministica (sem modelo): risco zero."""
    return (f"É mais dependente que {perc}% dos municípios do país; a leitura "
            f"primária é por porte, não por desempenho.")


def prep_ganchos(m: dict, ctx: dict) -> tuple[dict, str, int]:
    """Ganchos simbolicos por municipio: numeros e nomes ja em simbolos.

    Retorna (ganchos, nivel, perc). O gancho 'central' e o traco fiscal; os
    demais posicionam, descrevem servicos, a rede e o uso pelo gestor.
    """
    med = ctx["portes"][m["porte_faixa"]]
    perc = round(m["idm_percentil"] * 100)
    nivel = nivel_dependencia(perc)
    fpm_acima = m["razao_fpm_receita"] > med["fpm"]
    pib_abaixo = m["razao_receita_pib"] < med["pib"]

    if not fpm_acima and pib_abaixo:
        central = "orçamento compacto: FPM menos que os pares ({FPM} ante {FPMMED}), mas receita frente ao PIB enxuta ({RPIB} ante {RPIBMED})"
        uso_fiscal = "frente ao porte, a arrecadação própria ({RPIB} ante {RPIBMED}) fica aquém da dos pares, com o FPM ({FPM} ante {FPMMED}) já abaixo: a folga a examinar está na base própria"
    elif fpm_acima and pib_abaixo:
        central = "sobre-dependência de repasse: FPM acima dos pares ({FPM} ante {FPMMED}) e receita frente ao PIB menor ({RPIB} ante {RPIBMED})"
        uso_fiscal = "frente ao porte, o FPM ({FPM} ante {FPMMED}) pesa mais que nos pares e a arrecadação própria ({RPIB} ante {RPIBMED}) fica abaixo: o contraste a examinar é a exposição a repasse"
    elif not fpm_acima and not pib_abaixo:
        central = "autonomia relativa: receita frente ao PIB acompanha ou supera o porte ({RPIB} ante {RPIBMED}) e FPM abaixo dos pares ({FPM} ante {FPMMED})"
        uso_fiscal = "base fiscal já alinhada ao porte ({RPIB} ante {RPIBMED}, {FPM} ante {FPMMED}), sem distância a fechar na comparação por tamanho"
    else:
        central = "orçamento amplo com repasse alto: receita frente ao PIB supera o porte ({RPIB} ante {RPIBMED}), mas FPM também pesa mais ({FPM} ante {FPMMED})"
        uso_fiscal = "a receita própria acompanha o porte ({RPIB} ante {RPIBMED}), mas o peso do FPM ({FPM} ante {FPMMED}) é uma referência a acompanhar"

    # Services reading refined by effective access: high-complexity health is
    # qualified by an ICU (CNES leitos) and higher education by an in-person
    # course (INEP censup), so a service that is retained is described by what
    # the municipality actually accesses, not only by its presence.
    h, s = m["tem_hospital_mac"], m["tem_ies"]
    uti, presencial = m.get("uti", False), m.get("presencial", False)
    saude_ret = "saúde de alta complexidade" + (" com leitos de UTI" if uti else "")
    modalidade = (" presencial" if presencial else " a distância") if s else ""
    ensino_ret = "ensino superior" + modalidade
    if h and s:
        serv = f"retém {saude_ret} e {ensino_ret}, sendo destino de deslocamento"
    elif h and not s:
        serv = f"retém {saude_ret}, mas exporta a demanda por ensino superior"
    elif s and not h:
        serv = f"retém {ensino_ret}, mas busca saúde de alta complexidade fora"
    else:
        serv = "busca saúde de alta complexidade e ensino superior fora"

    # O papel vem da tipologia, nunca da resolucao do codigo do polo. Um
    # orbitante pode apontar para um centro fora do universo do indice, caso de
    # Brasilia, e nesse caso apenas nao se compara a oferta do destino, porque
    # ela nao foi medida. Decidir pelo lookup faria o orbitante ser descrito
    # como polo sem dependentes, afirmacao falsa.
    if m["tipologia"] == "orbitante":
        polo = ctx["by_code"].get(m["polo_ibge"]) if m["polo_ibge"] else None
        dist = m["distancia_polo_km"] or 0
        faixa = "curta" if dist < 50 else ("média" if dist <= 120 else "longa")
        orbita = "orbita {POLO} a {DIST}, órbita " + faixa
        if polo is not None:
            faltas = ([("ensino superior", polo["tem_ies"])] if not s else []) + \
                     ([("saúde de alta complexidade", polo["tem_hospital_mac"])] if not h else [])
            partes = [f"busca {sv} em {{POLO}}, a {{DIST}}, que "
                      + ("o oferece" if ok else "também não o tem, então essa demanda sobe a rede")
                      for sv, ok in faltas]
            rede = "; ".join(partes) if partes else "orbita {POLO} a {DIST}, retendo os serviços de referência"
        else:
            rede = "orbita {POLO} a {DIST}"
        uso_serv = "para planejar serviços, " + serv
    else:
        # Polo and semi-polo both aggregate, but the label must be exact: a
        # semi-polo is a semi-polo, not a polo. {NORBMUN} carries the noun with
        # the number so "1 municipio" never reads "1 municipios".
        papel = "polo" if m["tipologia"] == "polo" else "semi-polo"
        orbita = papel + ", atrai {NORBMUN}"
        rede = "sustenta {NORBMUN}, cerca de {POPREDE} habitantes; {NSEMIES} sem ensino superior, {NSEMHOSP} sem hospital de alta complexidade"
        uso_serv = "para planejar a rede, " + serv + ", sustentando cerca de {POPREDE} habitantes dependentes"

    ganchos = {
        "posicao": "dependência " + nivel + " no país: mais dependente que {PERC}, menos que {PERCINV}",
        "orbita_servicos": orbita + "; " + serv,
        "rede": rede,
        "central": central,
        "para_o_gestor": [uso_fiscal, uso_serv],
    }
    return ganchos, nivel, perc


SCHEMA = {
    "type": "object",
    "properties": {
        "como_esta": {"type": "string"},
        "problema": {"type": "string"},
        "rede": {"type": "string"},
        "para_o_gestor": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 2},
        "telas": {
            "type": "object",
            "properties": {"mapa": {"type": "string"}, "perfil": {"type": "string"}, "fiscal": {"type": "string"}},
            "required": ["mapa", "perfil", "fiscal"],
        },
    },
    "required": ["como_esta", "problema", "rede", "para_o_gestor", "telas"],
}

_EXEMPLO = {
    "GANCHOS": {
        "posicao": "dependência baixa no país: mais dependente que {PERC}, menos que {PERCINV}",
        "orbita_servicos": "polo, atrai {NORBMUN}; retém saúde de alta complexidade e ensino superior, sendo destino de deslocamento",
        "rede": "sustenta {NORBMUN}, cerca de {POPREDE} habitantes; {NSEMIES} sem ensino superior, {NSEMHOSP} sem hospital de alta complexidade",
        "central": "autonomia relativa: receita frente ao PIB acompanha ou supera o porte ({RPIB} ante {RPIBMED}) e FPM abaixo dos pares ({FPM} ante {FPMMED})",
        "para_o_gestor": ["base fiscal já alinhada ao porte ({RPIB} ante {RPIBMED}, {FPM} ante {FPMMED}), sem distância a fechar"],
    },
    "SAIDA": {
        "como_esta": "É um polo que atrai {NORBMUN} e sustenta cerca de {POPREDE} habitantes, retendo saúde de alta complexidade e ensino superior, destino de deslocamento. No país, está entre as menos dependentes, mais dependente que {PERC}. No eixo fiscal, combina receita própria acima do porte com FPM abaixo dos pares.",
        "problema": "O traço central é a autonomia relativa: a receita frente ao PIB ({RPIB}) acompanha ou supera a mediana do porte ({RPIBMED}) e o FPM ({FPM}) fica abaixo dos pares ({FPMMED}).",
        "rede": "Como polo, sustenta {NORBMUN} e cerca de {POPREDE} habitantes; {NSEMIES} deles sem ensino superior e {NSEMHOSP} sem hospital de alta complexidade.",
        "para_o_gestor": ["A base própria já acompanha o porte ({RPIB} ante {RPIBMED}), com FPM abaixo dos pares ({FPM} ante {FPMMED}), sem distância a fechar na comparação por tamanho."],
        "telas": {
            "mapa": "Polo que atrai {NORBMUN}; no país, entre os menos dependentes, à frente de {PERCINV}.",
            "perfil": "{IDM}, dependência baixa; concentra saúde de alta complexidade e ensino superior. {IDHM}.",
            "fiscal": "Receita própria acompanha o porte ({RPIB} ante {RPIBMED}) e FPM abaixo dos pares ({FPM} ante {FPMMED}).",
        },
    },
}

import json as _json

INSTRUCOES = f"""Você escreve uma LEITURA INTERPRETATIVA de um município, em português do Brasil correto e acentuado, terceira pessoa, tom neutro. Recebe GANCHOS (o padrão estrutural já identificado, com números e nomes em SÍMBOLOS entre chaves).

REGRA DO SÍMBOLO (a mais importante): para QUALQUER número, porcentagem, distância, população, nome de cidade ou de porte, use APENAS o símbolo entre chaves como aparece nos GANCHOS. NUNCA escreva um dígito nem o valor literal. Ex.: escreva "{{RPIB}}", nunca "0,19"; escreva "{{IDM}}", nunca "IDM 0,45".

Costure os GANCHOS numa leitura HIERARQUIZADA: o traço central primeiro, o resto subordinado; conecte serviço, órbita e rede numa ideia só, não enumere.

Regras invioláveis:
- Sem juízo de gestão (bom, ruim, eficiente, culpa) e sem causa (porque, leva a, resulta em, devido a).
- NÃO dê ordem nem recomendação à prefeitura. A palavra "deve" é proibida, assim como "deveria", "precisa", "tem que", "recomenda-se", "aumente", "amplie". Descreva o que os números mostram e, no máximo, o que o gestor "pode observar" ou "comparar".
- Não infle intensidade: use o nível de dependência dado.

Campos:
- problema: reescreve o gancho "central", nada mais.
- como_esta: 2 a 3 frases (posição, órbita e serviços, terminando no traço fiscal).
- rede: reescreve o gancho "rede" (de quem depende e se o polo resolve, ou o tamanho da rede que sustenta).
- para_o_gestor: 1 a 2 frases de uso, reescrevendo os ganchos "para_o_gestor".
- telas: mapa, perfil, fiscal, uma frase curta cada. O perfil usa {{IDM}} e, se houver, {{IDHM}}.

EXEMPLO (outro município, só para o estilo e o uso de símbolos):
GANCHOS: {_json.dumps(_EXEMPLO['GANCHOS'], ensure_ascii=False)}
SAÍDA: {_json.dumps(_EXEMPLO['SAIDA'], ensure_ascii=False)}

Responda SÓ o JSON, usando os símbolos."""


def prompt_usuario(ganchos: dict, simbolos: dict, nivel: str) -> str:
    return ("SÍMBOLOS disponíveis: " + _json.dumps(sorted(simbolos.keys()), ensure_ascii=False)
            + "\nGANCHOS: " + _json.dumps(ganchos, ensure_ascii=False)
            + f"\n(nível de dependência: {nivel})")


# Role inversion: the model sometimes writes an orbiting municipality as if it
# were the centre that attracts its own destination ("e um polo que atrai
# {POLO}"). Every symbol is valid, so the symbol audit cannot see it; the check
# has to be semantic. Applied only when the municipality is an orbitante.
_PAPEL_INVERTIDO = re.compile(
    r"\b(é|e) um polo\b|\bcomo polo\b|\bpolo que atrai\b|\batrai \{POLO\}",
    re.IGNORECASE,
)


def gate(simbolos: dict, out: dict, nivel: str = "", tipologia: str = "") -> list[str]:
    """Reprova a saida (ainda com simbolos) por violacao. Vazio = publicavel.

    A trava de intensidade so vale quando o nivel de dependencia e baixo ou
    medio: ela existe para barrar inflacao ("dependencia alta" onde e baixa).
    Para nivel alta, "dependencia alta" e o fato correto e nao pode reprovar.
    """
    tel = out.get("telas", {})
    campos = [out.get("como_esta", ""), out.get("problema", ""), out.get("rede", "")] \
        + out.get("para_o_gestor", []) + [tel.get(k, "") for k in ("mapa", "perfil", "fiscal")]
    txt = " ".join(campos)
    problems: list[str] = []
    if _MORAL.search(txt): problems.append("moral")
    if _CAUSAL.search(txt): problems.append("causal")
    if _ORDEM.search(txt): problems.append("ordem_prefeitura")
    if nivel != "alta" and _INTENS.search(txt): problems.append("intensidade")
    # A semi-polo is not a polo: it aggregates, but the label must match the
    # typology the panel shows, so "e um polo"/"como polo" is reproved for it too.
    if tipologia in ("orbitante", "semi-polo") and _PAPEL_INVERTIDO.search(txt):
        problems.append("papel_invertido")
    audit = auditar(txt, simbolos)
    if audit["digitos_vazados"]: problems.append("digito_vazado")
    if audit["desconhecidos"]: problems.append(f"simbolo_invalido:{audit['desconhecidos']}")
    for k in ("mapa", "perfil", "fiscal"):
        if not tel.get(k):
            problems.append(f"fatia_ausente:{k}")
    return problems


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def compor_deterministico(ganchos: dict, nivel: str) -> dict:
    """Compose the reading directly from the resolved hooks, without the model.

    The model only ever rephrases these hooks; when it cannot do so without
    inverting the role (an orbitante written as a pole) even after retries, the
    harness phrases the same facts itself. The output stays in symbol form, uses
    the role language the hooks already carry (never "e um polo" for an orbitante),
    and therefore passes the gate by construction, guaranteeing a reading for every
    municipality. Deterministic and pure; labelled in the record so the reader
    knows it was not model-written.
    """
    orbita_serv = ganchos["orbita_servicos"]
    partes = orbita_serv.split("; ", 1)
    orbita = partes[0]
    serv = partes[1] if len(partes) > 1 else orbita_serv
    como_esta = f"{_cap(ganchos['posicao'])}. {_cap(orbita_serv)}. No eixo fiscal, {ganchos['central']}."
    problema = f"O traço central é {ganchos['central']}."
    rede = f"{_cap(ganchos['rede'])}."
    para_o_gestor = [f"{_cap(x)}." for x in ganchos["para_o_gestor"] if x]
    telas = {
        "mapa": f"{_cap(orbita)}; mais dependente que {{PERC}} dos municípios.",
        "perfil": f"{{IDM}}, dependência {nivel}. {_cap(serv)}. {{IDHM}}.",
        "fiscal": f"{_cap(ganchos['central'])}.",
    }
    return {"como_esta": como_esta, "problema": problema, "rede": rede,
            "para_o_gestor": para_o_gestor, "telas": telas}
