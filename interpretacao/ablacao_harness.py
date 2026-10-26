"""Ablacao do HARNESS: com mediacao contra sem mediacao, pareado.

A pergunta: e a mediacao deterministica que sustenta a qualidade da leitura, ou o
modelo daria conta sozinho?

Dois bracos, os MESMOS municipios, mesmo modelo, mesmo schema, temperatura 0.
Unica diferenca: o modelo recebe os fatos ja resolvidos, ou tem de resolve-los.

  A  COM harness (producao): recebe ganchos com a direcao ja resolvida, o nivel ja
     calculado e os servicos por extenso, e emite simbolos. O numero fica exato
     por construcao, mas DIRECAO e INTENSIDADE continuam sendo palavra do modelo,
     e por isso ele pode errar: a comparacao nao e tautologica.
  C  SEM harness: recebe o registro cru (percentil, razoes, medianas do porte,
     flags com sigla) e precisa raciocinar sozinho, calcular a direcao, inferir o
     nivel e expandir a sigla.

Desfecho unico e comparavel: DEFEITO FACTUAL no texto publicado (no braco A, apos
a substituicao dos simbolos), pontuado de forma deterministica contra o registro:

  numero_nao_aterrado     numero que nao consta dos valores canonicos do registro
  direcao_invertida       "mais dependente que X%" com X diferente do percentil
  intensidade_incoerente  adjetivo de intensidade acima (ou abaixo) do nivel real
  rotulo_trocado          IDM com o valor do IDHM, ou vice-versa

Primeira passada, sem re-tentativa: mede o que o MODELO produz, nao o que o
harness conserta. McNemar exato sobre os pares discordantes.

Uso (vLLM da producao no ar):
    python interpretacao/ablacao_harness.py --n 120 --seed 7 --concurrency 48 \
        --base-url http://localhost:8000/v1 --model google/gemma-4-E2B-it
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from math import comb
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import INSTRUCOES, SCHEMA, _INTENS, prep_ganchos, prompt_usuario
from simbolos import construir_simbolos, contexto, substituir
from gerar import carregar_acesso

NUM = re.compile(r"\d+(?:[.,]\d+)?")

# Braco C: sem mediacao. O registro chega cru e o raciocinio e do modelo.
INSTRUCOES_SEM_HARNESS = """Você escreve uma LEITURA INTERPRETATIVA de um município, em português do Brasil correto e acentuado, terceira pessoa, tom neutro. Recebe o REGISTRO BRUTO do município e precisa interpretá-lo você mesmo.

A partir do registro, você deve:
- situar a dependência do município no país a partir do percentil do IDM (idm_percentil, de 0 a 1): diga de quantos por cento dos municípios ele é MAIS dependente e de quantos é MENOS;
- qualificar o nível de dependência (baixa, média ou alta) a partir desse percentil;
- comparar as razões fiscais do município contra a MEDIANA DO SEU PORTE (fornecida no registro), dizendo a direção correta;
- descrever os serviços presentes ou ausentes, expandindo corretamente as siglas do registro;
- descrever a órbita (o polo de destino e a distância) ou, se for polo, a rede que sustenta.

Regras invioláveis:
- Sem juízo de gestão (bom, ruim, eficiente, culpa) e sem causa (porque, leva a, resulta em, devido a).
- NÃO dê ordem nem recomendação à prefeitura. A palavra "deve" é proibida, assim como "deveria", "precisa", "tem que", "recomenda-se", "aumente", "amplie".
- Não infle a intensidade além do que o percentil sustenta.

Campos:
- problema: o traço fiscal central, uma frase.
- como_esta: 2 a 3 frases (posição, órbita e serviços, terminando no traço fiscal).
- rede: de quem o município depende e se o polo resolve, ou o tamanho da rede que sustenta.
- para_o_gestor: 1 a 2 frases de uso.
- telas: mapa, perfil, fiscal, uma frase curta cada. O perfil usa o IDM e, se houver, o IDHM.

