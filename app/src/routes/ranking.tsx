import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  EstadoCarregando,
  EstadoVazio,
  SeloFonte,
  TabelaRanking,
} from "../components";
import { ORDEM_PORTE, ordenarPorReferencia } from "../components/TabelaRanking";
import { carregarManifesto, carregarMunicipios, filtrarMunicipios, rotuloPorte } from "../lib/data";
import { useSelecao } from "../lib/selecao";
import { useInterpretacao } from "../lib/interpretacao";
import { LeituraFatia } from "../components/LeituraAutomatica";
import type { Manifesto, Municipio } from "../lib/types";

type Agrupamento = "tipologia" | "porte";

// Tela 4: IDM ranking. No podium: the first column is the percentile band, not
// the ordinal position; a fixed note separates dependence from management; the
// search for one's own city is the initial action. UF and porte narrow the
// dataset; "agrupar por" only changes how TabelaRanking organizes the rows.
export default function Ranking() {
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [porte, setPorte] = useState("");
  const [agruparPor, setAgruparPor] = useState<Agrupamento>("tipologia");
  const { codigo: codigoFoco } = useSelecao();
  const interpretacao = useInterpretacao(codigoFoco);

  useEffect(() => {
    let vivo = true;
    carregarMunicipios()
      .then((m) => vivo && setMunicipios(m))
      .catch(() => vivo && setMunicipios([]));
    return () => {
      vivo = false;
    };
  }, []);

  // Provenance of the ranking, read from the same manifest the methodology
  // screen reads (lib/data.carregarManifesto); a load failure here just
  // omits the source stamps below, it never blocks the ranking itself.
  useEffect(() => {
    let vivo = true;
    carregarManifesto()
      .then((m) => vivo && setManifesto(m))
      .catch(() => vivo && setManifesto(null));
    return () => {
      vivo = false;
    };
  }, []);

  const ufs = useMemo(() => {
    if (!municipios) return [];
    return [...new Set(municipios.map((m) => m.uf))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [municipios]);

  const portes = useMemo(() => {
    if (!municipios) return [];
    return ordenarPorReferencia(
      municipios.map((m) => m.porte_faixa),
      ORDEM_PORTE,
    );
  }, [municipios]);

  const filtrados = useMemo(() => {
    if (!municipios) return [];
    return filtrarMunicipios(municipios, {
      uf: uf || undefined,
      porte: porte || undefined,
      tipologiaAtiva: [],
    });
  }, [municipios, uf, porte]);

  if (municipios === null) {
    return <EstadoCarregando rotulo="Carregando o ranking" />;
  }
  if (municipios.length === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados de ranking"
        mensagem="Os artefatos do painel ainda não estão disponíveis neste ambiente."
      />
    );
  }

  return (
    <>
    <div className="faixa-tela">
      <label
        className="mapa-cab-busca"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
        }}
      >
        <Search size={18} aria-hidden style={{ color: "var(--ink-muted)" }} />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Encontre sua cidade"
          aria-label="Buscar cidade no ranking"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--ink-primary)",
            fontSize: "var(--text-base)",
          }}
        />
      </label>

      <div
        role="group"
        aria-label="Filtros do ranking"
        style={{
          display: "flex",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <SelectFiltro
          rotulo="UF"
          valor={uf}
          onChange={setUf}
          opcoes={[{ valor: "", rotulo: "todas" }, ...ufs.map((u) => ({ valor: u, rotulo: u }))]}
        />
        <SelectFiltro
          rotulo="Porte"
          valor={porte}
          onChange={setPorte}
          opcoes={[
            { valor: "", rotulo: "todos" },
            ...portes.map((p) => ({ valor: p, rotulo: rotuloPorte(p) })),
          ]}
        />
        <SelectFiltro
          rotulo="Agrupar por"
          valor={agruparPor}
          onChange={(v) => setAgruparPor(v as Agrupamento)}
          opcoes={[
            { valor: "tipologia", rotulo: "tipologia" },
            { valor: "porte", rotulo: "porte" },
          ]}
        />
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Fixed, always-visible anti-distortion note (docs/DECISAO_UX.md); never
          collapsed behind a tooltip or toggle, so it reads before the table. */}
      <p
        role="note"
        style={{
          color: "var(--ink-primary)",
          maxWidth: "70ch",
          margin: 0,
          padding: "var(--space-3) var(--space-4)",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
        }}
      >
        Dependência alta não é nota baixa de gestão; reflete a posição da cidade
        na rede urbana e as regras de repasse federais.
      </p>

      <LeituraFatia texto={interpretacao?.telas.ranking} rotulo="leitura do ranking" />

      <TabelaRanking
        dados={filtrados}
        agruparPor={agruparPor}
        busca={busca}
        municipioSelecionado={codigoFoco ?? undefined}
      />

      {manifesto ? (
        <section
          aria-label="Fontes do ranking"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
            paddingTop: "var(--space-2)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {manifesto.fontes.map((f) => (
            <SeloFonte key={`${f.nome}-${f.ano}`} fonte={f.nome} dataExtracao={f.data_extracao} />
          ))}
          <Link
            to="/metodologia"
            style={{ fontSize: "var(--text-caption)", color: "var(--ink-secondary)" }}
          >
            ver metodologia completa
          </Link>
        </section>
      ) : null}
    </div>
    </>
  );
}

interface OpcaoSelect {
  valor: string;
  rotulo: string;
}

// Shared label-plus-select control for the three ranking filters (UF, porte,
// agrupar por), so the three read as one pattern instead of three ad hoc markups.
function SelectFiltro({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoSelect[];
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-body)",
        color: "var(--ink-secondary)",
      }}
    >
      {rotulo}
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "var(--space-1) var(--space-2)",
          background: "var(--surface-1)",
          color: "var(--ink-primary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
          fontSize: "var(--text-body)",
        }}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
