import type { AcessoMunicipio, Interpretacao } from "../lib/data";
import { resumoDeterministico } from "../lib/leitura";
import type { Municipio } from "../lib/types";

// Fixed disclosure: every automatic reading in the UI carries this note, so the
// reader never confuses the machine reading with an editorial claim of the panel.
export const NOTA_GERACAO =
  "Leitura gerada automaticamente pelo modelo google/gemma-4-E2B-it; descritiva e estrutural, sem juízo de gestão. Ver metodologia.";

// Disclosure for the few readings the harness composed deterministically from
// the resolved facts, because the model could not phrase them without inverting
// the role. Correct and gate-safe, but not model-written; labelled honestly.
export const NOTA_DETERMINISTICA =
  "Leitura composta deterministicamente pelo harness a partir das bases, sem redação por modelo; descritiva e estrutural, sem juízo de gestão. Ver metodologia.";

// The generation note that fits a reading: the deterministic disclosure when the
// harness composed it, the model disclosure otherwise.
export function notaDaLeitura(interpretacao: { deterministica?: boolean } | null): string {
  return interpretacao?.deterministica ? NOTA_DETERMINISTICA : NOTA_GERACAO;
}

// Short per-screen slice (mapa, perfil, fiscal, ranking): one sentence in its own
// framed callout, labelled as automatic. Renders nothing when the slice is absent.
export function LeituraFatia({ texto, rotulo = "leitura automática" }: { texto?: string; rotulo?: string }) {
  if (!texto) return null;
  return (
    <aside className="leitura-fatia" title={NOTA_GERACAO}>
      <span className="leitura-fatia-tag">{rotulo}</span>
      <p style={{ margin: 0 }}>{texto}</p>
    </aside>
  );
}

// Consolidated report: como esta, o que se destaca, na rede, e para o gestor,
// with the generation note at the foot. A municipality without an approved
// automatic reading falls back to a deterministic scene assembled from the data
// (when the fallback props are given), so the case-use reading is universal;
// otherwise a neutral note is shown.
export function LeituraRelatorio({
  interpretacao,
  fallback,
}: {
  interpretacao: Interpretacao | null;
  fallback?: { m: Municipio; poloTexto: string | null; acesso: AcessoMunicipio | undefined };
}) {
  if (!interpretacao && !fallback) return null;
  if (!interpretacao || interpretacao.sem_leitura || !interpretacao.como_esta) {
    if (fallback) {
      return (
        <section className="leitura-relatorio">
          <h3 className="leitura-titulo">Leitura</h3>
          <p style={{ margin: 0 }}>
            {resumoDeterministico(fallback.m, fallback.poloTexto, fallback.acesso)}
          </p>
          <p className="leitura-nota">
            Leitura montada de forma determinística a partir das bases; sem prosa
            gerada por modelo nesta rodada. Descritiva e estrutural, sem juízo de gestão.
          </p>
        </section>
      );
    }
    return (
      <section className="leitura-relatorio">
        <h3 className="leitura-titulo">Leitura automática</h3>
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-caption)" }}>
          A leitura automática deste município não foi gerada nesta rodada; os
          números e o perfil seguem disponíveis nas demais telas.
        </p>
      </section>
    );
  }
  const { como_esta, problema, rede, para_o_gestor } = interpretacao;
  return (
    <section className="leitura-relatorio">
      <h3 className="leitura-titulo">Leitura automática</h3>
      {como_esta && (
        <p style={{ margin: 0 }}>
          <strong style={{ color: "var(--ink-primary)" }}>Como está.</strong> {como_esta}
        </p>
      )}
      {problema && (
        <p style={{ margin: 0 }}>
          <strong style={{ color: "var(--ink-primary)" }}>O que se destaca.</strong> {problema}
        </p>
      )}
      {rede && (
        <p style={{ margin: 0 }}>
          <strong style={{ color: "var(--ink-primary)" }}>Na rede.</strong> {rede}
        </p>
      )}
      {para_o_gestor && para_o_gestor.length > 0 && (
        <div>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--ink-primary)" }}>Para o gestor.</strong>
          </p>
          <ul style={{ margin: "var(--space-1) 0 0", paddingLeft: "var(--space-4)" }}>
            {para_o_gestor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="leitura-nota">{notaDaLeitura(interpretacao)}</p>
    </section>
  );
}
