"""Gera interpretacoes.json: leitura por municipio via Gemma 4 E2B (endpoint
OpenAI-compativel). Runtime-agnostico: aponta para o vLLM em lote (padrao) ou
para o Ollama na calibracao, mudando so --base-url e --model.

Fluxo por municipio: construir_simbolos -> prep_ganchos -> chamar modelo (que
emite simbolos) -> GATE (com auditoria de simbolo, re-tenta) -> substituir
simbolos pelos valores canonicos -> montar registro (ranking templado). Ver
docs/INTERPRETACAO.md.

Uso (lote, servidor vLLM no ar em :8000, ver interpretacao/servir_vllm.sh):
    "$VLLM_VENV"/bin/python interpretacao/gerar.py \
        --base-url http://localhost:8000/v1 --model google/gemma-4-E2B-it \
        --concurrency 48 --out app/public/data/interpretacoes.json

Idempotente: registros cujo hash da fonte nao mudou sao reaproveitados.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import (
    INSTRUCOES,
    SCHEMA,
    compor_deterministico,
    gate,
    prep_ganchos,
    prompt_usuario,
    ranking_template,
)
from simbolos import construir_simbolos, contexto, substituir

FONTE_FIELDS = (
    "idm", "idm_percentil", "razao_fpm_receita", "razao_receita_pib", "porte_faixa",
    "tipologia", "polo_ibge", "distancia_polo_km", "tem_hospital_mac", "tem_ies", "idhm",
    # Effective-access refinement of the services reading (see harness.prep_ganchos).
    "uti", "presencial",
)


def source_hash(m: dict) -> str:
    payload = json.dumps({k: m.get(k) for k in FONTE_FIELDS}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def carregar_acesso(data_dir: Path) -> dict[str, dict]:
    """Effective-access flags per municipality (uti, presencial), joined to the
    services reading. Absence in a base means the refinement is absent (False),
    never missing; the base presence flags already carry the reconciled truth."""
    def _positives(name: str, field: str) -> set[str]:
        p = data_dir / name
        if not p.exists():
            return set()
        return {r["codigo_ibge"] for r in json.loads(p.read_text())["municipios"] if r.get(field)}
    uti = _positives("acesso_saude.json", "tem_uti")
    pres = _positives("acesso_educacao.json", "ies_presencial")
    return {"uti": uti, "presencial": pres}


_PLURAL_MUN = re.compile(r"\b(\d+) municípios?\b")


def _corrigir_plural(texto: str) -> str:
    """Deterministic number-noun agreement for 'municipio': after substitution a
    model that wrote {NORB} plus the literal 'municipios' would read '1 municipios'.
    This forces agreement regardless of which symbol the model chose, so the prose
    never disagrees in number."""
    def rep(mo: "re.Match[str]") -> str:
        n = int(mo.group(1))
        return f"{n} município" + ("s" if n != 1 else "")
    return _PLURAL_MUN.sub(rep, texto)


def _aplicar(simbolos: dict, out: dict) -> dict:
    """Substitui os simbolos pelos valores em todos os campos de texto, e forca a
    concordancia de numero de 'municipio'."""
    def sub(t: str) -> str:
        return _corrigir_plural(substituir(t, simbolos))
    tel = out["telas"]
    return {
        "como_esta": sub(out["como_esta"]),
        "problema": sub(out["problema"]),
        "rede": sub(out["rede"]),
        "para_o_gestor": [sub(x) for x in out["para_o_gestor"]],
        "telas": {k: sub(tel[k]) for k in ("mapa", "perfil", "fiscal")},
    }


def build_record(m: dict, ctx: dict, client, model: str, retries: int) -> dict:
    simbolos = construir_simbolos(m, ctx)
    ganchos, nivel, perc = prep_ganchos(m, ctx)
    messages = [
        {"role": "system", "content": INSTRUCOES},
        {"role": "user", "content": prompt_usuario(ganchos, simbolos, nivel)},
    ]
    response_format = {"type": "json_schema", "json_schema": {"name": "leitura", "schema": SCHEMA, "strict": True}}
    aceito = None
    ultimos: list[str] = []
    for _ in range(retries + 1):
        resp = client.chat.completions.create(
            model=model, messages=messages, response_format=response_format,
            temperature=0.25, extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        out = json.loads(resp.choices[0].message.content)
        problems = gate(simbolos, out, nivel, m.get("tipologia", ""))
        if not problems:
            aceito = out
            break
        ultimos = problems
    ranking = ranking_template(perc)
    deterministica = False
    if aceito is None:
        # The model could not phrase these facts without violating the gate even
        # after retries (persistently for a few orbitants near metros, which it
        # keeps calling poles). The harness phrases the same resolved hooks
        # itself, gate-safe by construction, so every municipality gets a reading
        # instead of falling to sem_leitura. Labelled as deterministic.
        composto = compor_deterministico(ganchos, nivel)
        if not gate(simbolos, composto, nivel, m.get("tipologia", "")):
            aceito = composto
            deterministica = True
    if aceito is None:
        return {"codigo_ibge": m["codigo_ibge"], "sem_leitura": True, "motivo": ultimos,
                "telas": {"ranking": ranking}, "hash": source_hash(m)}
    final = _aplicar(simbolos, aceito)
    final["telas"]["ranking"] = ranking
    rec = {"codigo_ibge": m["codigo_ibge"], **final, "hash": source_hash(m)}
    if deterministica:
        rec["deterministica"] = True
    return rec


def main() -> None:
    ap = argparse.ArgumentParser(description="Gera interpretacoes.json do painel IDM.")
    ap.add_argument("--base-url", default="http://localhost:8000/v1")
    ap.add_argument("--model", default="google/gemma-4-E2B-it")
    ap.add_argument("--api-key", default="local")
    ap.add_argument("--data", type=Path, default=Path("app/public/data"))
    ap.add_argument("--out", type=Path, default=Path("app/public/data/interpretacoes.json"))
    ap.add_argument("--concurrency", type=int, default=48)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0, help="0 = todos; N = amostra dos N primeiros")
    ap.add_argument(
        "--codigos",
        default="",
        help="lista de codigos IBGE separados por virgula a regerar por forca, "
             "mesmo com hash inalterado. Usar quando muda a regra de geracao, "
             "nao o dado de entrada, caso em que o hash nao acusa diferenca.",
    )
    args = ap.parse_args()

    from openai import OpenAI
    client = OpenAI(base_url=args.base_url, api_key=args.api_key, timeout=120)

    municipios = json.loads((args.data / "municipios.json").read_text())
    ligacoes = json.loads((args.data / "ligacoes.json").read_text())
    acesso = carregar_acesso(args.data)
    for m in municipios:
        c = m["codigo_ibge"]
        m["uti"] = c in acesso["uti"]
        m["presencial"] = c in acesso["presencial"]
    ctx = contexto(municipios, ligacoes)
    if args.limit:
        municipios = municipios[: args.limit]

    anterior: dict[str, dict] = {}
    if args.out.exists():
        for r in json.loads(args.out.read_text()).get("municipios", []):
            anterior[r["codigo_ibge"]] = r
    # Reprocessa quem mudou de hash E quem ficou sem leitura na rodada anterior
    # (para o GATE ajustado ter uma nova chance nos que falharam).
    forcados = {c.strip() for c in args.codigos.split(",") if c.strip()}
    pendentes = [
        m for m in municipios
        if m["codigo_ibge"] in forcados
        or anterior.get(m["codigo_ibge"], {}).get("hash") != source_hash(m)
        or anterior.get(m["codigo_ibge"], {}).get("sem_leitura")
    ]
    print(f"{len(municipios)} municipios; {len(pendentes)} a (re)gerar; {len(municipios)-len(pendentes)} reaproveitados")

    novos: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futs = {pool.submit(build_record, m, ctx, client, args.model, args.retries): m for m in pendentes}
        for i, fut in enumerate(as_completed(futs), 1):
            rec = fut.result()
            novos[rec["codigo_ibge"]] = rec
            if i % 250 == 0:
                print(f"  {i}/{len(pendentes)}")

    registros = [novos.get(m["codigo_ibge"]) or anterior[m["codigo_ibge"]] for m in municipios]
    payload = {
        "modelo": args.model,
        "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "n": len(registros),
        "sem_leitura": sum(1 for r in registros if r.get("sem_leitura")),
        "municipios": registros,
    }
    args.out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(f"escrito {args.out} | {len(registros)} registros | {payload['sem_leitura']} sem leitura")


if __name__ == "__main__":
    main()
