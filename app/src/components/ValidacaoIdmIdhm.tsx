import * as Plot from "@observablehq/plot";
import { useEffect, useMemo, useRef } from "react";
import type { Municipio } from "../lib/types";

// Shape of validacao.json's idm_idhm block, written by pipeline idm_core.
interface EstratoIdhm {
  porte: string;
  regiao: string;
  n: number;
  rho: number | null;
}
export interface ValidacaoIdmIdhmDados {
  ano_idhm: number;
  n_pareado: number;
  n_sem_idhm: number;
  rho_bruto: number | null;
  rho_bruto_ic95: (number | null)[];
  rho_parcial_log_pop: number | null;
  rho_parcial_ic95: (number | null)[];
  rho_por_eixo: { orbitacao: number | null; fiscal: number | null; servicos: number | null };
  n_min_celula: number;
  celulas_suprimidas: number;
  estratos: EstratoIdhm[];
}

function num(v: number | null | undefined, casas = 2): string {
  return v === null || v === undefined ? "s/d" : v.toFixed(casas).replace(".", ",");
}

function intervalo(ic: (number | null)[], casas = 2): string {
  const [lo, hi] = ic;
  if (lo === null || hi === null || lo === undefined || hi === undefined) return "";
  return `IC 95% [${num(lo, casas)}; ${num(hi, casas)}]`;
}

// External descriptive validation of the IDM against the IDHM. Lives only in the
// methodology screen, apart from the municipal datum and from the third-party
// literature card. Never labelled "validade convergente" (the two indices are
// not independent) and never causal: it reports an association, hardened per the
// adversarial debate with a partial correlation controlling population and a
// per-axis decomposition (docs/DECISAO_CONTEXTO.md, docs/DECISAO_CAUSAL.md).
export function ValidacaoIdmIdhm({
  dados,
  municipios,
}: {
  dados: ValidacaoIdmIdhmDados;
  municipios: Municipio[];
}) {
  const host = useRef<HTMLDivElement | null>(null);

  const pontos = useMemo(
    () =>
      municipios
        .filter((m) => m.idhm !== null && m.idhm !== undefined)
        .map((m) => ({ idm: m.idm, idhm: m.idhm as number })),
    [municipios],
  );

  useEffect(() => {
    const el = host.current;
    if (!el || pontos.length === 0) return;
    const grafico = Plot.plot({
      height: 300,
      marginLeft: 48,
      marginBottom: 40,
      x: { label: "IDM (dependencia)", domain: [0, 1], grid: true },
      y: { label: "IDHM 2010", grid: true },
      style: { background: "transparent", color: "var(--ink-secondary)" },
      marks: [
        Plot.dot(pontos, {
          x: "idm",
          y: "idhm",
          r: 1.6,
          fill: "var(--accent)",
          fillOpacity: 0.28,
        }),
      ],
    });
    el.append(grafico);
    return () => grafico.remove();
  }, [pontos]);

  const eixo = dados.rho_por_eixo;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>
          Associação com o desenvolvimento humano
        </h2>
        <span
          style={{
            fontSize: "var(--text-caption)",
            color: "var(--ink-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-control)",
            padding: "0 var(--space-2)",
          }}
        >
          IDHM {dados.ano_idhm}
        </span>
      </div>
      <p style={{ color: "var(--ink-secondary)" }}>
        Validação descritiva externa, não causal. O IDHM entra como referente de
        desenvolvimento, apurado no Censo de {dados.ano_idhm} e defasado frente ao
        ano-base do índice; é uma associação descritiva exploratória, não uma
        validade convergente, porque IDM e IDHM partilham insumos e não são
        medidas independentes. Nenhum valor de município confirma causa.
      </p>

      <div ref={host} className="grafico-host" role="img" aria-label="Dispersão do IDM contra o IDHM de 2010 por município" />

      <p style={{ color: "var(--ink-secondary)" }}>
        Sobre {dados.n_pareado} municípios com IDHM ({dados.n_sem_idhm} instalados
        após 2010 ficam sem valor, não imputados). Spearman bruto ={" "}
        <span className="tabular">{num(dados.rho_bruto)}</span>{" "}
        {intervalo(dados.rho_bruto_ic95)}. Controlando o logaritmo da população, o
        confundidor comum de porte, o Spearman parcial ={" "}
        <span className="tabular">{num(dados.rho_parcial_log_pop)}</span>{" "}
        {intervalo(dados.rho_parcial_ic95)}: a associação não se dissolve ao
        remover o efeito de tamanho.
      </p>
      <p style={{ color: "var(--ink-secondary)" }}>
        Decomposição por eixo contra o IDHM: fiscal{" "}
        <span className="tabular">{num(eixo.fiscal)}</span>, orbitação{" "}
        <span className="tabular">{num(eixo.orbitacao)}</span>, serviços{" "}
        <span className="tabular">{num(eixo.servicos)}</span>. O eixo fiscal
        carrega a maior parte da associação; a de serviços é quase nula. A
        estratificação por porte e região usa piso de {dados.n_min_celula}{" "}
        municípios por célula ({dados.estratos.length} células publicadas,{" "}
        {dados.celulas_suprimidas} suprimidas por tamanho); a incerteza vem de
        bootstrap, sem valor-p, por se tratar de um censo de municípios, não de
        uma amostra.
      </p>
      <div
        style={{
          borderLeft: "2px solid var(--baseline)",
          paddingLeft: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
        }}
      >
        <p style={{ margin: 0, color: "var(--ink-primary)", fontWeight: "var(--weight-title)" }}>
          Como ler
        </p>
        <ul style={{ margin: 0, paddingLeft: "var(--space-4)", color: "var(--ink-secondary)" }}>
          <li>
            Associação negativa moderada, em módulo abaixo de 0,5: municípios menos
            dependentes tendem a ter IDHM maior, como tendência, não como regra.
          </li>
          <li>
            Associação, não causa. Causas comuns, como porte, região e base
            econômica, empurram dependência e desenvolvimento ao mesmo tempo; o
            painel não afirma que uma produz a outra.
          </li>
          <li>
            Controlar população não dissolve a associação, então ela não é mero
            artefato de tamanho; ainda assim segue descritiva.
          </li>
          <li>
            Concentra-se no eixo fiscal e é quase nula no de serviços, o contrário
            do que a intuição de hospital e faculdade sugeriria primeiro.
          </li>
          <li>
            IDHM de 2010 contra IDM de 2018 e 2024: descreve estruturas de mudança
            lenta, não um retrato do mesmo instante.
          </li>
        </ul>
      </div>
    </section>
  );
}
