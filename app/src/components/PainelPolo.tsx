import { Printer, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { carregarAcesso, formatarPercentual, rotuloPorte } from "../lib/data";
import type { AcessoMunicipio } from "../lib/data";
import { useInterpretacao } from "../lib/interpretacao";
import { ComparacaoPares } from "./ComparacaoPares";
import { LeituraFatia } from "./LeituraAutomatica";
import type { Ligacao, Municipio } from "../lib/types";
import type { SecaoDetalhe } from "./DetalheMunicipio";

interface PainelPoloProps {
  municipio: Municipio;
  // Full national list, used to resolve the population of each orbitante
  // that links into this municipio (ligacoes only carries codigo_ibge pairs).
  municipios: Municipio[];
  ligacoes: Ligacao[];
  onFechar: () => void;
  // Opens the consolidated detail overlay (DetalheMunicipio) at a section,
  // instead of navigating away from the map.
  onAbrirDetalhe: (secao?: SecaoDetalhe) => void;
}

const formatarInteiro = new Intl.NumberFormat("pt-BR");

const ROTULO_TIPOLOGIA_PAINEL: Record<Municipio["tipologia"], string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

// Percentile band, never ordinal position (docs/DECISAO_UX.md, "ranking sem
// pódio"). Mirrors the private helper of the same name in TabelaRanking.tsx;
// duplicated here rather than exported from that file, which is out of scope
// for this redesign (only routes/mapa.tsx, MapaOrbitas, EgoGraphOrbita and
// this new component may change).
function faixaPercentilica(percentil: number): string {
  if (percentil >= 0.75) return "entre os 25% mais dependentes";
  if (percentil >= 0.5) return "entre 25% e 50% mais dependentes";
  if (percentil >= 0.25) return "entre 50% e 75% mais dependentes";
  return "entre os 25% menos dependentes";
}

// Side panel revealed by a click on a polo/semi-polo point, on any other
// municipio's fill, or by a search selection (Tela 1, routes/mapa.tsx). It
// replaces the previous behavior of navigating straight to the profile on map
// click: the click now only selects, and "ver perfil completo" is the single
// explicit path onward (docs/DECISAO_UX.md). The fiscal figures are the same
// descriptive ratios shown on Tela 2 and Tela 3, framed by porte rather than
// the national average, and money is never drawn as a line on the map
// (docs/DECISAO_CAUSAL.md, "dinheiro não é seta no mapa"); the panel only adds
// numbers beside the ego-graph the map already draws.
export function PainelPolo({
  municipio,
  municipios,
  ligacoes,
  onFechar,
  onAbrirDetalhe,
}: PainelPoloProps) {
  const painelRef = useRef<HTMLElement | null>(null);
  const interpretacao = useInterpretacao(municipio.codigo_ibge);
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
  const ac = acesso?.get(municipio.codigo_ibge);

  // Moves focus into the panel every time it mounts or the selection changes,
  // so a keyboard or screen-reader user lands on the newly revealed content
  // instead of having to hunt for it (accessibility requirement).
  useEffect(() => {
    painelRef.current?.focus();
  }, [municipio.codigo_ibge]);

  const porCodigo = useMemo(
    () => new Map(municipios.map((m) => [m.codigo_ibge, m] as const)),
    [municipios],
  );
  const orbitantes = useMemo(
    () =>
      ligacoes
        .filter((l) => l.destino_ibge === municipio.codigo_ibge)
        .map((l) => porCodigo.get(l.origem_ibge))
        .filter((m): m is Municipio => m != null),
    [porCodigo, ligacoes, municipio.codigo_ibge],
  );

  // The city's own polo (where its life goes), resolved for the outgoing side
  // of the summary; polos have polo_ibge null and skip this line.
  const polo =
    municipio.polo_ibge != null ? porCodigo.get(municipio.polo_ibge) : undefined;
  const populacaoOrbitantes = orbitantes.reduce((soma, m) => soma + m.populacao, 0);
  const superaPib = municipio.razao_receita_pib > 1;

  return (
    <aside
      ref={painelRef}
      role="region"
      aria-label={`Resumo de ${municipio.nome} (${municipio.uf})`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onFechar();
      }}
      style={{
        flex: "0 1 340px",
        minWidth: "260px",
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-2)",
        }}
      >
        <div>
          <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>
            {municipio.nome}{" "}
            <span style={{ color: "var(--ink-muted)" }}>({municipio.uf})</span>
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-caption)",
              color: "var(--ink-muted)",
            }}
          >
            {ROTULO_TIPOLOGIA_PAINEL[municipio.tipologia]} · porte{" "}
            {rotuloPorte(municipio.porte_faixa)} ·{" "}
            {formatarInteiro.format(municipio.populacao)} hab
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar painel"
          style={{
            display: "inline-flex",
            background: "transparent",
            border: "none",
            padding: "var(--space-1)",
            color: "var(--ink-secondary)",
          }}
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      <LeituraFatia texto={interpretacao?.telas.mapa} />

      <SecaoPainel titulo="Rede urbana">
        {polo && (
          <p style={estiloTextoCorpo}>
            Para onde a vida vai: orbita{" "}
            <strong style={{ color: "var(--ink-primary)" }}>
              {polo.nome} ({polo.uf})
            </strong>
            {municipio.distancia_polo_km
              ? `, a ${formatarInteiro.format(Math.round(municipio.distancia_polo_km))} km`
              : ""}
            .
          </p>
        )}
        <p style={estiloTextoCorpo}>
          {orbitantes.length > 0
            ? `Quem depende: ${orbitantes.length} município(s) orbitam esta cidade, somando ${formatarInteiro.format(populacaoOrbitantes)} habitantes.`
            : "Nenhum município orbita esta cidade diretamente."}
        </p>
        {(polo || orbitantes.length > 0) && (
          <p style={{ ...estiloTextoNota, display: "flex", flexWrap: "wrap", gap: "var(--space-1) var(--space-3)" }}>
            <span>No mapa:</span>
            {orbitantes.length > 0 && (
              <span>
                <AmostraSeta cor="var(--accent)" /> quem depende desta cidade
              </span>
            )}
            {polo && (
              <span>
                <AmostraSeta cor="var(--ink-primary)" /> de quem ela depende
              </span>
            )}
          </p>
        )}
      </SecaoPainel>

      <SecaoPainel titulo="Eixo fiscal">
        <LinhaPainel
          rotulo="Repasse da União (FPM)"
          valor={`${formatarPercentual(municipio.razao_fpm_receita)} da receita`}
        />
        <LinhaPainel
          rotulo="Prefeitura x PIB"
          valor={`${municipio.razao_receita_pib.toFixed(1).replace(".", ",")}x (receita/PIB)`}
        />
        <LinhaPainel rotulo="Supera o próprio PIB" valor={superaPib ? "sim" : "não"} />
        {superaPib && (
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-caption)",
              color: "var(--ink-muted)",
            }}
          >
            Isso descreve o tamanho da economia local, não a qualidade da
            prefeitura; a comparação correta é sempre por porte, nunca pela
            média nacional.
          </p>
        )}
      </SecaoPainel>

      <SecaoPainel titulo="Serviços">
        <LinhaPainel
          rotulo="Hospital"
          valor={municipio.tem_hospital_mac ? (ac ? (ac.uti ? "com UTI" : "sem UTI") : "sim") : "não"}
        />
        <LinhaPainel
          rotulo="Ensino superior"
          valor={municipio.tem_ies ? (ac ? (ac.presencial ? "presencial" : "só EAD") : "sim") : "não"}
        />
        <LinhaPainel
          rotulo="Banco"
          valor={ac ? (ac.agencia ? "agência" : ac.correspondente ? "só correspondente" : "não") : "-"}
        />
        <p style={estiloTextoNota}>
          Não basta existir o equipamento; o que pesa é o acesso: leito de UTI,
          curso presencial e agência, não só o correspondente.
        </p>
      </SecaoPainel>

      <SecaoPainel titulo="Grau de dependência estrutural">
        <LinhaPainel rotulo="IDM" valor={municipio.idm.toFixed(2).replace(".", ",")} />
        <p style={estiloTextoCorpo}>{faixaPercentilica(municipio.idm_percentil)}</p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
            marginTop: "var(--space-1)",
          }}
        >
          <BarraEixo rotulo="Orbitação" valor={municipio.eixo_orbitacao} />
          <BarraEixo rotulo="Fiscal" valor={municipio.eixo_fiscal} />
          <BarraEixo rotulo="Serviços" valor={municipio.eixo_servicos} />
        </div>
        <p style={estiloTextoNota}>
          O IDM (0 a 1) é a média destes três eixos; o mais alto é o que mais
          puxa a dependência.
        </p>
        <p style={estiloTextoNota}>
          Dependência alta não é nota baixa de gestão; reflete a posição da
          cidade na rede urbana e as regras de repasse federais.
        </p>
      </SecaoPainel>

      <SecaoPainel titulo="Frente ao mesmo porte">
        <ComparacaoPares municipio={municipio} municipios={municipios} compacto />
      </SecaoPainel>

      <nav
        aria-label={`Ações para ${municipio.nome}`}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2) var(--space-4)" }}
      >
        <BotaoDetalhe onClick={() => onAbrirDetalhe()}>ver detalhe completo</BotaoDetalhe>
        <button
          type="button"
          className="botao-relatorio"
          onClick={() => window.print()}
          title="Gera um relatório de uma página desta cidade para salvar em PDF ou imprimir"
        >
          <Printer size={16} aria-hidden /> Baixar relatório
        </button>
      </nav>
    </aside>
  );
}

