import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DOI_CONCEITO, REPOSITORIO } from "../App";
import { EstadoCarregando, EstadoVazio, SeloFonte } from "../components";
import { ValidacaoIdmIdhm } from "../components/ValidacaoIdmIdhm";
import type { ValidacaoIdmIdhmDados } from "../components/ValidacaoIdmIdhm";
import { carregarManifesto, carregarMunicipios, carregarValidacao, formatarPercentual } from "../lib/data";
import type { Manifesto, Municipio } from "../lib/types";

// Reads a nested field from an unknown JSON value without widening to any.
// validacao.json has no declared type (see lib/data.ts, carregarValidacao),
// so every field access from it goes through this guard.
function campo(valor: unknown, chave: string): unknown {
  if (typeof valor !== "object" || valor === null) return undefined;
  return (valor as Record<string, unknown>)[chave];
}

function numero(valor: unknown): number | undefined {
  return typeof valor === "number" ? valor : undefined;
}

function booleano(valor: unknown): boolean | undefined {
  return typeof valor === "boolean" ? valor : undefined;
}

function formatarNumero(valor: number, casas = 2): string {
  return valor.toFixed(casas).replace(".", ",");
}

// Tela de metodologia, sempre acessivel a partir de qualquer tela via o link
// da barra de navegacao. Nota tecnica legivel a partir de docs/IDM_SPEC.md,
// mais a leitura do manifesto e da validacao publicados pelo pipeline. O IDM e
// descritivo, nao causal (ver docs/DECISAO_CAUSAL.md); o quadro de literatura
// fecha a pagina, separado do dado municipal.
export default function Metodologia() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [validacao, setValidacao] = useState<Record<string, unknown> | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  // Tri-state kept separate from the data itself: "carregando" gates the
  // skeleton for the manifest- and validation-dependent sections below; the
  // static sections (eixos, normalizacao, faltante) never wait on this, since
  // they carry no fetched data.
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.allSettled([carregarManifesto(), carregarValidacao(), carregarMunicipios()]).then(
      ([manifestoRes, validacaoRes, municipiosRes]) => {
        if (!vivo) return;
        setManifesto(manifestoRes.status === "fulfilled" ? manifestoRes.value : null);
        setValidacao(validacaoRes.status === "fulfilled" ? validacaoRes.value : null);
        setMunicipios(municipiosRes.status === "fulfilled" ? municipiosRes.value : []);
        setCarregando(false);
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  const spearman = numero(campo(validacao, "spearman_idm_log_pop"));
  const estratificarPorPorte = booleano(campo(validacao, "stratify_by_porte"));
  const nMunicipiosValidados = numero(campo(validacao, "n_municipios"));
  const nReceitaMaiorPib = numero(campo(validacao, "n_receita_maior_pib"));
  const nLigacoes = numero(campo(validacao, "n_ligacoes"));
  const ligacoesDangling = numero(campo(validacao, "ligacoes_dangling"));
  const corrEixos = campo(validacao, "corr_eixos");
  const corrOrbitacaoFiscal = numero(campo(campo(corrEixos, "orbitacao"), "fiscal"));
  const corrOrbitacaoServicos = numero(campo(campo(corrEixos, "orbitacao"), "servicos"));
  const corrFiscalServicos = numero(campo(campo(corrEixos, "fiscal"), "servicos"));
  const idmIdhmBruto = campo(validacao, "idm_idhm");
  const idmIdhmDados =
    idmIdhmBruto && typeof idmIdhmBruto === "object" && "rho_bruto" in idmIdhmBruto
      ? (idmIdhmBruto as unknown as ValidacaoIdmIdhmDados)
      : null;

  return (
    <>
    <div className="faixa-tela">
      <p style={{ margin: 0, color: "var(--ink-secondary)", fontSize: "var(--text-body)", maxWidth: "90ch" }}>
        O Índice de Dependência Municipal cruza, em um só instrumento e por
        município, a topologia de órbita do REGIC, para onde a vida da cidade
        acontece, a receita municipal em relação ao PIB local e a presença de
        serviços de saúde e ensino superior. É medida de dependência
        estrutural, não de desempenho da gestão. A sigla IDM é Índice de
        Dependência Municipal; não se confunde com o Índice de Desenvolvimento
        Municipal de mesma sigla, com o IFDM ou o IDHM, com a razão de
        dependência demográfica do IBGE, nem com o Índice de Dependência
        Financeira, restrito às finanças.
      </p>
    </div>
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        maxWidth: "72ch",
      }}
    >

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>O que há de novo</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          O IDM reúne três coisas que, juntas, não se encontram em outros painéis
          municipais.
        </p>
        <ul style={{ color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Dependência funcional, não ranking de mérito.</strong>{" "}
            A leitura parte da órbita real da rede urbana do REGIC, tratada como
            partição do país, para onde cada cidade se desloca por serviço, e não
            de uma nota de quem é melhor ou mais desenvolvido.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Índice composto formativo.</strong>{" "}
            Os três eixos definem o construto por composição, com pesos
            documentados e calibráveis; baixa correlação entre eixos não é
            defeito, é o esperado num índice formativo.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Leitura por município auditada contra alucinação.</strong>{" "}
            Cada cidade recebe uma leitura em linguagem natural em que o modelo
            nunca emite número: todo valor entra por substituição mecânica e um
            portão reprova juízo, causa ou dígito fora do dado. Ver adiante.
          </li>
        </ul>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Para quem serve e como usar</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          O painel responde a uma pergunta que o gestor municipal, o vereador e
          quem fiscaliza a prefeitura fazem com frequência: de quem esta cidade
          depende, o que lhe falta e quanto da receita vem de transferência. Cada
          público tem um caminho direto até a resposta.
        </p>
        <ul style={{ color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Gestão municipal e câmara.</strong>{" "}
            No <Link to="/">mapa</Link>, busque a cidade e use{" "}
            <em>Baixar relatório</em>: uma página com a leitura do caso frente à
            mediana do mesmo porte, o polo de que depende e a distância até ele,
            a participação do FPM na receita, a receita da prefeitura frente ao
            PIB local, os serviços presentes e ausentes e a leitura da região
            funcional em <Link to="/cenarios">Brasil em Cenários</Link>. Cada número traz a base e a data de extração, pronto
            para audiência pública, plano plurianual ou negociação de consórcio.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Controle social e imprensa.</strong>{" "}
            O <Link to="/ranking">ranking</Link> e o{" "}
            <Link to="/fiscal">eixo fiscal</Link> mostram, por porte e por UF,
            onde a dependência estrutural se concentra, e a{" "}
            <Link to="/rede">rede</Link> revela quais polos sustentam muitos
            municípios, o que indica onde a falta de um serviço afeta mais gente.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Planejamento estadual e federal.</strong>{" "}
            Brasil em Cenários agrega as 1.443 regiões funcionais por UF e
            região, com custo da máquina pública, efeito no FPM e presença de
            UTI, curso presencial e agência bancária na sede, para examinar
            consórcios e redes de atenção com o mesmo recorte que a população já
            usa.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Pesquisa.</strong>{" "}
            Os artefatos completos, a especificação formal do índice e o código
            que os gera estão abertos, como descrito na seção seguinte.
          </li>
        </ul>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Código, dados e licença</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          Tudo o que produz e apresenta o índice é aberto e reproduzível. O{" "}
          <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer">
            repositório público
          </a>{" "}
          reúne o pipeline em Python que baixa as bases, padroniza a chave IBGE
          e calcula o IDM, a camada que gera a leitura automática com o portão
          de validação, o código do painel, os artefatos de dado completos e a
          documentação do método, com um roteiro passo a passo para reproduzir
          cada número a partir das fontes oficiais.
        </p>
        <ul style={{ color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Código:</strong>{" "}
            licença MIT, livre para usar, copiar, modificar e adaptar a outros
            recortes territoriais ou anos-base.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Dados derivados e documentação:</strong>{" "}
            CC BY 4.0, livres para redistribuir e reusar, inclusive
            comercialmente, com atribuição.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Versão citável:</strong>{" "}
            <a href={`https://doi.org/${DOI_CONCEITO}`} target="_blank" rel="noopener noreferrer">
              DOI {DOI_CONCEITO}
            </a>
            , depósito no Zenodo que resolve sempre para a versão mais recente.
          </li>
        </ul>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Os três eixos</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          Cada eixo normaliza uma variável bruta pelo posto percentílico entre
          municípios, e não pelo valor absoluto.
        </p>
        <ul style={{ color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Orbitação.</strong>{" "}
            Posto percentílico da distância em quilômetros ao polo de destino
            no REGIC. Polos e semi-polos que não se deslocam recebem distância
            zero e eixo baixo; orbitantes distantes recebem eixo alto.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Fiscal.</strong>{" "}
            Média de dois postos percentílicos: a participação do FPM na
            receita total e a razão entre a receita total e o PIB do
            município, que pode superar 1 quando a prefeitura movimenta mais
            do que a própria economia local produz.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Serviços.</strong>{" "}
            Inversão da média de dois indicadores de presença, saúde de alta
            complexidade (CNES) e ensino superior (INEP): a ausência de serviço
            eleva o eixo, em vez da presença. A presença de cada serviço usa a
            evidência de acesso efetivo, o leito de UTI para a saúde e o curso
            presencial para o ensino, conforme a reconciliação descrita abaixo.
          </li>
        </ul>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Normalização, pesos e composição</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          O posto percentílico coloca cada município entre 0 e 1 pela sua
          posição ordenada entre todos os municípios válidos, com empates
          resolvidos pela média dos postos. É preferido ao reescalonamento
          mínimo-máximo por ser robusto a valores extremos, frequentes em
          razões fiscais como receita sobre PIB.
        </p>
        <p style={{ color: "var(--ink-secondary)" }}>
          O IDM é a soma ponderada dos três eixos, IDM = peso1 x orbitação +
          peso2 x fiscal + peso3 x serviços. A versão 1 usa pesos iguais,
          declarados no manifesto e ajustáveis; qualquer mudança de peso é
          registrada nesta especificação. O painel também publica o posto
          percentílico do próprio IDM, a base da leitura "mais dependente que X
          por cento dos municípios" usada no perfil e no ranking.
        </p>
        {carregando ? (
          <EstadoCarregando linhas={3} rotulo="Carregando pesos do manifesto" />
        ) : manifesto ? (
          <ul style={{ color: "var(--ink-secondary)" }}>
            <li>orbitação: {formatarPercentual(manifesto.pesos.orbitacao, 2)}</li>
            <li>fiscal: {formatarPercentual(manifesto.pesos.fiscal, 2)}</li>
            <li>serviços: {formatarPercentual(manifesto.pesos.servicos, 2)}</li>
          </ul>
        ) : (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-caption)" }}>
            Pesos do manifesto indisponíveis neste ambiente.
          </p>
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Tratamento de faltante</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          Município sem dado fiscal válido no ano-base não entra no universo do
          índice; nenhum eixo é imputado por média. A ausência em CNES ou INEP
          só é lida como ausência real de serviço quando a base de origem é
          exaustiva para o ano-base; caso contrário, o município também sai do
          universo. A cobertura resultante é declarada na tela, nunca
          preenchida por estimativa.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>
          Acesso efetivo e reconciliação do eixo de serviços
        </h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          A presença binária de serviço foi refinada por uma camada de acesso
          efetivo, que distingue ter de alcançar. Em saúde, o leito de UTI (CNES,
          competência mais recente) separa o hospital de alta complexidade do
          hospital sem terapia intensiva. Em ensino, o curso de graduação
          presencial (INEP, Censo da Educação Superior 2024) separa o ensino
          superior local do polo apenas de educação a distância. Em serviço
          bancário, a agência (BACEN) separa o crédito e o atendimento pleno do
          correspondente de escopo limitado, e a ESTBAN mede o crédito por
          habitante como referência parcial.
        </p>
        <p style={{ color: "var(--ink-secondary)" }}>
          A evidência de acesso reconcilia a presença que alimenta o eixo de
          serviços, por alargamento monotônico: onde há leito de UTI, o município
          conta como de alta complexidade em saúde; onde há curso presencial,
          conta como de ensino superior. A relação é de implicação, uma UTI
          pressupõe alta complexidade e um curso presencial pressupõe ensino
          superior, de modo que a presença nunca é estreitada, apenas corrigida
          para cima onde a base de acesso, mais recente e completa, registra o
          serviço. A correção alcançou 527 municípios, todos no sentido de menor
          dependência.
        </p>
        <p style={{ color: "var(--ink-secondary)" }}>
          O serviço bancário permanece como leitura de contexto, na tela de
          perfil e na agregação por região funcional, sem entrar no cálculo do
          IDM. Manter o crédito e a agência fora do índice preserva a
          comparabilidade dos três eixos e evita que uma medida parcial do
          sistema financeiro pese sobre a classificação.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Notas de implementação (0.1.0)</h2>
        <ul style={{ color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Serviços, proxy do CNES.</strong>{" "}
            A presença de hospital geral ou especializado ativo é usada como
            proxy de média e alta complexidade; o refinamento por leitos de UTI
            e serviços de alta complexidade fica para o estágio M2.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>Fiscal, PIB de 2023.</strong>{" "}
            O PIB municipal é o da edição mais recente do IBGE (2023),
            combinado a receita fiscal de 2024; a assimetria de ano-base é
            declarada, hierarquia urbana muda devagar contra fenômeno fiscal
            recente.
          </li>
          <li>
            <strong style={{ color: "var(--ink-primary)" }}>IDM 0.1.0, provisório.</strong>{" "}
            Pesos iguais entre os três eixos, ano-base REGIC 2018 combinado a
            FINBRA 2024; ambos ajustáveis e sujeitos a revisão registrada nesta
            especificação antes de refletir no painel.
          </li>
        </ul>
      </section>

      {carregando ? (
        <section>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Cobertura, ano-base e fontes</h2>
          <EstadoCarregando linhas={4} rotulo="Carregando cobertura e fontes" />
        </section>
      ) : manifesto ? (
        <>
          <section>
            <h2 style={{ fontSize: "var(--text-lg)" }}>Cobertura e ano-base</h2>
            <p style={{ color: "var(--ink-secondary)" }}>
              Ano-base fiscal {manifesto.ano_base_fiscal}, REGIC{" "}
              {manifesto.ano_base_regic}, versão {manifesto.idm_versao}.
              Cobertura de {formatarPercentual(manifesto.cobertura.percentual, 1)}{" "}
              dos municípios do universo ({manifesto.cobertura.municipios_validos}{" "}
              de {manifesto.cobertura.municipios_universo}), sem imputação para os
              demais.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)" }}>Fontes</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {manifesto.fontes.map((f) => (
                <div key={`${f.nome}-${f.ano}`}>
                  <p style={{ margin: 0 }}>
                    <strong>{f.nome}</strong> ({f.orgao}, {f.ano}): {f.uso}
                  </p>
                  <SeloFonte fonte={f.nome} dataExtracao={f.data_extracao} />
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Cobertura, ano-base e fontes</h2>
          <EstadoVazio mensagem="Dados de cobertura e fontes indisponíveis neste ambiente." />
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Validação</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          Antes de publicar, o pipeline registra a correlação de Spearman entre
          o IDM e o logaritmo da população. Se o valor absoluto superar 0,8, o
          ranking passa a ser lido primariamente por porte, para não apenas
          remedir população.
        </p>
        {carregando ? (
          <EstadoCarregando linhas={3} rotulo="Carregando validação" />
        ) : (
          <>
            {spearman !== undefined ? (
              <p style={{ color: "var(--ink-secondary)" }}>
                Spearman(IDM, log população) ={" "}
                <span className="tabular">{formatarNumero(spearman)}</span>, valor
                absoluto{" "}
                {Math.abs(spearman) > 0.8 ? "acima" : "abaixo"} do limiar de 0,8;
                leitura primária{" "}
                {(estratificarPorPorte ?? Math.abs(spearman) > 0.8)
                  ? "estratificada por porte"
                  : "não estratificada por porte"}
                {nMunicipiosValidados !== undefined
                  ? `, sobre ${nMunicipiosValidados} municípios válidos`
                  : ""}
                .
              </p>
            ) : null}
            {corrOrbitacaoFiscal !== undefined &&
            corrOrbitacaoServicos !== undefined &&
            corrFiscalServicos !== undefined ? (
              <p style={{ color: "var(--ink-secondary)" }}>
                Correlação entre eixos: orbitação e fiscal{" "}
                <span className="tabular">{formatarNumero(corrOrbitacaoFiscal)}</span>,
                orbitação e serviços{" "}
                <span className="tabular">{formatarNumero(corrOrbitacaoServicos)}</span>,
                fiscal e serviços{" "}
                <span className="tabular">{formatarNumero(corrFiscalServicos)}</span>.
                Valores próximos de zero indicam eixos complementares, não
                redundantes; nenhum par supera o limiar de redundância.
              </p>
            ) : null}
            {nReceitaMaiorPib !== undefined ? (
              <p style={{ color: "var(--ink-secondary)" }}>
                Casos de controle: {nReceitaMaiorPib} municípios com receita total
                acima do próprio PIB
                {nLigacoes !== undefined
                  ? `; ${nLigacoes} ligações orbitante para polo do REGIC conferidas`
                  : ""}
                {ligacoesDangling !== undefined
                  ? `, das quais ${ligacoesDangling} sem polo de destino válido na base`
                  : ""}
                .
              </p>
            ) : null}
            {spearman === undefined &&
            corrOrbitacaoFiscal === undefined &&
            nReceitaMaiorPib === undefined ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-caption)" }}>
                Dados de validação indisponíveis neste ambiente.
              </p>
            ) : null}
          </>
        )}
      </section>

      {carregando ? (
        <section>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Associação com o desenvolvimento humano</h2>
          <EstadoCarregando linhas={4} rotulo="Carregando validação externa" />
        </section>
      ) : idmIdhmDados && municipios.length > 0 ? (
        <ValidacaoIdmIdhm dados={idmIdhmDados} municipios={municipios} />
      ) : null}

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Como garantimos que a leitura automática não inventa</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          Modelo de linguagem em dado público desperta desconfiança justa, porque
          costuma inventar número. A leitura por município do IDM é desenhada para
          que isso não aconteça, e é essa arquitetura, não o uso do modelo em si,
          que constitui o diferencial. Cada município recebe uma leitura em
          linguagem natural, exibida no perfil, no mapa e nas telas fiscal e de
          ranking, gerada em lote por um modelo de linguagem local, o Gemma 4 E2B,
          servido via vLLM. O texto é rotulado como automático onde aparece.
        </p>
        <p style={{ color: "var(--ink-secondary)" }}>
          O modelo não raciocina sobre os dados: um harness pré-computa a
          comparação por porte, o padrão estrutural e a relação de rede, e o
          modelo apenas redige a prosa. Todo número, nome e distância entra por
          um dicionário de símbolos substituído mecanicamente, de modo que valor
          e rótulo nunca são responsabilidade do modelo. Um portão de validação
          reprova qualquer saída com juízo de gestão, afirmação de causa,
          recomendação à prefeitura ou número fora do dado. A leitura é
          descritiva e estrutural, nunca uma nota de gestão, coerente com a
          postura do índice.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)" }}>Brasil em Cenários: análise de agregação</h2>
        <p style={{ color: "var(--ink-secondary)" }}>
          A aba Brasil em Cenários é uma análise estrutural, exaustiva e
          descritiva da agregação municipal, não um simulador livre nem uma
          recomendação. A unidade é a região funcional da REGIC: um polo ou
          semipolo âncora mais os orbitantes que dependem dele. As 1.443
          regiões funcionais formam uma partição do universo, cada município em
          exatamente uma delas, e são pré-computadas e agregadas por Brasil,
          região e UF; em 751 a âncora absorve ao menos um orbitante, e as 692
          restantes são municípios que não orbitam ninguém. Fundir significa a âncora absorver seus orbitantes, o centro de
          serviço que a rede urbana já usa passa a ser a sede.
        </p>
        <p style={{ color: "var(--ink-secondary)" }}>
          Cada região funcional recebe quatro leituras. Custo hoje: a máquina
          pública, Legislativa mais Administração, medida no Siconfi (DCA Anexo
          I-E, 2024). FPM se fundida: o coeficiente do FPM da população somada
          contra a soma dos coeficientes de hoje, aritmética da tabela do
          Tesouro. Como o fundo é um bolo fixo, essa variação é redistribuída
          aos demais municípios do estado e a União paga o mesmo, então a redução
          é real só no nível da região, não no agregado. Estrutura, lida por
          acesso efetivo e não por mera presença: a sede tem UTI (CNES), curso
          superior presencial (INEP) e agência bancária (BACEN)? Dependência: o
          IDM médio ponderado hoje contra o IDM simulado, o da âncora, a queda
          que a agregação resolve quando os orbitantes passam a integrar um
          centro de serviço.
        </p>
        <p style={{ color: "var(--ink-secondary)" }}>
          A leitura estrutural é determinística: o centro de serviço da sede é
          consolidado quando reúne UTI, curso presencial e agência; parcial
          quando há o equipamento sem o acesso efetivo em algum serviço, por
          exemplo um hospital sem UTI ou uma faculdade só de EAD; ausente quando
          não há hospital, faculdade nem banco. Ela descreve a estrutura, não
          qualifica a fusão como boa ou ruim. O líquido de consórcio aparece só
          como faixa de sensibilidade, varrendo a economia de escala e o custo de
          governança, ambos ainda sem calibração brasileira, então o sinal
          depende da premissa, não do dado.
        </p>
      </section>

    </article>
    </>
  );
}
