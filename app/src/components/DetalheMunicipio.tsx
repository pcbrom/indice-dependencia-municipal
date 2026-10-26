import { Printer, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  carregarAcesso,
  formatarPercentual,
  medianaIdm,
  medianasPorPorteFiscal,
  quadranteFiscal,
  rotuloPorte,
} from "../lib/data";
import type { AcessoMunicipio } from "../lib/data";
import { rotuloPolo, cadeiaAscendente, construirArvore, indexarFilhos } from "../lib/rede";
import { useInterpretacao } from "../lib/interpretacao";
import type { FonteRef, Ligacao, Manifesto, Municipio } from "../lib/types";
import { BlocoHeroiIDM } from "./BlocoHeroiIDM";
import { LeituraRelatorio } from "./LeituraAutomatica";
import { DendrogramaRede } from "./DendrogramaRede";
import { DispersaoFiscal } from "./DispersaoFiscal";
import { EgoGraphOrbita } from "./EgoGraphOrbita";
import { GrupoStat } from "./GrupoStat";
import { SankeyOrcamento } from "./SankeyOrcamento";
import type { StatTileProps } from "./StatTile";
import { TabelaRanking } from "./TabelaRanking";

interface DetalheMunicipioProps {
  municipio: Municipio;
  municipios: Municipio[];
  ligacoes: Ligacao[];
  manifesto?: Manifesto | null;
  // Section to scroll into view on open (the four PainelPolo entries map here);
  // the frame is a single scroll, not tabs.
  secaoInicial?: SecaoDetalhe;
  onFechar: () => void;
}

export type SecaoDetalhe = "grau" | "fiscal" | "ranking" | "rede";

const formatarInteiro = new Intl.NumberFormat("pt-BR");

const ROTULO_TIPOLOGIA: Record<Municipio["tipologia"], string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

function faixaPercentilica(percentil: number): string {
  if (percentil >= 0.75) return "entre os 25% mais dependentes";
  if (percentil >= 0.5) return "entre 25% e 50% mais dependentes";
  if (percentil >= 0.25) return "entre 50% e 75% mais dependentes";
  return "entre os 25% menos dependentes";
}

