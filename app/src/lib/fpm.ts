// FPM coefficient by population band (Decreto-Lei 1.881/1981, updated by TCU per
// the annual census estimate). Each pair is (upper bound, coefficient); the
// coefficient is the first band whose bound the population does not exceed. Floor
// 0.6, ceiling 4.0. Pure arithmetic of the standing rule; see
// docs/DECISAO_CENARIOS.md. Shared by the fiscal concavity block and the
// Brasil em Cenarios simulator.
export const FAIXAS_FPM: readonly [number, number][] = [
  [10188, 0.6], [13584, 0.8], [16980, 1.0], [23772, 1.2], [30564, 1.4],
  [37356, 1.6], [44148, 1.8], [50940, 2.0], [61128, 2.2], [71316, 2.4],
  [81504, 2.6], [91692, 2.8], [101880, 3.0], [115464, 3.2], [129048, 3.4],
  [142632, 3.6], [156216, 3.8], [Number.POSITIVE_INFINITY, 4.0],
];

export function coeficienteFpm(populacao: number): number {
  for (const [limite, coef] of FAIXAS_FPM) {
    if (populacao <= limite) return coef;
  }
  return 4.0;
}
