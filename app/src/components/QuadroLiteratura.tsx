interface FonteLiteratura {
  texto: string;
  url: string;
}

interface CitacaoLiteratura {
  grupo: "literatura" | "painel";
  tema: string;
  texto: string;
  fontes: FonteLiteratura[];
  ressalvaLocal: string;
}

// Third-party literature, credited to its authors, each finding scoped to the
// effect its own method supports. Per docs/DECISAO_CAUSAL.md the panel does not
// estimate its own causal effect and this block never mixes the municipal datum
// with a causal estimate. References verified and dated against OpenAlex and
// Crossref; every entry resolves to a DOI or an official
// institutional page. Findings of the panel itself (for example the IDM against
// IDHM association) do NOT live here; they belong to the screens and to the
// methodology, apart from this citation card.
const CITACOES: CitacaoLiteratura[] = [
  {
    grupo: "literatura",
    tema: "Federalismo fiscal pós-1988",
    texto:
      "As transferências constitucionais foram desenhadas para equalizar a capacidade fiscal de entes com bases arrecadatórias muito desiguais, e cidades pequenas dependem mais do repasse por desenho da lei, não por escolha de gestão. Esse é o enquadramento estrutural do eixo fiscal do IDM.",
    fontes: [
      {
        texto:
          "Baião, Cunha e Souza (2017). Papel das transferências intergovernamentais na equalização fiscal dos municípios brasileiros. Revista do Serviço Público.",
        url: "https://doi.org/10.21874/rsp.v68i3.1406",
      },
      {
        texto:
          "Bachur (2014). Federalismo fiscal, atribuições fiscais constitucionais e equalização regional: EUA, Alemanha e Brasil em perspectiva comparada. Revista do Serviço Público.",
        url: "https://doi.org/10.21874/rsp.v56i4.237",
      },
    ],
    ressalvaLocal:
      "Enquadramento estrutural do desenho de transferências; descreve o sistema, não avalia a qualidade da gestão de um município.",
  },
  {
    grupo: "literatura",
    tema: "Criação e dependência de pequenos municípios",
    texto:
      "A criação de municípios após a Constituição de 1988 concentrou-se em unidades de pequeno porte, cuja viabilidade fiscal depende de forma estrutural do FPM, o que é lido como incentivo à fragmentação em torno dos limiares de repasse. A repartição do fundo e a Emenda Constitucional 15 de 1996 são o marco dessa dinâmica.",
    fontes: [
      {
        texto:
          "Tomio (2002). A criação de municípios após a Constituição de 1988. Revista Brasileira de Ciências Sociais.",
        url: "https://doi.org/10.1590/s0102-69092002000100006",
      },
      {
        texto:
          "Senado Federal. A criação de municípios após a Constituição de 1988: o impacto sobre a repartição do FPM e a Emenda Constitucional 15 de 1996. Biblioteca Digital do Senado.",
        url: "https://www2.senado.leg.br/bdsf/item/id/198693",
      },
    ],
    ressalvaLocal:
      "Leitura estrutural do desenho do repasse para a classe de pequenos municípios como um todo; não é inferência causal sobre a posição de um município individual no ranking do painel.",
  },
  {
    grupo: "literatura",
    tema: "Efeito flypaper e acomodação da arrecadação própria",
    texto:
      "A literatura de finanças públicas documenta o efeito flypaper: uma transferência como o FPM tende a elevar o gasto público local mais do que um aumento equivalente na renda da população, e a dependência do repasse se associa a menor esforço de arrecadação própria. Estudos com dados de municípios brasileiros medem tanto a expansão do gasto quanto a resposta da eficiência tributária.",
    fontes: [
      {
        texto:
          "Mattos, Rocha e Arvate (2011). Flypaper effect revisited: evidence for tax collection efficiency in Brazilian municipalities. Estudos Econômicos (São Paulo).",
        url: "https://doi.org/10.1590/s0101-41612011000200002",
      },
      {
        texto:
          "Gadenne (2017). Tax me, but spend wisely? Sources of public finance and government accountability. American Economic Journal: Applied Economics.",
        url: "https://doi.org/10.1257/app.20150509",
      },
    ],
    ressalvaLocal:
      "Efeitos estimados por desenhos de identificação específicos, locais aos contextos e faixas analisados; não extrapoláveis ao IDM de um município qualquer do painel.",
  },
  {
    grupo: "literatura",
    tema: "Dependência fiscal e desenvolvimento humano",
    texto:
      "Estudos de terceiros associam a dependência de transferências como o FPM a um desenvolvimento local mais fraco entre municípios de pequeno porte, leitura estrutural da classe, não veredito sobre uma cidade. O IDHM, que sintetiza longevidade, educação e renda, é o referente de desenvolvimento que o painel usa apenas como contexto e validação descritiva, nunca como eixo do IDM.",
    fontes: [
      {
        texto:
          "Raiher, Gobbo e Sene (2020). Fundo de participação dos municípios e o desenvolvimento: uma análise dos municípios de pequeno porte do Brasil. Emancipação (UEPG).",
        url: "https://doi.org/10.5212/emancipacao.v.20.14361.004",
      },
      {
        texto:
          "PNUD, Ipea e FJP. Atlas do Desenvolvimento Humano no Brasil (IDHM, base do Censo 2010).",
        url: "https://www.atlasbrasil.org.br/",
      },
    ],
    ressalvaLocal:
      "Como ler: associação estrutural no nível da classe de municípios, não afirmação de que a dependência da sua cidade rebaixa o desenvolvimento dela; causas comuns, como porte e base econômica, movem os dois ao mesmo tempo. A medida própria do painel, do IDM contra o IDHM de 2010, com a safra declarada, vive na metodologia, separada desta citação.",
  },
  {
    grupo: "literatura",
    tema: "Deslocamento para serviços de saúde",
    texto:
      "A REGIC 2018 registra deslocamento médio de 72 km para serviços de saúde de média complexidade e de 155 km para alta complexidade, o que descreve a concentração da oferta hospitalar nos polos regionais. Estudos recentes detalham como distância e tempo estruturam a desigualdade de acesso entre municípios.",
    fontes: [
      {
        texto:
          "IBGE (2020). Regiões de Influência das Cidades 2018: deslocamentos para serviços de saúde.",
        url: "https://www.ibge.gov.br/geociencias/organizacao-do-territorio/redes-e-fluxos-geograficos/15798-regioes-de-influencia-das-cidades.html",
      },
      {
        texto:
          "Felipe, Albuquerque, Lopes, Zicker e Fonseca (2024). Desigualdades regionais no acesso ao parto hospitalar no Estado do Rio de Janeiro: redes de deslocamento, distância e tempo (2010-2019). Cadernos de Saúde Pública.",
        url: "https://doi.org/10.1590/0102-311xpt064423",
      },
    ],
    ressalvaLocal:
      "Média nacional e recorte estadual, descritivos; não substituem a distância ao polo do município específico, exibida no perfil e no eixo de orbitação do IDM.",
  },
  {
    grupo: "literatura",
    tema: "Regionalização da saúde e vazios assistenciais",
    texto:
      "A regionalização do SUS convive com forte desigualdade na oferta entre regiões de saúde, e a média e a alta complexidade concentram-se nos grandes centros urbanos, deixando vazios assistenciais nas áreas mais remotas. A alocação equitativa de recursos permanece um desafio aberto.",
    fontes: [
      {
        texto:
          "Rocha e Rache et al. (2021). A Regionalização da Saúde no Brasil. IEPS, Estudo Institucional.",
        url: "https://ieps.org.br/wp-content/uploads/2022/06/IEPS_Estudo_Institucional_07.pdf",
      },
      {
        texto:
          "Carnut, Mendes e Leite (2020). Metodologias para alocação equitativa de recursos financeiros em saúde: uma revisão integrativa. Saúde em Debate.",
        url: "https://doi.org/10.1590/0103-1104202012624",
      },
    ],
    ressalvaLocal:
      "Panorama nacional descritivo da concentração de serviços; não afirma causa sobre a ausência de serviço em um município do painel.",
  },
  {
    grupo: "literatura",
    tema: "Interiorização e acesso ao ensino superior",
    texto:
      "A expansão e a interiorização das instituições de ensino superior redistribuíram a oferta pelo território, mas a concentração em regiões mais desenvolvidas persiste e a distância à sede segue como barreira de acesso. A geografia das IES sustenta o eixo de autossuficiência de serviços do IDM.",
    fontes: [
      {
        texto:
          "Santos, Amaral e Luz (2023). Expansão do ensino superior e a distribuição regional das universidades brasileiras. Revista Brasileira de Estudos Urbanos e Regionais.",
        url: "https://doi.org/10.22296/2317-1529.rbeur.202317",
      },
      {
        texto:
          "Gumiero e Redón (2023). Interiorização da pós-graduação em planejamento urbano e regional na Amazônia. Desenvolvimento Regional em debate.",
        url: "https://doi.org/10.24302/drd.v13ied.esp..4203",
      },
    ],
    ressalvaLocal:
      "Descreve a concentração e a distribuição regional da oferta de ensino superior; não é inferência causal sobre a presença de IES em um município específico.",
  },
  {
    grupo: "literatura",
    tema: "Correspondentes bancários e inclusão financeira",
    texto:
      "A literatura documenta que o correspondente bancário, o ponto de atendimento em comércio e lotérica, levou serviço financeiro básico a municípios sem agência e ampliou o acesso, mas com escopo limitado ante a agência: o correspondente resolve pagamento e caixa básico, enquanto o crédito e o atendimento pleno seguem concentrados onde há agência. É o enquadramento da distinção entre agência e correspondente na camada de acesso do painel.",
    fontes: [
      {
        texto:
          "Diniz, Birochi e Pozzebon (2012). Triggers and barriers to financial inclusion: the use of ICT-based branchless banking in an Amazon county. Electronic Commerce Research and Applications.",
        url: "https://doi.org/10.1016/j.elerap.2011.07.006",
      },
      {
        texto:
          "Guimarães, Diniz e Gonzalez Farias (2014). Inclusão financeira e correspondentes bancários. GV-Executivo (FGV).",
        url: "https://doi.org/10.12660/gvexec.v13n1.2014.21427",
      },
    ],
    ressalvaLocal:
      "Leitura estrutural e descritiva da expansão dos correspondentes e de seus limites; o painel mostra a agência contra o correspondente como camada de contexto de acesso financeiro, nunca como eixo do IDM, e não estima efeito causal da presença bancária sobre a posição de um município.",
  },
  {
    grupo: "literatura",
    tema: "Escala municipal, fusão e cooperação",
    texto:
      "A literatura internacional sobre amalgamação municipal mostra que fundir municípios raramente entrega a economia de custo prometida, enquanto a cooperação entre entes, na intercommunalité francesa ou nos consórcios públicos brasileiros, compartilha serviços sem extinguir prefeituras. É o enquadramento da aba Brasil em Cenários, que simula agregar orbitantes ao seu polo ou semipolo, o centro de serviço que a rede urbana já usa.",
    fontes: [
      {
        texto:
          "Blom-Hansen, Houlberg, Serritzlew e Treisman (2016). Jurisdiction size and local government policy expenditure: assessing the effect of municipal amalgamation. American Political Science Review.",
        url: "https://doi.org/10.1017/s0003055416000320",
      },
      {
        texto:
          "Allers e Geertsema (2016). The effects of local government amalgamation on public spending, taxation, and service levels. Journal of Regional Science.",
        url: "https://doi.org/10.1111/jors.12268",
      },
      {
        texto:
          "Tavares (2018). Municipal amalgamations and their effects: a literature review. Miscellanea Geographica.",
        url: "https://doi.org/10.2478/mgrsd-2018-0005",
      },
    ],
    ressalvaLocal:
      "Efeito da amalgamação estimado por terceiros em outros países; o painel não afirma efeito causal próprio. A aba Brasil em Cenários é uma simulação descritiva por região funcional: mede o custo da máquina hoje, a variação do FPM ao fundir na âncora, que é redistribuída no estado por ser bolo fixo, e verifica se a sede concentra o serviço de fato, por leito de UTI, curso presencial e agência bancária; não é recomendação.",
  },
  {
    grupo: "literatura",
    tema: "Consórcios intermunicipais na saúde",
    texto:
      "A cooperação por consórcio público compartilha serviços de saúde sem extinguir prefeituras, e a evidência brasileira recente registra ganho de escala e de eficiência nessa forma de arranjo. É a alternativa institucional que preserva o repasse do FPM, já que nenhum ente é extinto, e o contraponto direto à fusão simulada na aba Brasil em Cenários.",
    fontes: [
      {
        texto:
          "Araújo, Costa, Lucion e Gomes (2025). Economia de escala e qualidade na saúde: o impacto dos consórcios intermunicipais na eficiência da saúde pública. Diálogos interdisciplinares em Ciências Humanas, volume 3.",
        url: "https://doi.org/10.47402/ed.ep.c.253567011",
      },
    ],
    ressalvaLocal:
      "Efeito estimado por terceiros em recorte próprio; o painel não simula consórcio nem estima efeito de cooperação, e a menção aqui delimita o cenário de fusão, sem recomendá-lo ou desaconselhá-lo.",
  },
  {
    grupo: "painel",
    tema: "Três em cada quatro municípios orbitam outra cidade",
    texto:
      "No universo de 5.513 municípios com os três eixos computados, a tipologia funcional derivada da REGIC classifica 1.013 polos, 431 semipolos e 4.069 orbitantes. Quase três em cada quatro municípios brasileiros, portanto, têm a vida econômica e o consumo de serviços organizados por outra cidade. As 5.124 ligações de orbitante para polo exibidas no mapa foram conferidas contra a fonte.",
    fontes: [
      {
        texto: "IBGE (2020). Regiões de Influência das Cidades 2018, base da tipologia e das ligações.",
        url: "https://www.ibge.gov.br/geociencias/organizacao-do-territorio/redes-e-fluxos-geograficos/15798-regioes-de-influencia-das-cidades.html",
      },
      {
        texto: "Artefatos e método do IDM, depositados com DOI citável.",
        url: "https://doi.org/10.5281/zenodo.21431702",
      },
    ],
    ressalvaLocal:
      "Contagem por município, não por cidade da REGIC, que agrega parte dos municípios em arranjos populacionais; por isso o total de polos e semipolos supera as cerca de 862 cidades com centralidade na fonte.",
  },
  {
    grupo: "painel",
    tema: "Vinte prefeituras movimentam mais do que o PIB da própria cidade",
    texto:
      "Em 20 municípios a receita total da prefeitura supera o PIB municipal. O caso extremo é Itaipulândia, no Paraná, onde a receita chega a 1,40 vez o que a economia da cidade produz, seguida de Alvorada de Minas, com 1,34, e Caridade do Piauí, com 1,27. São situações em que a máquina pública é, em escala, o próprio fato econômico do lugar.",
    fontes: [
      {
        texto: "Tesouro Nacional. FINBRA e Declaração das Contas Anuais (DCA), exercício de 2024, via Siconfi.",
        url: "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf",
      },
      {
        texto: "IBGE. Produto Interno Bruto dos Municípios, 2023.",
        url: "https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9088-produto-interno-bruto-dos-municipios.html",
      },
    ],
    ressalvaLocal:
      "Razão entre duas medidas de safras distintas, receita de 2024 sobre PIB de 2023; descreve a escala relativa do orçamento, não a qualidade da arrecadação nem o mérito da gestão.",
  },
  {
    grupo: "painel",
    tema: "Os extremos do índice têm nome",
    texto:
      "No piso do IDM, perto de 0,02, aparecem cidades com parque industrial, refino ou royalties, como Osasco, em São Paulo, e Maricá e Saquarema, no Rio de Janeiro. No teto, entre 0,96 e 0,97, estão municípios pequenos como Teresina de Goiás, São José do Peixe, no Piauí, e Miravânia, em Minas Gerais, todos a mais de duzentos quilômetros do centro que os atende e com o FPM respondendo por cerca de metade da receita.",
    fontes: [
      {
        texto: "IBGE (2020). REGIC 2018, distância ao centro de destino.",
        url: "https://www.ibge.gov.br/geociencias/organizacao-do-territorio/redes-e-fluxos-geograficos/15798-regioes-de-influencia-das-cidades.html",
      },
      {
        texto: "Tesouro Nacional. FINBRA e DCA, exercício de 2024, via Siconfi.",
        url: "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf",
      },
    ],
    ressalvaLocal:
      "Posições em uma escala relativa construída por posto percentílico; um município no teto do índice é mais dependente e mais distante do que a maioria dos outros, o que não o qualifica como mal administrado.",
  },
  {
    grupo: "painel",
    tema: "Onde a cidade fica e como ela se financia são medidas distintas",
    texto:
      "Os eixos de orbitação e de dependência fiscal são não correlacionados no universo analisado, com Spearman de -0,09: saber a que distância o município orbita quase nada informa sobre a composição do financiamento da prefeitura. Os eixos fiscal e de serviços mostram sobreposição parcial, 0,49. É a razão pela qual o índice precisa dos três eixos em vez de um só.",
    fontes: [
      {
        texto: "Validação interna do IDM, publicada junto aos artefatos com DOI citável.",
        url: "https://doi.org/10.5281/zenodo.21431702",
      },
    ],
    ressalvaLocal:
      "Correlação próxima de zero indica ausência de associação monotônica entre os dois eixos, não independência estatística entre eles.",
  },
  {
    grupo: "painel",
    tema: "Dependência mais alta acompanha IDHM mais baixo",
    texto:
      "Municípios com IDM mais alto tendem a exibir IDHM menor: o Spearman entre os dois é de -0,41, e sobe para -0,48 quando se controla o logaritmo da população, ou seja, a associação não é apenas efeito do porte. Por eixo, a ligação é mais forte no fiscal, -0,52, intermediária na orbitação, -0,21, e fraca nos serviços, -0,10.",
    fontes: [
      {
        texto: "PNUD, Ipea e FJP. Atlas do Desenvolvimento Humano no Brasil, IDHM com base no Censo de 2010.",
        url: "https://www.atlasbrasil.org.br/",
      },
      {
        texto: "Validação externa descritiva do IDM, com intervalos de bootstrap, publicada junto aos artefatos.",
        url: "https://doi.org/10.5281/zenodo.21431702",
      },
    ],
    ressalvaLocal:
      "Associação descritiva, nunca causal: o IDHM é de 2010 e as bases fiscais de 2024, defasagem que tende a atenuar a medida, e os dois construtos compartilham insumos parciais em educação e saúde, o que afasta o rótulo de validade convergente.",
  },
  {
    grupo: "painel",
    tema: "A aritmética do FPM quando se cogita fundir",
    texto:
      "As 1.443 regiões funcionais formam uma partição do país; em 751 delas a âncora absorve ao menos um orbitante. Se cada uma virasse um único município, R$ 115,5 bilhões de FPM deixariam de chegar a essas regiões e seriam redistribuídos dentro dos próprios estados, porque o fundo é bolo fixo. A economia com as câmaras municipais suprimidas, R$ 9,0 bilhões, é uma ordem de grandeza menor. O custo da máquina municipal hoje soma R$ 156,3 bilhões.",
    fontes: [
      {
        texto: "Tesouro Nacional. DCA Anexo I-E, despesa por função, exercício de 2024, via Siconfi.",
        url: "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf",
      },
      {
        texto: "Análise de agregação por região funcional, publicada junto aos artefatos.",
        url: "https://doi.org/10.5281/zenodo.21431702",
      },
    ],
    ressalvaLocal:
      "Aritmética da regra vigente de repartição, não estimativa de efeito de uma reforma nem recomendação de fundir. A queda do IDM médio na simulação decorre da construção do índice, já que orbitantes deixam de existir como unidades, e não representa benefício projetado.",
  },
  {
    grupo: "painel",
    tema: "Pouco mais da metade das sedes concentra o serviço de fato",
    texto:
      "Entre as regiões que agregam mais de um município, 56,3% têm na cidade-sede as três referências de acesso efetivo ao mesmo tempo: leito de UTI, curso de graduação presencial e agência bancária. Nas demais a estrutura da sede é parcial, e em nenhuma é totalmente ausente. A presença é medida por acesso efetivo, não por existência do equipamento: hospital sem terapia intensiva e polo apenas de educação a distância não contam como serviço local.",
    fontes: [
      {
        texto: "DATASUS. Cadastro Nacional de Estabelecimentos de Saúde, estabelecimentos e leitos.",
        url: "https://cnes.datasus.gov.br/",
      },
      {
        texto: "INEP. Censo da Educação Superior, cursos de graduação presenciais.",
        url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-da-educacao-superior",
      },
    ],
    ressalvaLocal:
      "Indicadores binários de presença, que não medem capacidade instalada, fila, qualidade nem suficiência do serviço para a população da região.",
  },
  {
    grupo: "painel",
    tema: "Tudo construído com base pública, em cobertura quase censitária",
    texto:
      "O índice usa treze fontes federais abertas, unidas pelo código IBGE de sete dígitos, sem nenhuma junção por nome de município. O pareamento entre as duas bases críticas, REGIC e Siconfi, é de 99,44%, e o índice fecha para 5.513 dos 5.570 municípios, 98,98%, sem imputação: município sem dado fiscal ou de PIB válido sai do universo em vez de receber média. O achado não estava em nenhuma base isolada, e sim na integração entre elas.",
    fontes: [
      {
        texto: "Manifesto de fontes, dicionário de dados e especificação do índice, depositados com DOI citável.",
        url: "https://doi.org/10.5281/zenodo.21431702",
      },
    ],
    ressalvaLocal:
      "Cobertura e pareamento medidos sobre o ano-base declarado; a REGIC é de 2018 e as bases fiscais de 2024, assimetria assumida porque a hierarquia urbana muda em escala de década.",
  },
];