function formatarIdm(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

// The overlay swaps between the consolidated dossier and the full profile,
// fiscal and ranking views, so those open in place instead of navigating away.
type VistaDetalhe = "resumo" | "perfil" | "fiscal" | "ranking";

function formatarKm(km: number): string {
  return `${formatarInteiro.format(Math.round(km))} km`;
}

function medianaDe(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 1
    ? (ord[meio] ?? 0)
    : ((ord[meio - 1] ?? 0) + (ord[meio] ?? 0)) / 2;
}

// Revenue entry mix for the Sankey (same split the fiscal screen uses); the
// spending side awaits FINBRA expense ingestion.
function entradasDeReceita(m: Municipio) {
  const outras = Math.max(0, m.receita_total - m.fpm);
  return [
    { origem: "imposto próprio e outras transferências", valor: outras },
    { origem: "FPM (repasse da União)", valor: m.fpm },
  ];
}

function fonteRegic(fontes: FonteRef[]): FonteRef {
  return (
    fontes.find((f) => f.nome === "REGIC") ??
    fontes[0] ?? {
      nome: "REGIC",
      orgao: "IBGE",
      ano: 0,
      data_extracao: "",
      url_catalogo: "",
      uso: "",
    }
  );
}

// Source seal for the effective-access group (CNES, INEP, BACEN), keeping the
// latest extraction date among them; falls back to REGIC when absent.
function fonteDe(
  fontes: FonteRef[],
  nomes: string[],
  rotulo: { nome: string; orgao: string },
): FonteRef {
  const usadas = fontes.filter((f) => nomes.includes(f.nome));
  const base = usadas[0] ?? fonteRegic(fontes);
  const dataExtracao = usadas.reduce(
    (max, f) => (f.data_extracao > max ? f.data_extracao : max),
    base.data_extracao,
  );
  return { ...base, nome: rotulo.nome, orgao: rotulo.orgao, data_extracao: dataExtracao };
}

// Dedicated route for each full view, so "abrir em tela cheia" navigates to the
// real page (the selection persists via context, so the page opens scoped to
// this city).
function rotaDaVista(vista: VistaDetalhe, codigo: string): string {
  if (vista === "perfil") return `/municipio/${codigo}`;
  if (vista === "fiscal") return "/fiscal";
  if (vista === "ranking") return "/ranking";
  return "/";
}

// Consolidated city dossier as a single overlay over the map: everything the
// four PainelPolo links used to reach (profile, network, fiscal axis, ranking),
// in one scrollable frame, scoped to the focused city, without leaving the map.
// The dedicated routes still exist for deep links (footer "ver telas cheias").
export function DetalheMunicipio({
  municipio,
  municipios,
  ligacoes,
  manifesto,
  secaoInicial,
  onFechar,
}: DetalheMunicipioProps) {
  const dialogoRef = useRef<HTMLDivElement | null>(null);
  const corpoRef = useRef<HTMLDivElement | null>(null);

  const porCodigo = useMemo(
    () => new Map(municipios.map((m) => [m.codigo_ibge, m] as const)),
    [municipios],
  );
  const filhosPorDestino = useMemo(() => indexarFilhos(ligacoes), [ligacoes]);
  const raiz = useMemo(
    () => construirArvore(municipio.codigo_ibge, porCodigo, filhosPorDestino),
    [municipio.codigo_ibge, porCodigo, filhosPorDestino],
  );
  const cadeia = useMemo(
    () => cadeiaAscendente(municipio.codigo_ibge, porCodigo),
    [municipio.codigo_ibge, porCodigo],
  );
  const orbitantes = useMemo(
    () =>
      ligacoes
        .filter((l) => l.destino_ibge === municipio.codigo_ibge)
        .map((l) => porCodigo.get(l.origem_ibge))
        .filter((m): m is Municipio => m != null),
    [ligacoes, porCodigo, municipio.codigo_ibge],
  );
  const populacaoOrbitantes = orbitantes.reduce((s, m) => s + m.populacao, 0);
  const polo =
    municipio.polo_ibge != null ? porCodigo.get(municipio.polo_ibge) : undefined;
  const superaPib = municipio.razao_receita_pib > 1;

  // View within the overlay: the consolidated resumo, or a full dimension.
  const [vista, setVista] = useState<VistaDetalhe>("resumo");
  const [acesso, setAcesso] = useState<Map<string, AcessoMunicipio> | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarAcesso()
      .then((a) => vivo && setAcesso(a))
      .catch(() => vivo && setAcesso(new Map()));
    return () => {
      vivo = false;
    };
  }, []);
  const interpretacao = useInterpretacao(municipio.codigo_ibge);
  const mediana = useMemo(() => medianaIdm(municipios), [municipios]);
  const fonteSelo = useMemo(
    () => fonteRegic(manifesto?.fontes ?? []),
    [manifesto],
  );
  const cortesPorte = useMemo(
    () => medianasPorPorteFiscal(municipios),
    [municipios],
  );
  const composicaoReferencia = useMemo(() => {
    const pares = municipios.filter(
      (x) =>
        x.porte_faixa === municipio.porte_faixa &&
        x.codigo_ibge !== municipio.codigo_ibge,
    );
    if (pares.length === 0) return null;
    const fracaoFpm = medianaDe(pares.map((x) => x.razao_fpm_receita));
    return { fracaoPropria: 1 - fracaoFpm, fracaoFpm };
  }, [municipios, municipio]);

  const grupo1: StatTileProps[] = [
    {
      rotuloComum: `Polo: ${rotuloPolo(municipio, polo)}`,
      valor:
        municipio.distancia_polo_km != null
          ? formatarKm(municipio.distancia_polo_km)
          : "0 km",
    },
  ];
  const grupo2: StatTileProps[] = [
    {
      rotuloComum: "Repasse da União",
      valor: formatarPercentual(municipio.razao_fpm_receita),
      termoTecnico:
        "Participação do FPM na receita total do município (f-1). Proporção entre 0 e 1.",
    },
    {
      rotuloComum: "Prefeitura x PIB",
      valor: `${municipio.razao_receita_pib.toFixed(1).replace(".", ",")}x`,
      termoTecnico:
        "Razão entre a receita municipal e o PIB local (f-2). Acima de 1x a prefeitura movimenta mais do que a cidade produz.",
    },
  ];
  const ac = acesso?.get(municipio.codigo_ibge);
  const fonteAcesso = fonteDe(manifesto?.fontes ?? [], ["CNES", "Cadastro de IES (e-MEC)", "ESTBAN"], {
    nome: "CNES, INEP e BACEN",
    orgao: "DATASUS, INEP/MEC, Banco Central",
  });
  const grupo3: StatTileProps[] = [
    {
      rotuloComum: "Hospital",
      valor: municipio.tem_hospital_mac ? (ac ? (ac.uti ? "com UTI" : "sem UTI") : "sim") : "não",
      termoTecnico: ac?.uti
        ? `Hospital com ${ac.uti_leitos} leito(s) de UTI (CNES, acesso de alta complexidade).`
        : "Presença de hospital (CNES); acesso efetivo exige leito de UTI.",
    },
    {
      rotuloComum: "Ensino superior",
      valor: municipio.tem_ies ? (ac ? (ac.presencial ? "presencial" : "só EAD") : "sim") : "não",
      termoTecnico: ac?.presencial
        ? `${ac.n_cursos_presenciais} curso(s) de graduação presencial (INEP).`
        : "Presença de IES (INEP); acesso efetivo exige curso presencial, não só EAD.",
    },
    {
      rotuloComum: "Banco",
      valor: ac ? (ac.agencia ? "agência" : ac.correspondente ? "só correspondente" : "não") : "-",
      termoTecnico: ac?.agencia
        ? `${ac.n_agencias} agência(s) bancária(s) (BACEN); acesso pleno.`
        : "Correspondente presta caixa básico; sem agência, não há estrutura de crédito local.",
    },
  ];

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!raiz) return;
    const inicial = new Set<string>([raiz.codigo]);
    for (const f of raiz.filhos) inicial.add(f.codigo);
    setExpandidos(inicial);
  }, [raiz]);
  const alternar = (codigo: string) =>
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(codigo)) proximo.delete(codigo);
      else proximo.add(codigo);
      return proximo;
    });

  // Focus trap: focus the dialog on open, cycle Tab within it, restore focus on
  // close. Escape closes and is stopped from bubbling so the global Escape
  // handler (which clears the selection) never fires: closing keeps the city.
  useEffect(() => {
    const el = dialogoRef.current;
    if (!el) return;
    const anterior = document.activeElement as HTMLElement | null;
    el.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
        return;
      }
      if (e.key !== "Tab") return;
      const focaveis = el.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    el.addEventListener("keydown", aoTeclar);
    return () => {
      el.removeEventListener("keydown", aoTeclar);
      anterior?.focus?.();
    };
  }, [onFechar]);

  // Scroll the requested section into view on open.
  useEffect(() => {
    if (!secaoInicial) return;
    const alvo = corpoRef.current?.querySelector(`#detalhe-${secaoInicial}`);
    alvo?.scrollIntoView({ block: "start" });
  }, [secaoInicial]);

  return (
    <div
      className="detalhe-fundo"
      onClick={onFechar}
      role="presentation"
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal
        aria-label={`Detalhe de ${municipio.nome} (${municipio.uf})`}
        tabIndex={-1}
        className="detalhe-moldura"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="detalhe-cabecalho">
          <div>
            <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>
              {municipio.nome}{" "}
              <span style={{ color: "var(--ink-muted)" }}>({municipio.uf})</span>
            </h2>
            <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
              {ROTULO_TIPOLOGIA[municipio.tipologia]} · porte{" "}
              {rotuloPorte(municipio.porte_faixa)} ·{" "}
              {formatarInteiro.format(municipio.populacao)} hab
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar detalhe"
            className="detalhe-fechar"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div ref={corpoRef} className="detalhe-corpo">
          {vista === "resumo" ? (
          <>
          <LeituraRelatorio interpretacao={interpretacao} />
          <div className="detalhe-colunas">
            <div className="detalhe-coluna">
              <Secao id="detalhe-grau" titulo="Grau de dependência">
                <Linha rotulo="IDM" valor={formatarIdm(municipio.idm)} />
                <p style={textoCorpo}>{faixaPercentilica(municipio.idm_percentil)}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
                  <BarraEixo rotulo="Orbitação" valor={municipio.eixo_orbitacao} />
                  <BarraEixo rotulo="Fiscal" valor={municipio.eixo_fiscal} />
                  <BarraEixo rotulo="Serviços" valor={municipio.eixo_servicos} />
                </div>
                <p style={textoNota}>
                  O IDM (0 a 1) é a média destes três eixos; o mais alto é o que
                  mais puxa a dependência. Dependência alta não é nota de gestão.
                </p>
              </Secao>

              <Secao titulo="Para onde a vida vai">
                {polo && (
                  <Linha
                    rotulo="Polo"
                    valor={`${polo.nome} (${polo.uf})${municipio.distancia_polo_km ? `, ${formatarInteiro.format(Math.round(municipio.distancia_polo_km))} km` : ""}`}
                  />
                )}
                <Linha
                  rotulo="Quem depende"
                  valor={
                    orbitantes.length > 0
                      ? `${orbitantes.length} · ${formatarInteiro.format(populacaoOrbitantes)} hab`
                      : "nenhum diretamente"
                  }
                />
              </Secao>

              <Secao titulo="O que a cidade tem, e o que ela acessa">
                <Linha
                  rotulo="Hospital"
                  valor={municipio.tem_hospital_mac ? (ac ? (ac.uti ? "com UTI" : "sem UTI") : "sim") : "não"}
                />
                <Linha
                  rotulo="Ensino superior"
                  valor={municipio.tem_ies ? (ac ? (ac.presencial ? "presencial" : "só EAD") : "sim") : "não"}
                />
                <Linha
                  rotulo="Banco"
                  valor={ac ? (ac.agencia ? "agência" : ac.correspondente ? "só correspondente" : "não") : "-"}
                />
              </Secao>
            </div>

            <div className="detalhe-coluna">
              <Secao id="detalhe-fiscal" titulo="Eixo fiscal">
                <Linha rotulo="Repasse da União (FPM)" valor={`${formatarPercentual(municipio.razao_fpm_receita)} da receita`} />
                <Linha rotulo="Prefeitura x PIB" valor={`${municipio.razao_receita_pib.toFixed(1).replace(".", ",")}x`} />
                <Linha rotulo="Supera o próprio PIB" valor={superaPib ? "sim" : "não"} />
                <Linha rotulo="Quadrante (vs porte)" valor={quadranteFiscal(municipio, cortesPorte).rotulo} />
                <ReguaFiscal valor={municipio.razao_receita_pib} />
              </Secao>

              <Secao id="detalhe-ranking" titulo="Posição no ranking">
                <p style={textoCorpo}>{faixaPercentilica(municipio.idm_percentil)}</p>
                <ReguaIdm valor={municipio.idm} />
                <p style={textoNota}>
                  Sem pódio: a régua mostra onde a cidade cai no eixo do IDM
                  nacional, não uma colocação.
                </p>
              </Secao>
            </div>
          </div>

          <Secao id="detalhe-rede" titulo="Rede de dependência">
            {cadeia.length > 0 && (
              <p style={{ ...textoCorpo, marginBottom: "var(--space-2)" }}>
                <span style={{ color: "var(--ink-muted)" }}>orbita: </span>
                {cadeia.map((p) => `${p.nome} (${p.uf})`).join(" · ")}
              </p>
            )}
            {raiz && raiz.totalDescendentes > 0 ? (
              <DendrogramaRede raiz={raiz} expandidos={expandidos} onAlternar={alternar} />
            ) : (
              <p style={textoNota}>
                Nenhum município depende diretamente desta cidade; ela é uma
                folha da rede.
              </p>
            )}
          </Secao>
          </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-3) 0" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Link to={rotaDaVista(vista, municipio.codigo_ibge)} style={{ fontSize: "var(--text-body)" }}>
                  abrir em tela cheia
                </Link>
              </div>

              {vista === "perfil" && (
                <>
                  <BlocoHeroiIDM idm={municipio.idm} percentil={municipio.idm_percentil} mediana={mediana} />
                  <GrupoStat titulo="Para onde a vida vai" tiles={grupo1} fonte={fonteSelo} />
                  <GrupoStat titulo="Quem paga a prefeitura" tiles={grupo2} fonte={fonteSelo} />
                  <GrupoStat titulo="O que a cidade tem, e o que ela acessa" tiles={grupo3} fonte={fonteAcesso} />
                  <section aria-label="Órbita do município" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <h3 className="rotulo-secao">Órbita</h3>
                    <EgoGraphOrbita
                      municipio={municipio.codigo_ibge}
                      ligacoes={ligacoes}
                      modo={municipio.tipologia === "polo" ? "ambos" : "saida"}
                    />
                  </section>
                </>
              )}

              {vista === "fiscal" && (
                <>
                  <DispersaoFiscal dados={municipios} rotuloFiltro="todos os portes" destaque={municipio.codigo_ibge} cortesPorte={cortesPorte} />
                  <SankeyOrcamento
                    municipio={municipio.codigo_ibge}
                    nomeMunicipio={municipio.nome}
                    ufMunicipio={municipio.uf}
                    entradas={entradasDeReceita(municipio)}
                    composicaoReferencia={composicaoReferencia}
                    saidas={[]}
                    porteReferencia={municipio.porte_faixa}
                  />
                </>
              )}

              {vista === "ranking" && (
                <TabelaRanking dados={municipios} agruparPor="tipologia" busca="" municipioSelecionado={municipio.codigo_ibge} />
              )}
            </div>
          )}
        </div>

        <footer className="detalhe-rodape">
          <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
            {manifesto
              ? `fonte: REGIC (IBGE) · IDM v${manifesto.idm_versao}`
              : "fonte: REGIC (IBGE) · IDM"}
          </span>
          <nav aria-label="Trocar a vista da moldura" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
            <BotaoVista ativo={vista === "resumo"} onClick={() => setVista("resumo")}>detalhe completo</BotaoVista>
            <BotaoVista ativo={vista === "perfil"} onClick={() => setVista("perfil")}>perfil</BotaoVista>
            <BotaoVista ativo={vista === "fiscal"} onClick={() => setVista("fiscal")}>eixo fiscal</BotaoVista>
            <BotaoVista ativo={vista === "ranking"} onClick={() => setVista("ranking")}>ranking</BotaoVista>
            <button
              type="button"
              className="botao-relatorio"
              onClick={() => window.print()}
              title="Gera um relatório de uma página desta cidade para salvar em PDF ou imprimir"
            >
              <Printer size={16} aria-hidden /> Baixar relatório
            </button>
          </nav>
        </footer>
      </div>
    </div>
  );
}