// Legend swatch for the map's ego-graph edges, in the same tokens the map uses
// (EgoGraphOrbita), so it follows the theme without naming a color.
function AmostraSeta({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "18px",
        height: "3px",
        marginRight: "4px",
        verticalAlign: "middle",
        borderRadius: "2px",
        background: cor,
      }}
    />
  );
}

const estiloTextoCorpo = {
  margin: 0,
  fontSize: "var(--text-body)",
  color: "var(--ink-secondary)",
} as const;

const estiloTextoNota = {
  margin: 0,
  fontSize: "var(--text-caption)",
  color: "var(--ink-muted)",
} as const;

// One axis of the IDM as a compact bar: the label, a neutral track filled to
// the axis value, and the value as text (the track is aria-hidden, the number
// carries the reading). Fill is the single accent, never the IDM ramp, so the
// three bars do not read as a second dependency color channel.
function BarraEixo({ rotulo, valor }: { rotulo: string; valor: number }) {
  const pct = Math.max(0, Math.min(1, valor)) * 100;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-caption)",
      }}
    >
      <span style={{ flex: "0 0 68px", color: "var(--ink-secondary)" }}>{rotulo}</span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: "6px",
          borderRadius: "var(--radius-full)",
          background: "var(--gridline)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent)",
          }}
        />
      </span>
      <span
        className="tabular"
        style={{ flex: "0 0 auto", color: "var(--ink-primary)" }}
      >
        {valor.toFixed(2).replace(".", ",")}
      </span>
    </div>
  );
}

// Link-styled button: opens the consolidated detail overlay instead of
// navigating, so the reader never leaves the map.
function BotaoDetalhe({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        alignSelf: "flex-start",
        background: "transparent",
        border: "none",
        padding: 0,
        color: "var(--accent)",
        fontSize: "var(--text-body)",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SecaoPainel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
    >
      <h3 className="rotulo-secao">{titulo}</h3>
      {children}
    </section>
  );
}

function LinhaPainel({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--space-2)",
        fontSize: "var(--text-body)",
      }}
    >
      <span style={{ color: "var(--ink-secondary)" }}>{rotulo}</span>
      <span className="tabular" style={{ color: "var(--ink-primary)" }}>
        {valor}
      </span>
    </div>
  );
}
