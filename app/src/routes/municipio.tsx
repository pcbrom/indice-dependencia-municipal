import { rotuloPolo } from "../lib/rede";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DOI_CONCEITO } from "../App";
import { RelatorioMunicipio } from "../components/RelatorioMunicipio";
import {
  BlocoHeroiIDM,
  BuscaMunicipio,
  EgoGraphOrbita,
  EstadoCarregando,
  EstadoVazio,
  GrupoStat,
} from "../components";
import {
  carregarAcesso,
  carregarLigacoes,
  carregarManifesto,
  carregarMunicipios,
  formatarPercentual,
  medianaIdm,
} from "../lib/data";
import type { AcessoMunicipio } from "../lib/data";
import { useSelecao } from "../lib/selecao";
import { useInterpretacao } from "../lib/interpretacao";
import { LeituraRelatorio } from "../components/LeituraAutomatica";
import type { FonteRef, Ligacao, Manifesto, Municipio } from "../lib/types";
import type { StatTileProps } from "../components/StatTile";

// Tela 2: municipality profile. First fold is only the hero block; the stats
// descend, one line each, grouped by citizen question (see docs/DECISAO_UX.md).
export default function MunicipioRoute() {
  const { codigoIbge } = useParams<{ codigoIbge: string }>();
  const navigate = useNavigate();
  const { codigo: codigoFoco, selecionar } = useSelecao();
  const interpretacao = useInterpretacao(codigoIbge);
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [acesso, setAcesso] = useState<Map<string, AcessoMunicipio> | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      carregarMunicipios(),
      carregarLigacoes(),
      carregarManifesto(),
    ])
      .then(([m, l, man]) => {
        if (!vivo) return;
        setMunicipios(m);
        setLigacoes(l);
        setManifesto(man);
      })
      .catch(() => vivo && setMunicipios([]));
    // Access layer loads independently; the profile still renders if it is slow
    // or absent, the "o que a cidade tem" group simply falls back to presence.
    carregarAcesso()
      .then((a) => vivo && setAcesso(a))
      .catch(() => vivo && setAcesso(new Map()));
    return () => {
      vivo = false;
    };
  }, []);

  // Keep the shared selection in sync with the profile being viewed, and when
  // the tab is opened with no code, fall back to the focused city instead of
  // the search prompt (cross-tab persistence, lib/selecao).
  useEffect(() => {
    if (codigoIbge) selecionar(codigoIbge);
  }, [codigoIbge, selecionar]);
  useEffect(() => {
    if (!codigoIbge && codigoFoco) {
      navigate(`/municipio/${codigoFoco}`, { replace: true });
    }
  }, [codigoIbge, codigoFoco, navigate]);

  if (!codigoIbge) {
    return (
      <>
      <div className="faixa-tela">
        <div className="mapa-cab-busca">
          <BuscaMunicipio onSelect={(c) => navigate(`/municipio/${c}`)} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <EstadoVazio mensagem="Busque a sua cidade para ver o caso dela: de quem depende, o que lhe falta e o que o gestor pode examinar." />
      </div>
      </>
    );
  }

  if (municipios === null || manifesto === null) {
    return <EstadoCarregando rotulo="Carregando o perfil" />;
  }

  const m = municipios.find((x) => x.codigo_ibge === codigoIbge);
  if (!m) {
    return (
      <EstadoVazio
        titulo="Município não encontrado"
        mensagem="Não há dado válido para o código informado."
        acao={<Link to="/municipio">Buscar outra cidade</Link>}
      />
    );
  }

  const polo = m.polo_ibge
    ? municipios.find((x) => x.codigo_ibge === m.polo_ibge)
    : undefined;
  const mediana = medianaIdm(municipios);
  const fonte = fonteOuFallback(manifesto.fontes);

  const grupo1: StatTileProps[] = [
    {
      rotuloComum: `Polo: ${rotuloPolo(m, polo)}`,
      valor:
        m.distancia_polo_km != null ? formatarKm(m.distancia_polo_km) : "0 km",
    },
  ];
  const grupo2: StatTileProps[] = [
    {
      rotuloComum: "Repasse da União",
      valor: formatarPercentual(m.razao_fpm_receita),
      termoTecnico:
        "Participação do FPM na receita total do município (f-1). Proporção entre 0 e 1.",
    },
    {
      rotuloComum: "Prefeitura x PIB",
      valor: `${m.razao_receita_pib.toFixed(1).replace(".", ",")}x`,
      termoTecnico:
        "Razão entre a receita municipal e o PIB local (f-2). Acima de 1x a prefeitura movimenta mais do que a cidade produz.",
    },
  ];
  // Effective access beside presence (see docs/DECISAO_ACESSO.md): a hospital
  // counts when there is UTI, a college when there is an in-person course, a
  // bank when there is a branch, not only a correspondent. Falls back to the
  // binary presence while the access layer loads.
  const ac = acesso?.get(codigoIbge);
  // The access group draws from CNES, INEP and BACEN, not from the REGIC/first
  // source used by the other groups; cite them so every figure stays traceable.
  const fonteAcesso = fonteDe(manifesto.fontes, ["CNES", "Cadastro de IES (e-MEC)", "ESTBAN"], {
    nome: "CNES, INEP e BACEN",
    orgao: "DATASUS, INEP/MEC, Banco Central",
  });
  const grupo3: StatTileProps[] = [
    {
      rotuloComum: "Hospital",
      valor: m.tem_hospital_mac ? (ac ? (ac.uti ? "com UTI" : "sem UTI") : "sim") : "não",
      termoTecnico: ac?.uti
        ? `Hospital com ${ac.uti_leitos} leito(s) de UTI (CNES, acesso de alta complexidade).`
        : "Presença de hospital (CNES); acesso efetivo exige leito de UTI.",
    },
    {
      rotuloComum: "Ensino superior",
      valor: m.tem_ies ? (ac ? (ac.presencial ? "presencial" : "só EAD") : "sim") : "não",
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

  return (
    <>
    <div className="faixa-tela">
      <div className="mapa-cab-busca">
        <BuscaMunicipio onSelect={(c) => navigate(`/municipio/${c}`)} />
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            color: "var(--ink-secondary)",
            fontSize: "var(--text-body)",
          }}
        >
          <ArrowLeft size={16} aria-hidden /> voltar
        </Link>
        <h1 style={{ fontSize: "var(--text-xl)", marginInlineStart: "auto" }}>
          {m.nome} ({m.uf})
        </h1>
        <button
          type="button"
          className="botao-relatorio"
          onClick={() => window.print()}
          title="Gera um relatório de uma página desta cidade para salvar em PDF ou imprimir"
        >
          <Printer size={16} aria-hidden /> Baixar relatório
        </button>
      </div>

      <BlocoHeroiIDM idm={m.idm} percentil={m.idm_percentil} mediana={mediana} />

      <LeituraRelatorio
        interpretacao={interpretacao}
        fallback={{
          m,
          poloTexto: m.tipologia === "orbitante" ? rotuloPolo(m, polo) : null,
          acesso: ac,
        }}
      />

      <GrupoStat titulo="Para onde a vida vai" tiles={grupo1} fonte={fonte} />
      <GrupoStat titulo="Quem paga a prefeitura" tiles={grupo2} fonte={fonte} />
      <GrupoStat titulo="O que a cidade tem, e o que ela acessa" tiles={grupo3} fonte={fonteAcesso} />

      <section aria-label="Órbita do município">
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Órbita</h2>
          <Link to={`/rede/${m.codigo_ibge}`} style={{ fontSize: "var(--text-body)" }}>
            ver a rede completa
          </Link>
        </div>
        <EgoGraphOrbita
          municipio={m.codigo_ibge}
          ligacoes={ligacoes}
          modo={m.tipologia === "polo" ? "ambos" : "saida"}
        />
      </section>

      <DecomposicaoIDM
        orbitacao={m.eixo_orbitacao}
        fiscal={m.eixo_fiscal}
        servicos={m.eixo_servicos}
      />
    </div>
    <RelatorioMunicipio m={m} municipios={municipios} doi={DOI_CONCEITO} />
    </>
  );
}