const textoCorpo = {
  margin: 0,
  fontSize: "var(--text-body)",
  color: "var(--ink-secondary)",
} as const;

const textoNota = {
  margin: 0,
  fontSize: "var(--text-caption)",
  color: "var(--ink-muted)",
} as const;

// Footer control that switches the overlay to a full dimension view (perfil,
// eixo fiscal, ranking) in place, instead of navigating to the route.
function BotaoVista({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: "var(--text-body)",
        color: ativo ? "var(--ink-primary)" : "var(--accent)",
        textDecoration: ativo ? "none" : "underline",
        fontWeight: ativo ? "var(--weight-title)" : "var(--weight-body)",
      }}
    >
      {children}
    </button>
  );
}

function Secao({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section
      id={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        padding: "var(--space-3) 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <h3 className="rotulo-secao">{titulo}</h3>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", fontSize: "var(--text-body)" }}>
      <span style={{ color: "var(--ink-secondary)" }}>{rotulo}</span>
      <span className="tabular" style={{ color: "var(--ink-primary)", textAlign: "right" }}>{valor}</span>
    </div>
  );
}

function BarraEixo({ rotulo, valor }: { rotulo: string; valor: number }) {
  const pct = Math.max(0, Math.min(1, valor)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-caption)" }}>
      <span style={{ flex: "0 0 68px", color: "var(--ink-secondary)" }}>{rotulo}</span>
      <span aria-hidden style={{ flex: 1, height: "6px", borderRadius: "var(--radius-full)", background: "var(--gridline)", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
      </span>
      <span className="tabular" style={{ flex: "0 0 auto", color: "var(--ink-primary)" }}>{formatarIdm(valor)}</span>
    </div>
  );
}

// IDM ruler: the spectral ramp with a marker at the city's value, echoing the
// map legend (blue = less dependent, red = more).
function ReguaIdm({ valor }: { valor: number }) {
  const pct = Math.max(0, Math.min(1, valor)) * 100;
  return (
    <div style={{ marginTop: "var(--space-1)" }}>
      <div style={{ position: "relative", height: "var(--space-2)", borderRadius: "var(--radius-full)", background: "linear-gradient(90deg, var(--idm-100), var(--idm-450), var(--idm-700))" }}>
        <span aria-hidden style={marcador(pct)} />
      </div>
      <div style={reguaLegenda}>
        <span>autossuficiente</span>
        <span>orbitante</span>
      </div>
    </div>
  );
}

// Fiscal ruler: revenue/GDP on a divergent track, neutral where revenue equals
// GDP; the marker sits left (below own GDP) or right (above).
function ReguaFiscal({ valor }: { valor: number }) {
  const pct = Math.max(0, Math.min(1, valor / 2)) * 100;
  return (
    <div style={{ marginTop: "var(--space-1)" }}>
      <div style={{ position: "relative", height: "var(--space-2)", borderRadius: "var(--radius-full)", background: "linear-gradient(90deg, var(--fiscal-cold), var(--fiscal-neutral), var(--fiscal-hot))" }}>
        <span aria-hidden style={marcador(pct)} />
      </div>
      <div style={reguaLegenda}>
        <span>abaixo do PIB</span>
        <span>receita = PIB</span>
        <span>acima do PIB</span>
      </div>
    </div>
  );
}

function marcador(pct: number) {
  return {
    position: "absolute" as const,
    top: "-3px",
    left: `${pct}%`,
    transform: "translateX(-50%)",
    width: "var(--space-3)",
    height: "var(--space-3)",
    borderRadius: "var(--radius-full)",
    background: "var(--surface-1)",
    border: "2px solid var(--ink-primary)",
  };
}

const reguaLegenda = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "var(--space-1)",
  fontSize: "var(--text-caption)",
  color: "var(--ink-muted)",
} as const;
