import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BuscaMunicipio,
  EstadoCarregando,
  EstadoVazio,
  SeloFonte,
} from "../components";
import { DendrogramaRede, TabelaRede } from "../components/DendrogramaRede";
import { carregarLigacoes, carregarManifesto, carregarMunicipios } from "../lib/data";
import { useSelecao } from "../lib/selecao";
import {
  cadeiaAscendente,
  construirArvore,
  indexarFilhos,
  type NoRede,
} from "../lib/rede";
import type { FonteRef, Ligacao, Manifesto, Municipio } from "../lib/types";

// Tela de rede: the dependency network of a municipality as a dendrogram, the
// multi-hop hierarchy the map's ego-graph (first hop only) cannot show. Reached
// from PainelPolo and the profile via "ver a rede completa". The tree of
// descendants is built from the REGIC links (see lib/rede); the chain up to the
// top of the hierarchy is the breadcrumb.
export default function RedeRoute() {
  const { codigoIbge } = useParams<{ codigoIbge: string }>();
  const navigate = useNavigate();
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const { selecionar } = useSelecao();

  // Keep the shared selection in sync with the network being viewed.
  useEffect(() => {
    if (codigoIbge) selecionar(codigoIbge);
  }, [codigoIbge, selecionar]);

  useEffect(() => {
    let vivo = true;
    Promise.all([carregarMunicipios(), carregarLigacoes(), carregarManifesto()])
      .then(([m, l, man]) => {
        if (!vivo) return;
        setMunicipios(m);
        setLigacoes(l);
        setManifesto(man);
      })
      .catch(() => vivo && setMunicipios([]));
    return () => {
      vivo = false;
    };
  }, []);

  const porCodigo = useMemo(
    () => new Map((municipios ?? []).map((m) => [m.codigo_ibge, m] as const)),
    [municipios],
  );
  const filhosPorDestino = useMemo(() => indexarFilhos(ligacoes), [ligacoes]);

  const raiz: NoRede | null = useMemo(() => {
    if (!codigoIbge || porCodigo.size === 0) return null;
    return construirArvore(codigoIbge, porCodigo, filhosPorDestino);
  }, [codigoIbge, porCodigo, filhosPorDestino]);

  const cadeia = useMemo(
    () => (codigoIbge ? cadeiaAscendente(codigoIbge, porCodigo) : []),
    [codigoIbge, porCodigo],
  );

  // Open the first two levels by default, and reset when the root changes.
  useEffect(() => {
    if (!raiz) return;
    const inicial = new Set<string>([raiz.codigo]);
    for (const filho of raiz.filhos) inicial.add(filho.codigo);
    setExpandidos(inicial);
  }, [raiz]);

  const alternar = (codigo: string) =>
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(codigo)) proximo.delete(codigo);
      else proximo.add(codigo);
      return proximo;
    });

  if (!codigoIbge) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <h1 style={{ fontSize: "var(--text-xl)" }}>Rede de dependência</h1>
        <BuscaMunicipio onSelect={(c) => navigate(`/rede/${c}`)} />
        <EstadoVazio mensagem="Busque uma cidade para ver a rede de quem depende dela." />
      </div>
    );
  }

  if (municipios === null || manifesto === null) {
    return <EstadoCarregando rotulo="Carregando a rede" />;
  }

  if (!raiz) {
    return (
      <EstadoVazio
        titulo="Município não encontrado"
        mensagem="Não há dado válido para o código informado."
        acao={<Link to="/rede">Buscar outra cidade</Link>}
      />
    );
  }

  const fonte = fonteRegic(manifesto.fontes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Link
          to={`/municipio/${raiz.codigo}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            color: "var(--ink-secondary)",
            fontSize: "var(--text-body)",
          }}
        >
          <ArrowLeft size={16} aria-hidden /> perfil
        </Link>
        <h1 style={{ fontSize: "var(--text-xl)", marginInlineStart: "auto" }}>
          Rede de {raiz.nome} ({raiz.uf})
        </h1>
      </div>

      {cadeia.length > 0 && (
        <nav
          aria-label="Para onde a vida vai, subindo a hierarquia"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
            flexWrap: "wrap",
            fontSize: "var(--text-body)",
            color: "var(--ink-secondary)",
          }}
        >
          <span style={{ color: "var(--ink-muted)" }}>orbita:</span>
          {cadeia.map((polo, i) => (
            <span key={polo.codigo_ibge} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
              {i > 0 && <ChevronRight size={14} aria-hidden style={{ color: "var(--ink-muted)" }} />}
              <Link to={`/rede/${polo.codigo_ibge}`}>
                {polo.nome} ({polo.uf})
              </Link>
            </span>
          ))}
        </nav>
      )}

      <p style={{ margin: 0, color: "var(--ink-secondary)", fontSize: "var(--text-body)" }}>
        {raiz.totalDescendentes > 0
          ? `${raiz.totalDescendentes} município(s) dependem desta cidade, direta ou indiretamente. Clique um nó com dependentes para abrir ou fechar o ramo.`
          : "Nenhum município depende diretamente desta cidade; ela é uma folha da rede. A cadeia acima mostra para onde a vida dela vai."}
      </p>

      <BuscaMunicipio onSelect={(c) => navigate(`/rede/${c}`)} />

      {raiz.totalDescendentes > 0 ? (
        <>
          <DendrogramaRede raiz={raiz} expandidos={expandidos} onAlternar={alternar} />
          {/* Same tree as an accessible, keyboard-operable equivalent for screen
              readers, sharing the expand state with the visible graphic. */}
          <div className="visually-hidden">
            <TabelaRede raiz={raiz} expandidos={expandidos} onAlternar={alternar} />
          </div>
        </>
      ) : (
        <EstadoVazio mensagem="Sem dependentes para desenhar. Busque um polo para ver uma rede." />
      )}

      <SeloFonte fonte={rotuloFonte(fonte)} dataExtracao={fonte.data_extracao} />
    </div>
  );
}

// REGIC is the source of the links and the hierarchy; falls back to the first
// manifest source if it is ever renamed or missing.
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

function rotuloFonte(fonte: FonteRef): string {
  return fonte.orgao ? `${fonte.nome} (${fonte.orgao})` : fonte.nome;
}