Responda SÓ o JSON."""


def registro_cru(m: dict, ctx: dict) -> dict:
    """O registro sem mediacao: campos crus, siglas nao expandidas, nada resolvido."""
    med = ctx["portes"][m["porte_faixa"]]
    r = {
        "nome": m["nome"],
        "porte_faixa": m["porte_faixa"],
        "idm": m["idm"],
        "idm_percentil": m["idm_percentil"],
        "razao_fpm_receita": m["razao_fpm_receita"],
        "mediana_fpm_receita_do_porte": med["fpm"],
        "razao_receita_pib": m["razao_receita_pib"],
        "mediana_receita_pib_do_porte": med["pib"],
        "tipologia": m["tipologia"],
        "tem_hospital_mac": m["tem_hospital_mac"],
        "tem_ies": m["tem_ies"],
        "idhm": m.get("idhm"),
    }
    if m["tipologia"] == "orbitante" and ctx["by_code"].get(m.get("polo_ibge")):
        polo = ctx["by_code"][m["polo_ibge"]]
        r["polo_destino"] = f"{polo['nome']} ({polo['uf']})"
        r["distancia_polo_km"] = round(m.get("distancia_polo_km") or 0)
    else:
        r["municipios_que_polariza"] = len(ctx["dependentes"].get(m["codigo_ibge"], []))
    return r


def texto_de(out: dict) -> str:
    tel = out.get("telas", {}) or {}
    campos = [out.get("como_esta", ""), out.get("problema", ""), out.get("rede", "")] \
        + (out.get("para_o_gestor") or []) \
        + [tel.get(k, "") for k in ("mapa", "perfil", "fiscal")]
    return " ".join(c for c in campos if isinstance(c, str))


def chamar(client, model, sistema, usuario) -> dict:
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": sistema}, {"role": "user", "content": usuario}],
        response_format={"type": "json_schema",
                         "json_schema": {"name": "leitura", "schema": SCHEMA, "strict": True}},
        temperature=0,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )
    return json.loads(resp.choices[0].message.content)


def valores_aterrados(m: dict, ctx: dict, simbolos: dict) -> set[float]:
    """Todo valor NUMERICO derivavel do registro, em qualquer forma razoavel.

    O braco SEM harness recebe os campos crus (percentil 0,6852; razao 0,21), entao
    escrever "68,52" e eco FIEL do dado, nao alucinacao. Aterrar contra os valores
    crus E os formatados evita punir arredondamento e formatacao, que nao sao o
    defeito que se quer medir.
    """
    med = ctx["portes"][m["porte_faixa"]]
    vals: set[float] = set()

    def add(x):
        if x is None:
            return
        try:
            v = float(x)
        except (TypeError, ValueError):
            return
        for c in (v, v * 100, 100 - v * 100, 100 - v):
            vals.add(c)
            vals.add(round(c, 2))
            vals.add(float(round(c)))

    add(m.get("idm")); add(m.get("idhm")); add(m.get("idm_percentil"))
    add(m.get("razao_fpm_receita")); add(med.get("fpm"))
    add(m.get("razao_receita_pib")); add(med.get("pib"))
    add(m.get("distancia_polo_km"))
    add(len(ctx["dependentes"].get(m["codigo_ibge"], [])))
    add(m.get("populacao_estimada"))
    for n in NUM.findall(str(m.get("porte_faixa", ""))):
        add(n.replace(".", "").replace(",", "."))
    # Os VALORES CANONICOS do dicionario de simbolos sao aterrados por definicao:
    # e deles que o braco COM harness monta o texto publicado (populacao formatada,
    # contagens da rede, etc.). Sem isso o braco A acusa falso positivo.
    for v in simbolos.values():
        for n in NUM.findall(str(v)):
            add(n.replace(".", "").replace(",", "."))
    return vals


def _f(tok: str) -> float | None:
    try:
        return float(tok.replace(".", "").replace(",", ".")) if "," in tok else float(tok)
    except ValueError:
        return None


def _aterrado(x: float, vals: set[float]) -> bool:
    return any(abs(x - v) <= max(0.6, 0.02 * abs(v)) for v in vals)


# Classe qualitativa de dependencia afirmada no texto. O harness ENTREGA o nivel
# pronto; sem ele o modelo tem de inferi-lo do percentil, e e onde ele cai.
_NIVEL_DITO = [
    ("alta",  re.compile(r"depend[eê]ncia\s+(alta|elevada|forte|significativa)|"
                         r"(alta|elevada|forte)\w*\s+depend", re.I)),
    ("média", re.compile(r"depend[eê]ncia\s+(m[eé]dia|intermedi[aá]ria|moderada)|"
                         r"(m[eé]dia|intermedi[aá]ria|moderada)\w*\s+depend|"
                         r"posi[cç][aã]o\s+intermedi[aá]ria", re.I)),
    ("baixa", re.compile(r"depend[eê]ncia\s+(baixa|reduzida|pequena)|"
                         r"(baixa|reduzida)\w*\s+depend", re.I)),
]


def defeito_factual(texto: str, simbolos: dict, perc: int, nivel: str,
                    vals: set[float]) -> list[str]:
    """Desfecho unico dos dois bracos, sobre o texto publicado."""
    problemas: list[str] = []

    # 1. numero nao aterrado: nao corresponde a NENHUM valor derivavel do registro
    soltos = []
    for tok in NUM.findall(texto):
        x = _f(tok)
        if x is not None and not _aterrado(x, vals):
            soltos.append(tok)
    if soltos:
        problemas.append(f"numero_nao_aterrado:{sorted(set(soltos))[:4]}")

    # 2. direcao invertida na relacao do percentil
    for x in re.findall(r"mais dependente que\s*(\d+)\s*%", texto, re.I):
        if abs(int(x) - perc) > 1:
            problemas.append(f"direcao_invertida:mais_que={x}!={perc}")
    for y in re.findall(r"menos dependente que\s*(\d+)\s*%", texto, re.I):
        if abs(int(y) - (100 - perc)) > 1:
            problemas.append(f"direcao_invertida:menos_que={y}!={100 - perc}")

    # 3. NIVEL ERRADO: o texto afirma uma classe de dependencia que contradiz o
    #    percentil. E o erro que o harness previne entregando o nivel calculado.
    ditos = {cls for cls, rx in _NIVEL_DITO if rx.search(texto)}
    if ditos and nivel not in ditos:
        problemas.append(f"nivel_incorreto:disse={sorted(ditos)}!=real={nivel}")

    return problemas


def mcnemar_exato(b: int, c: int) -> float:
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    return min(1.0, 2 * sum(comb(n, i) for i in range(0, k + 1)) / (2 ** n))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000/v1")
    ap.add_argument("--model", default="google/gemma-4-E2B-it")
    ap.add_argument("--api-key", default="local")
    ap.add_argument("--data", type=Path, default=Path("app/public/data"))
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--concurrency", type=int, default=48)
    ap.add_argument("--out", type=Path, default=Path("interpretacao/ablacao_harness.json"))
    args = ap.parse_args()

    from openai import OpenAI
    client = OpenAI(base_url=args.base_url, api_key=args.api_key, timeout=180)

    municipios = json.loads((args.data / "municipios.json").read_text())
    ligacoes = json.loads((args.data / "ligacoes.json").read_text())
    acesso = carregar_acesso(args.data)
    for m in municipios:
        c = m["codigo_ibge"]
        m["uti"] = c in acesso["uti"]
        m["presencial"] = c in acesso["presencial"]
    ctx = contexto(municipios, ligacoes)

    amostra = random.Random(args.seed).sample(municipios, args.n)
    print(f"ablacao do harness: n={args.n}, seed={args.seed}, modelo={args.model}, temp=0")

    def um(m: dict) -> dict:
        simbolos = construir_simbolos(m, ctx)
        ganchos, nivel, perc = prep_ganchos(m, ctx)
        vals = valores_aterrados(m, ctx, simbolos)
        r = {"codigo_ibge": m["codigo_ibge"], "nivel": nivel, "perc": perc}

        try:  # A: COM harness (producao); pontua o texto APOS a substituicao
            out = chamar(client, args.model, INSTRUCOES, prompt_usuario(ganchos, simbolos, nivel))
            txt = substituir(texto_de(out), simbolos)
            p = defeito_factual(txt, simbolos, perc, nivel, vals)
            r["A_defeito"], r["A_problemas"], r["A_texto"] = bool(p), p, txt
        except Exception as e:
            r["A_defeito"], r["A_problemas"] = None, [f"erro:{e.__class__.__name__}"]

        try:  # C: SEM harness
            usuario = "REGISTRO BRUTO: " + json.dumps(registro_cru(m, ctx), ensure_ascii=False)
            out = chamar(client, args.model, INSTRUCOES_SEM_HARNESS, usuario)
            txt = texto_de(out)
            p = defeito_factual(txt, simbolos, perc, nivel, vals)
            r["C_defeito"], r["C_problemas"], r["C_texto"] = bool(p), p, txt
        except Exception as e:
            r["C_defeito"], r["C_problemas"] = None, [f"erro:{e.__class__.__name__}"]
        return r

    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        linhas = list(ex.map(um, amostra))

    val = [x for x in linhas if x.get("A_defeito") is not None and x.get("C_defeito") is not None]
    n = len(val)
    dA = sum(1 for x in val if x["A_defeito"])
    dC = sum(1 for x in val if x["C_defeito"])
    b = sum(1 for x in val if x["C_defeito"] and not x["A_defeito"])   # so o SEM harness falha
    c = sum(1 for x in val if x["A_defeito"] and not x["C_defeito"])   # so o COM harness falha
    taxo = {k: dict(Counter(p.split(":")[0] for x in val for p in x[f"{k}_problemas"])) for k in "AC"}

    resumo = {
        "n_pareado": n, "modelo": args.model, "temperatura": 0, "seed": args.seed,
        "primeira_passada_sem_retentativa": True,
        "A_com_harness": {"defeituosos": dA, "taxa": round(dA / n, 4) if n else None},
        "C_sem_harness": {"defeituosos": dC, "taxa": round(dC / n, 4) if n else None},
        "discordantes_so_sem_harness": b, "discordantes_so_com_harness": c,
        "mcnemar_p_exato": mcnemar_exato(b, c),
        "taxonomia": taxo,
        "legenda": {"A": "COM harness (producao)", "C": "SEM harness (o modelo raciocina sozinho)"},
    }
    print(json.dumps(resumo, indent=2, ensure_ascii=False))
    args.out.write_text(json.dumps({"resumo": resumo, "linhas": linhas}, indent=1, ensure_ascii=False),
                        encoding="utf-8")
    print("saida:", args.out)


if __name__ == "__main__":
    main()
