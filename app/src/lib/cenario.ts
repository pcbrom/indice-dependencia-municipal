// Locates the functional region a municipality belongs to (as anchor or member)
// and derives the consortium band, so the one-page report can carry the same
// "Brasil em Cenarios" reading as the interactive tab. The band parameters mirror
// routes/cenarios.tsx (kept in sync deliberately): tightened to the range the
// international evidence supports, net about -8% to +5% of the shared admin cost.

import type { AnaliseAgregacao, RegiaoFuncional } from "./data";

const ESCALA_MIN = 0;
const ESCALA_MAX = 0.08;
const GOV_MIN = 0.03;
const GOV_MAX = 0.08;

export interface CenarioMunicipio {
  rf: RegiaoFuncional;
  consorcioMin: number;
  consorcioMax: number;
}

// The functional region a municipality is in: it is the anchor of its own region
// (polo/semi-polo) or a member of its anchor's region (orbitante). Linear scan
// over the partition; called once per report render (print-only), so it is cheap.
export function cenarioDoMunicipio(
  analise: AnaliseAgregacao | null,
  codigo: string,
): CenarioMunicipio | null {
  if (!analise) return null;
  for (const bloco of Object.values(analise.regioes)) {
    for (const uf of Object.values(bloco.ufs)) {
      for (const rf of uf.regioes) {
        if (rf.id === codigo || rf.membros.includes(codigo)) {
          return {
            rf,
            consorcioMin: (ESCALA_MIN - GOV_MAX) * rf.administracao,
            consorcioMax: (ESCALA_MAX - GOV_MIN) * rf.administracao,
          };
        }
      }
    }
  }
  return null;
}
