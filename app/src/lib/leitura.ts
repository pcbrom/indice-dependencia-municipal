// Deterministic per-municipality reading, assembled only from the figures. It
// is the universal fallback for a city without an approved automatic reading, so
// the case-use scene is available for every municipality, on screen and in the
// exportable report. Descriptive and structural, no management judgement and no
// causal claim, matching the interpretation-layer policy (docs/INTERPRETACAO.md).

import { formatarPercentual } from "./data";
import type { AcessoMunicipio } from "./data";
import type { Municipio } from "./types";

export function rotuloDistancia(km: number | null | undefined): string | null {
  if (km == null || km <= 0) return null;
  return `${Math.round(km)} km`;
}

// Human-readable local service presence, effective access when the access layer
// resolved it, plain presence otherwise.
export function servicosLegiveis(m: Municipio, ac: AcessoMunicipio | undefined): string[] {
  const hospital = m.tem_hospital_mac
    ? ac
      ? ac.uti
        ? "hospital com UTI"
        : "hospital sem UTI"
      : "hospital"
    : "sem hospital";
  const ies = m.tem_ies
    ? ac
      ? ac.presencial
        ? "ensino superior presencial"
        : "ensino superior só a distância"
      : "ensino superior"
    : "sem ensino superior";
  const banco = ac
    ? ac.agencia
      ? "agência bancária"
      : ac.correspondente
        ? "só correspondente bancário"
        : "sem banco"
    : "banco não avaliado";
  return [hospital, ies, banco];
}

// Two-to-three sentence deterministic reading: role and orbit, fiscal trait, and
// local services. poloTexto is the pole label for an orbitant, null otherwise.
export function resumoDeterministico(
  m: Municipio,
  poloTexto: string | null,
  ac: AcessoMunicipio | undefined,
): string {
  const frases: string[] = [];
  if (m.tipologia === "orbitante") {
    const dist = rotuloDistancia(m.distancia_polo_km);
    const polo = poloTexto ?? "outro centro";
    frases.push(
      `${m.nome} orbita ${polo}${dist ? `, a ${dist}` : ""} para os serviços de maior porte.`,
    );
  } else if (m.tipologia === "polo") {
    frases.push(`${m.nome} é um polo: concentra serviços que outras cidades procuram.`);
  } else {
    frases.push(
      `${m.nome} é um semi-polo: reúne parte dos serviços e ainda recorre a um centro maior.`,
    );
  }
  frases.push(
    `O Fundo de Participação dos Municípios (FPM) responde por ${formatarPercentual(m.razao_fpm_receita)} da receita, e a prefeitura movimenta ${m.razao_receita_pib.toFixed(1).replace(".", ",")}x o PIB local.`,
  );
  frases.push(`Serviços locais: ${servicosLegiveis(m, ac).join(", ")}.`);
  return frases.join(" ");
}