// A separate block, "O que a pesquisa ja mostrou". No arrows, no contiguity
// with the municipal datum: the citations sit in their own card, credited to
// third parties, so the reader never reads the local IDM as confirming or
// refuting a causal estimate (see docs/DECISAO_CAUSAL.md).
export function QuadroLiteratura() {
  return (
    <section
      aria-label="O que a pesquisa já mostrou"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div>
        <h2 style={{ fontSize: "var(--text-lg)" }}>O que a pesquisa já mostrou</h2>
        <p style={{ fontSize: "var(--text-body)", color: "var(--ink-secondary)" }}>
          O IDM é descritivo; o painel não estima efeito causal próprio. Este
          relatório tem duas partes. A primeira reúne achados publicados por
          terceiros sobre dependência fiscal, rede urbana, saúde, ensino
          superior, desenvolvimento humano e escala municipal, cada um com o
          alcance que o método original sustenta e o link para a fonte. A
          segunda apresenta o que este painel apurou nas bases abertas, em
          leitura descritiva, com a fonte e a ressalva de alcance de cada
          número.
          Como ler: os itens da primeira parte são associações ou leituras
          estruturais no nível de grupos de municípios, não causas que se
          apliquem diretamente à sua cidade; os da segunda descrevem o que os
          dados mostram, sem afirmar por que mostram. Nenhum número de uma parte
          confirma ou deriva da outra.
        </p>
      </div>

      {CITACOES.map((c, i) => (
        <div key={c.tema} style={{ display: "contents" }}>
          {(i === 0 || CITACOES[i - 1]?.grupo !== c.grupo) && (
            <h3
              style={{
                margin: 0,
                fontSize: "var(--text-body)",
                color: "var(--ink-secondary)",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "var(--space-1)",
              }}
            >
              {c.grupo === "literatura"
                ? "Parte 1: o que a literatura publicada mostra"
                : "Parte 2: o que este painel apurou nas bases abertas"}
            </h3>
          )}
        <figure style={{ margin: 0 }}>
          <p
            style={{
              margin: 0,
              marginBottom: "var(--space-1)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-title)",
              color: "var(--ink-primary)",
            }}
          >
            {c.tema}
          </p>
          <blockquote
            style={{
              margin: 0,
              paddingLeft: "var(--space-3)",
              borderLeft: "2px solid var(--baseline)",
              color: "var(--ink-primary)",
            }}
          >
            {c.texto}
          </blockquote>
          <figcaption
            style={{
              marginTop: "var(--space-2)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
              fontSize: "var(--text-caption)",
              color: "var(--ink-muted)",
            }}
          >
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
              {c.fontes.map((fonte) => (
                <li key={fonte.url}>
                  <a
                    href={fonte.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    {fonte.texto}
                  </a>
                </li>
              ))}
            </ul>
            <p style={{ margin: 0 }}>{c.ressalvaLocal}</p>
          </figcaption>
        </figure>
        </div>
      ))}
    </section>
  );
}
