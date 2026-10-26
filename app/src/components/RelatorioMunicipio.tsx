import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  carregarAcesso,
  carregarAnalise,
  carregarManifesto,
  formatarInteiro,
  formatarPercentual,
  rotuloPorte,
} from "../lib/data";
import type { AcessoMunicipio, AnaliseAgregacao } from "../lib/data";
import { cenarioDoMunicipio } from "../lib/cenario";
import { resumoDeterministico, rotuloDistancia, servicosLegiveis } from "../lib/leitura";
import { rotuloPolo } from "../lib/rede";
import { useInterpretacao } from "../lib/interpretacao";
import type { Manifesto, Municipio } from "../lib/types";
import { ComparacaoPares } from "./ComparacaoPares";
import { notaDaLeitura } from "./LeituraAutomatica";

// One-page municipal report, rendered only for print (window.print -> PDF), the
// artifact a councilor takes to a public hearing. Self-contained: it takes only
// the municipality and loads its own supporting data (reading, effective access,
// manifest, aggregation scenario), so any surface can mount it with a single tag.
// Works for any of the ~5.5k cities; every figure keeps its provenance.

const ROTULO_TIPOLOGIA: Record<Municipio["tipologia"], string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

function fonteRegicAno(manifesto: Manifesto | null): number {
  return manifesto?.ano_base_regic ?? 2018;
}

function dataMaisRecente(manifesto: Manifesto | null): string {
  const datas = (manifesto?.fontes ?? [])
    .map((f) => f.data_extracao)
    .filter(Boolean)
    .sort();
  return datas[datas.length - 1] ?? "";
}

function formatarDataIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Compact currency for the scenario figures, mirroring routes/cenarios.tsx.
function reaisCompacto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
}