function DecomposicaoIDM({
  orbitacao,
  fiscal,
  servicos,
}: {
  orbitacao: number;
  fiscal: number;
  servicos: number;
}) {
  const eixos: { rotulo: string; valor: number }[] = [
    { rotulo: "orbitação", valor: orbitacao },
    { rotulo: "fiscal", valor: fiscal },
    { rotulo: "serviços", valor: servicos },
  ];
  return (
    <section
      aria-label="Decomposição do IDM"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <h2 style={{ fontSize: "var(--text-lg)" }}>Decomposição do IDM</h2>
      {eixos.map((e) => (
        <div
          key={e.rotulo}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
        >
          <span
            style={{
              width: "6rem",
              fontSize: "var(--text-body)",
              color: "var(--ink-secondary)",
            }}
          >
            {e.rotulo}
          </span>
          <div
            aria-hidden
            style={{
              flex: 1,
              height: "var(--space-2)",
              background: "var(--gridline)",
              borderRadius: "var(--radius-full)",
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(1, e.valor)) * 100}%`,
                height: "100%",
                background: "var(--idm-500)",
                borderRadius: "var(--radius-full)",
              }}
            />
          </div>
          <span className="tabular" style={{ fontSize: "var(--text-caption)" }}>
            {e.valor.toFixed(2).replace(".", ",")}
          </span>
        </div>
      ))}
    </section>
  );
}

function fonteOuFallback(fontes: FonteRef[]): FonteRef {
  const primeira = fontes[0];
  if (primeira) return primeira;
  return {
    nome: "manifesto indisponível",
    orgao: "",
    ano: 0,
    data_extracao: "",
    url_catalogo: "",
    uso: "",
  };
}

function formatarKm(km: number): string {
  return `${km.toFixed(0)} km`;
}

// Build a source seal from the manifest entries a group actually draws from,
// keeping the latest extraction date among them; falls back to the given
// label/org when the manifest is missing those entries.
function fonteDe(
  fontes: FonteRef[],
  nomes: string[],
  rotulo: { nome: string; orgao: string },
): FonteRef {
  const usadas = fontes.filter((f) => nomes.includes(f.nome));
  const base = usadas[0] ?? fonteOuFallback(fontes);
  const dataExtracao = usadas.reduce(
    (max, f) => (f.data_extracao > max ? f.data_extracao : max),
    base.data_extracao,
  );
  return { ...base, nome: rotulo.nome, orgao: rotulo.orgao, data_extracao: dataExtracao };
}
