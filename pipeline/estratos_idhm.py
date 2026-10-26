"""Leitura estratificada da associacao entre IDM e IDHM.

Reproduz os numeros da subsecao de validacao descritiva do artigo. Nao gera
artefato novo para o painel: le os artefatos ja publicados e imprime, para cada
celula de porte por macrorregiao, o rho de Spearman, o intervalo de bootstrap
por celula e a dispersao do IDHM dentro da celula.

Duas perguntas motivam o script. A primeira e de incerteza: o rho agregado ja vem
com intervalo de bootstrap, mas as celulas nao, e algumas tem poucas dezenas de
municipios. O intervalo por celula usa a mesma tecnica, a mesma semente e o mesmo
numero de reamostras do agregado, de modo que a leitura por estrato herda a
postura declarada no metodo, incerteza de reamostragem sem valor-p, ja que cada
celula e o conjunto completo dos municipios daquele porte e regiao, nao uma
amostra deles.

A segunda e de interpretacao: a forca da associacao varia muito entre celulas, e
parte dessa variacao pode ser propriedade da medida de referencia, nao do
fenomeno. Onde o IDHM varia pouco dentro da celula, uma associacao monotonica e
mais dificil de detectar (restricao de amplitude). O script mede isso pelo
Spearman entre o modulo do rho da celula e o desvio-padrao do IDHM na mesma
celula.

Celulas com menos de 50 municipios ja foram suprimidas na validacao; aqui so se
le o que foi publicado.

Uso:
    pipeline/.venv/bin/python pipeline/estratos_idhm.py --dados app/public/data
"""

from __future__ import annotations

import argparse
import json
import statistics as st
from pathlib import Path

import pandas as pd

from idm_pipeline.idm_core import (
    REGIAO_POR_DIGITO,
    _bootstrap_ci,
    spearman_corr,
)

# The validation collapses the two lower population bands into one stratum.
FAIXAS_COLAPSADAS = {"5k a 10k": "5k a 20k", "10k a 20k": "5k a 20k"}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dados", type=Path, default=Path("app/public/data"))
    ap.add_argument(
        "--tex",
        action="store_true",
        help="emit the LaTeX table body, ordered by macroregion then population band",
    )
    args = ap.parse_args()

    municipios = json.loads((args.dados / "municipios.json").read_text("utf-8"))
    if isinstance(municipios, dict):
        municipios = municipios.get("municipios", municipios)
    validacao = json.loads((args.dados / "validacao.json").read_text("utf-8"))["idm_idhm"]

    rho_publicado = {
        (e["porte"], e["regiao"]): (e["rho"], e["n"]) for e in validacao["estratos"]
    }

    celulas: dict[tuple[str, str], list[tuple[float, float]]] = {}
    for m in municipios:
        if m.get("idhm") is None or m.get("idm") is None:
            continue
        faixa = m.get("porte_faixa")
        chave = (
            FAIXAS_COLAPSADAS.get(faixa, faixa),
            REGIAO_POR_DIGITO.get(str(m["codigo_ibge"])[0], "?"),
        )
        celulas.setdefault(chave, []).append((m["idm"], m["idhm"]))

    ROTULO_PORTE = {
        "ate 5k": "Até 5 mil",
        "5k a 20k": "5 mil a 20 mil",
        "20k a 50k": "20 mil a 50 mil",
        "50k a 100k": "50 mil a 100 mil",
        "100k a 500k": "100 mil a 500 mil",
    }
    ORDEM_PORTE = {k: i for i, k in enumerate(ROTULO_PORTE)}
    ORDEM_REGIAO = {r: i for i, r in enumerate(
        ("Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste")
    )}

    def num(v: float, casas: int = 2, sinal: bool = False) -> str:
        s = f"{v:+.{casas}f}" if sinal else f"{v:.{casas}f}"
        return "$" + s.replace("-", "-").replace(".", "{,}") + "$"

    cab = f'{"porte":<13}{"regiao":<14}{"n":>6}{"rho":>8}{"IC95":>18}{"dp_idhm":>10}'
    if not args.tex:
        print(cab)
    linhas_tex: list[tuple[tuple[int, int], str]] = []
    modulos: list[float] = []
    dispersoes: list[float] = []
    cruzam_zero: list[tuple[str, str]] = []
    for chave, (rho, n) in sorted(rho_publicado.items(), key=lambda kv: kv[1][0]):
        pares = celulas.get(chave, [])
        if len(pares) < 3:
            continue
        idm = pd.Series([x for x, _ in pares])
        idhm = pd.Series([y for _, y in pares])
        lo, hi = _bootstrap_ci([idm, idhm], spearman_corr)
        dp = st.pstdev([y for _, y in pares])
        modulos.append(abs(rho))
        dispersoes.append(dp)
        if lo <= 0.0 <= hi:
            cruzam_zero.append(chave)
        ic = f"[{lo:+.2f}, {hi:+.2f}]"
        if args.tex:
            # Three marks, each explained in the table note and in the prose:
            # dagger for a CI crossing zero (rendered gray, de-emphasised),
            # ddagger for the pair contrasted in the text, bold for the
            # strongest association in the table.
            cruza = lo <= 0.0 <= hi
            par_contraste = chave[0] == "ate 5k" and chave[1] in ("Nordeste", "Sudeste")
            mais_forte = chave == ("20k a 50k", "Norte")
            cel_rho = num(rho)
            cel_ic = f"[{num(lo, sinal=True)}; {num(hi, sinal=True)}]"
            if mais_forte:
                cel_rho = f"\\textbf{{{cel_rho}}}"
            if cruza:
                cel_rho = f"\\textcolor{{gray}}{{{cel_rho}}}$^{{\\dagger}}$"
                cel_ic = f"\\textcolor{{gray}}{{{cel_ic}}}"
            if par_contraste:
                cel_rho = f"{cel_rho}$^{{\\ddagger}}$"
            linhas_tex.append((
                (ORDEM_REGIAO[chave[1]], ORDEM_PORTE[chave[0]]),
                f"{chave[1]} & {ROTULO_PORTE[chave[0]]} & {n} & {cel_rho}"
                f" & {cel_ic}"
                f" & {num(dp, casas=3)} \\\\",
            ))
        else:
            print(f"{chave[0]:<13}{chave[1]:<14}{n:>6}{rho:>8.3f}{ic:>18}{dp:>10.4f}")

    if args.tex:
        anterior = None
        for (reg, _), linha in sorted(linhas_tex):
            if anterior is not None and reg != anterior:
                print("\\addlinespace")
            anterior = reg
            print(linha)
        print()
    print(
        f"\ncelulas publicadas: {len(rho_publicado)}"
        f" | suprimidas por n < {validacao['n_min_celula']}:"
        f" {validacao['celulas_suprimidas']}"
    )
    print(f"celulas cujo IC95 cruza o zero: {len(cruzam_zero)} {cruzam_zero}")
    meta = spearman_corr(pd.Series(modulos), pd.Series(dispersoes))
    print(
        "Spearman entre |rho| da celula e o desvio-padrao do IDHM na celula: "
        f"{meta:.3f} (n = {len(modulos)} celulas)"
    )


if __name__ == "__main__":
    main()