function idm2(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

export function RelatorioMunicipio({
  m,
  municipios,
  doi,
}: {
  m: Municipio;
  municipios: Municipio[];
  doi: string;
}) {
  const interpretacao = useInterpretacao(m.codigo_ibge);
  const [acessoMapa, setAcessoMapa] = useState<Map<string, AcessoMunicipio> | null>(null);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [analise, setAnalise] = useState<AnaliseAgregacao | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarAcesso().then((a) => vivo && setAcessoMapa(a)).catch(() => vivo && setAcessoMapa(null));
    carregarManifesto().then((x) => vivo && setManifesto(x)).catch(() => vivo && setManifesto(null));
    carregarAnalise().then((x) => vivo && setAnalise(x)).catch(() => vivo && setAnalise(null));
    return () => {
      vivo = false;
    };
  }, []);

  const acesso = acessoMapa?.get(m.codigo_ibge);
  const polo = m.polo_ibge ? municipios.find((x) => x.codigo_ibge === m.polo_ibge) : undefined;
  const poloTexto = m.tipologia === "orbitante" ? rotuloPolo(m, polo) : null;
  const cenario = cenarioDoMunicipio(analise, m.codigo_ibge);
  const rf = cenario && cenario.rf.n > 1 ? cenario.rf : null;
  const porCodigo = new Map(municipios.map((x) => [x.codigo_ibge, x] as const));
  const outrosMembros = rf
    ? rf.membros
        .filter((c) => c !== rf.id)
        .map((c) => porCodigo.get(c)?.nome ?? c)
        .join(", ")
    : "";

  const percentil = Math.round(m.idm_percentil * 100);
  const temLeitura = Boolean(interpretacao && !interpretacao.sem_leitura && interpretacao.como_esta);
  const eixos: { rotulo: string; valor: number }[] = [
    { rotulo: "orbitação", valor: m.eixo_orbitacao },
    { rotulo: "fiscal", valor: m.eixo_fiscal },
    { rotulo: "serviços", valor: m.eixo_servicos },
  ];
  const dataExtracao = formatarDataIso(dataMaisRecente(manifesto));

  // Rendered through a portal at body level, as a sibling of #root, so print can
  // hide the whole app (#root) and leave only this document.
  return createPortal(
    <article className="relatorio-municipio" aria-hidden>
      <header className="relatorio-cab">
        <p className="relatorio-selo">Índice de Dependência Municipal (IDM)</p>
        <h1 className="relatorio-titulo">
          {m.nome} ({m.uf})
        </h1>
        <p className="relatorio-sub">
          {ROTULO_TIPOLOGIA[m.tipologia]} · {formatarInteiro(m.populacao)} habitantes
        </p>
      </header>

      <section className="relatorio-idm">
        <div className="relatorio-idm-num">IDM {idm2(m.idm)}</div>
        <p className="relatorio-idm-perc">
          Mais dependente que {percentil}% dos municípios brasileiros. O IDM mede o
          quanto a vida e as contas dependem de fora; não avalia a gestão.
        </p>
        <ul className="relatorio-eixos">
          {eixos.map((e) => (
            <li key={e.rotulo}>
              <span>{e.rotulo}</span>
              <strong>{idm2(e.valor)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="relatorio-leitura">
        <h2>Leitura</h2>
        {temLeitura ? (
          <>
            {interpretacao?.como_esta && <p>{interpretacao.como_esta}</p>}
            {interpretacao?.problema && <p>{interpretacao.problema}</p>}
            {interpretacao?.rede && <p>{interpretacao.rede}</p>}
            {interpretacao?.para_o_gestor && interpretacao.para_o_gestor.length > 0 && (
              <p>
                <strong>Para o gestor. </strong>
                {interpretacao.para_o_gestor.join(" ")}
              </p>
            )}
          </>
        ) : (
          <p>{resumoDeterministico(m, poloTexto, acesso)}</p>
        )}
      </section>

      <section className="relatorio-ficha">
        <h2>Estado atual</h2>
        <dl>
          <div>
            <dt>Polo de referência</dt>
            <dd>
              {poloTexto ?? "a própria cidade"}
              {poloTexto && rotuloDistancia(m.distancia_polo_km)
                ? ` (${rotuloDistancia(m.distancia_polo_km)})`
                : ""}
            </dd>
          </div>
          <div>
            <dt>Repasse da União (FPM)</dt>
            <dd>{formatarPercentual(m.razao_fpm_receita)} da receita</dd>
          </div>
          <div>
            <dt>Prefeitura x PIB</dt>
            <dd>{m.razao_receita_pib.toFixed(1).replace(".", ",")}x</dd>
          </div>
          <div>
            <dt>Serviços locais</dt>
            <dd>{servicosLegiveis(m, acesso).join("; ")}</dd>
          </div>
        </dl>
      </section>

      <section className="relatorio-pares">
        <h2>Frente aos municípios do mesmo porte ({rotuloPorte(m.porte_faixa)}), pela mediana</h2>
        <ComparacaoPares municipio={m} municipios={municipios} compacto />
      </section>

      {rf && cenario && (
        <section className="relatorio-cenarios">
          <h2>Brasil em Cenários: se a região funcional se fundir na âncora</h2>
          <dl>
            <div>
              <dt>Região funcional</dt>
              <dd>
                âncora {rf.ancora_nome}
                {outrosMembros ? ` e ${outrosMembros}` : ""}; {formatarInteiro(rf.populacao)} hab
              </dd>
            </div>
            <div>
              <dt>Máquina pública hoje</dt>
              <dd>{reaisCompacto(rf.maquina)} (Legislativa + Administração)</dd>
            </div>
            <div>
              <dt>Economia potencial</dt>
              <dd>
                <span className="relatorio-verde">
                  {reaisCompacto(rf.economia_piso)} a {reaisCompacto(rf.economia_teto)}
                </span>{" "}
                · piso: câmaras suprimidas; teto: mais a administração absorvida
                (parte permanente, real abaixo do teto)
              </dd>
            </div>
            <div>
              <dt>FPM se fundido</dt>
              <dd>
                {reaisCompacto(rf.fpm_hoje)} hoje → {reaisCompacto(rf.fpm_fundido)}; perda de{" "}
                {reaisCompacto(rf.fpm_hoje - rf.fpm_fundido)} redistribuída no estado, não é
                economia da União
              </dd>
            </div>
            <div>
              <dt>Estrutura da sede</dt>
              <dd>{rf.estrutura.nivel}</dd>
            </div>
            <div>
              <dt>IDM médio da região</dt>
              <dd>
                {idm2(rf.idm_atual)} → {idm2(rf.idm_simulado)} (simulado)
              </dd>
            </div>
            <div>
              <dt>Consórcio (líquido possível)</dt>
              <dd>
                <span className="relatorio-verm">{reaisCompacto(cenario.consorcioMin)}</span> a{" "}
                <span className="relatorio-verde">{reaisCompacto(cenario.consorcioMax)}</span> · faixa,
                sem calibração brasileira; evidência internacional aponta líquido perto de zero
              </dd>
            </div>
          </dl>
        </section>
      )}

      <footer className="relatorio-rodape">
        <p>
          Fontes: REGIC {fonteRegicAno(manifesto)} (IBGE), FINBRA/Siconfi e DCA Anexo
          I-E (Tesouro Nacional), PIB dos Municípios (IBGE), CNES (DATASUS), Censo da
          Educação Superior (INEP) e ESTBAN (Banco Central).
          {dataExtracao ? ` Extração mais recente em ${dataExtracao}.` : ""}
        </p>
        <p>
          Cada número deste relatório rastreia a um script e a uma base datada.
          Painel: idm.pcbrom.com · Dados: DOI {doi}.
        </p>
        <p className="relatorio-nota">
          {temLeitura
            ? notaDaLeitura(interpretacao)
            : "Leitura montada de forma determinística a partir das bases; sem prosa gerada por modelo nesta rodada. Descritiva e estrutural, sem juízo de gestão."}
          {" "}Cenários é análise estrutural, não recomendação de fusão.
        </p>
      </footer>
    </article>,
    document.body,
  );
}
