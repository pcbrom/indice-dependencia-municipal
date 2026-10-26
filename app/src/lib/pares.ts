// Peer comparison of one municipality: where it sits against municipalities of
// the same population band (porte), nationally and inside its state, and which
// cities are most comparable to it. Descriptive only, per docs/DECISAO_CAUSAL.md:
// medians of the same porte, never the national average, and no management grade.

import { medianaNumeros } from "./data";
import type { Municipio } from "./types";

export interface MedianasPares {
  n: number;
  idm: number;
  fpm: number; // FPM share of total revenue
  pib: number; // total revenue relative to local GDP
}

export interface ComparacaoPares {
  brasil: MedianasPares;
  uf: MedianasPares | null; // null when the state has too few peers of the porte
  comparaveis: Municipio[];
}

// Fewer peers than this in the state make the state median unstable.
const MIN_PARES_UF = 5;
const N_COMPARAVEIS = 3;

function medianas(lista: Municipio[]): MedianasPares {
  return {
    n: lista.length,
    idm: medianaNumeros(lista.map((x) => x.idm)),
    fpm: medianaNumeros(lista.map((x) => x.razao_fpm_receita)),
    pib: medianaNumeros(lista.map((x) => x.razao_receita_pib)),
  };
}

export function compararComPares(m: Municipio, municipios: Municipio[]): ComparacaoPares {
  const mesmoPorte = municipios.filter((x) => x.porte_faixa === m.porte_faixa);
  const portePeers = mesmoPorte.filter((x) => x.codigo_ibge !== m.codigo_ibge);
  const ufPeers = portePeers.filter((x) => x.uf === m.uf);
  // Comparable cities: same state and porte, same typology when there are
  // enough of them, ordered by closeness in population on a log scale.
  const mesmaTipologia = ufPeers.filter((x) => x.tipologia === m.tipologia);
  const base = mesmaTipologia.length >= N_COMPARAVEIS ? mesmaTipologia : ufPeers;
  const distancia = (x: Municipio) => Math.abs(Math.log(x.populacao) - Math.log(m.populacao));
  const comparaveis = [...base].sort((a, b) => distancia(a) - distancia(b)).slice(0, N_COMPARAVEIS);
  return {
    brasil: medianas(mesmoPorte),
    uf: ufPeers.length + 1 >= MIN_PARES_UF ? medianas([...ufPeers, m]) : null,
    comparaveis,
  };
}
