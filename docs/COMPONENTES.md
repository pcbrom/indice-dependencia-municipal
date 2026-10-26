# Contrato de componentes

Inventário dos componentes React do painel, com props e estados, para que a implementação seja consistente e um padrão sirva a uma função em todas as telas. Veste os tokens de [TOKENS.md](TOKENS.md) e consome o contrato de [CONTRATO_DADO.md](CONTRATO_DADO.md). Componentes base usam primitivos Radix estilizados pelos tokens, nunca kit pré-pintado.

Notação de props em TypeScript abreviado. Todo componente interativo cobre repouso, hover, foco, ativo e desabilitado; onde há dado, também vazio e carregando.

## Navegação e busca

**Nav**
- props: `rotaAtiva: Rota`, `lead?: string`, `subLead?: string`
- `lead` é o título da tela exibido à esquerda da barra, antes das abas (o título do mapa cavalga ali, dispensando faixa própria acima dele); `subLead` é a segunda linha sob o `lead` (a tese do mapa). Sem `lead`, a nav cresce e mantém metodologia e o alternador de tema fixados à direita.
- renderiza o `ChipFoco` (cidade em foco), o alternador de tema (claro e escuro) e o link de metodologia; persistente em todas as telas. Aceita `rotaAtiva` para o realce, mas o `NavLink` também deriva a rota ativa da URL.

**ChipFoco**
- props: nenhuma; lê a seleção compartilhada por `useSelecao` e o nome pela lista de municípios cacheada na sessão.
- chip da cidade em foco na nav: o nome abre o perfil (`/municipio/:codigo`), o "X" (e o Escape global) limpa a seleção em todas as telas. Oculto quando nada está em foco.
- estados: oculto (sem foco), com cidade (nome resolvido ou código enquanto carrega).

**ThemeToggle**
- props: nenhuma; lê e grava `data-theme` na raiz.
- estados: claro, escuro.

**BuscaMunicipio** (primeiro elemento no mobile)
- props: `onSelect: (codigoIbge: string) => void`
- estado interno: `query`, `resultados`, `carregando`
- comportamento: autocompletar por nome, tolerante a acento e grafia, resolve para `codigo_ibge`; selecionar navega ao perfil.
- estados: vazio (placeholder "Encontre sua cidade"), carregando, sem resultado, com lista.

## Identidade e índice

**BadgeTipologia**
- props: `tipologia: "polo" | "semi-polo" | "orbitante"`
- rótulo textual sempre ao lado; três estados visuais fixos, identidade nunca só por cor.

**BarraIDM**
- props: `valor: number` (0 a 1), `percentil: number` (0 a 1), `mediana: number`
- desenha a barra com marcador do município e tique da mediana; na leitura leiga recebe âncoras textuais nas pontas (autossuficiente à esquerda, orbitante à direita).

**BlocoHeroiIDM** (primeira dobra do perfil)
- props: `idm: number`, `percentil: number`, `mediana: number`
- compõe o número herói, a frase percentílica ("mais dependente que X por cento"), a `BarraIDM` e a linha fixa anti-distorção; nada mais na primeira dobra.

## Estatística

**StatTile** (uma linha)
- props: `rotuloComum: string`, `valor: string`, `termoTecnico?: string`, `unidade?: string`
- a frase comum vem antes; o termo técnico fica recolhido num controle "?" que abre sob toque, não em hover.
- estados: repouso, definição aberta.

**GrupoStat**
- props: `titulo: string`, `tiles: StatTile[]`, `fonte: FonteRef`
- agrupa tiles por pergunta do cidadão ("Para onde a vida vai", "Quem paga a prefeitura", "O que falta na cidade"); a fonte vira um `SeloFonte` único ao pé do grupo.

**SeloFonte**
- props: `fonte: string`, `dataExtracao: string` (lidos do manifesto)
- exibe o par fonte e data junto a cada figura ou grupo.

## Mapa

**MapaOrbitas** (MapLibre GL)
- props: `filtros: FiltrosMapa`, `municipioSelecionado?: string`, `ligacoes?: Ligacao[]`, `onMapaPronto?: (info: MapaProntoInfo) => void`, `onSelecionarMunicipio?: (codigoIbge: string) => void`
- carrega a malha, os municípios, as regiões e o mundo por conta própria e faz o join client-side por `codigo_ibge`. Camadas: cenário do mundo (Natural Earth, Brasil removido, a ~20% de opacidade ao fundo), coroplético do IDM (único canal de cor), contorno das cinco macrorregiões, contorno das 27 capitais como referência geográfica, realce de seleção e pontos de polo/semi-polo.
- clusterização nativa (supercluster no source GL): bolhas HTML com contagem abaixo de `clusterMaxZoom`, pontos individuais acima. Rótulos de nome de cidade com declutter por colisão, priorizados por hover, rede da seleção, polos e semi-polos por população; rótulos de macrorregião no inverso do zoom.
- `onSelecionarMunicipio` dispara no clique de um ponto de polo/semi-polo ou do preenchimento coroplético de qualquer município; é seleção, nunca navegação (routes/mapa.tsx revela o `PainelPolo`). `onMapaPronto` dispara uma vez, após a malha e as camadas entrarem, entregando a instância viva e a malha unida ao `EgoGraphOrbita`.
- na seleção, a rede da cidade (ela, o polo e os orbitantes que apontam para ela) recebe spotlight: o coroplético dos não membros esmaece e a órbita fica acesa nas cores do IDM.
- estados: carregando (mapa carrega sob demanda), erro (malha ou índice não carregados), selecionado (realce mais spotlight).

**EgoGraphOrbita** (camada deck.gl sobre MapLibre)
- props: `municipio: string` (codigo_ibge), `ligacoes`, `modo: "saida" | "entrada" | "ambos"`
- desenha, para o município selecionado, a seta de saída ao polo e, se polo, as setas de entrada dos orbitantes; rótulo de valor (distância, nº de municípios, população) só sob interação.
- restrição: espacializa apenas deslocamento de serviço; nunca fluxo de dinheiro (ver [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md)).
- estados: sem seleção, um município, polo com muitos dependentes.

**PainelPolo**
- props: `municipio: Municipio`, `municipios: Municipio[]`, `ligacoes: Ligacao[]`, `onFechar: () => void`, `onAbrirDetalhe: (secao?: SecaoDetalhe) => void`
- painel lateral revelado pelo clique em um ponto de polo/semi-polo, no preenchimento de qualquer município ou por seleção na busca (Tela 1). Resume rede urbana, eixo fiscal, serviços e grau de dependência estrutural (as três barras de eixo do IDM), sempre por porte, nunca pela média nacional; dinheiro nunca vira seta no mapa. `municipios` resolve a população de cada orbitante que aponta para a cidade.
- o clique agora só seleciona: "ver detalhe completo" chama `onAbrirDetalhe`, único caminho adiante, que abre o `DetalheMunicipio` sem sair do mapa.
- comportamento: move o foco para o painel a cada montagem ou troca de seleção; Escape fecha.

**DetalheMunicipio**
- props: `municipio: Municipio`, `municipios: Municipio[]`, `ligacoes: Ligacao[]`, `manifesto?: Manifesto | null`, `secaoInicial?: SecaoDetalhe`, `onFechar: () => void`
- `SecaoDetalhe` é `"grau" | "fiscal" | "ranking" | "rede"`; `secaoInicial` rola a seção pedida para a vista ao abrir.
- moldura consolidada sobre o mapa, o dossiê da cidade em um só quadro rolável: grau de dependência, para onde a vida vai, o que a cidade tem, eixo fiscal, posição no ranking e rede de dependência (via `DendrogramaRede`). O rodapé alterna a vista da moldura entre o dossiê e as dimensões cheias (perfil, eixo fiscal, ranking), abertas no lugar; cada vista cheia tem link "abrir em tela cheia" para a rota dedicada, com a seleção preservada pelo contexto.
- estado interno: `vista: "resumo" | "perfil" | "fiscal" | "ranking"` e `expandidos: Set<string>` (nós abertos do dendrograma).
- diálogo com foco preso: foca a moldura ao abrir, cicla Tab dentro dela, restaura o foco ao fechar; Escape fecha e tem a propagação interrompida, para o Escape global não limpar a seleção (fechar mantém a cidade em foco).

**FiltroTipologia** (chips)
- props: `classes: { classe, contagem, ativa }[]`, `onToggle`
- três chips com contagem; acendem e apagam classes. A tipologia é filtro, não marca no ponto.

**LegendaIDM**
- props: `escala`
- barra de uma linha, fixa acima do mapa: rampa azul mais "mais escuro = mais dependente".

## Gráficos e tabela

**DispersaoFiscal** (Observable Plot em React)
- props: `dados: Municipio[]`, `rotuloFiltro: string`, `destaque?: string`, `cortesPorte?: Map<string, CortesPorte>`
- `dados` já vem filtrado por porte pelo chamador; `rotuloFiltro` descreve o recorte ativo e entra no aria-label; `destaque` é o `codigo_ibge` da cidade em foco, desenhada com anel de acento sobre o ponto; `cortesPorte` traz as medianas de FPM/receita e receita/PIB por porte, para o tooltip nomear o quadrante fiscal de cada município frente a pares do mesmo tamanho.
- dispersão receita sobre PIB contra participação do FPM na receita, cor de cada ponto pelo IDM na rampa espectral do mapa; cruz de quadrantes na mediana do porte, linha tracejada onde receita iguala PIB. Zoom pela roda do mouse até o cursor, pan por arraste, duplo-clique reseta; alternador de escala linear ou log-log. Modal "como ler os quadrantes" descreve os quatro cantos.
- estados: repouso, vazio (recorte sem municípios), ajuda aberta (modal dos quadrantes).

**SankeyOrcamento** (fluxo entra e sai, fora do mapa)
- props: `municipio: string`, `entradas: { origem, valor }[]`, `saidas: { categoria, valor }[]`, `porteReferencia`
- diagrama de fluxo do orçamento: entradas (imposto próprio, FPM, outras transferências) para saídas (grandes categorias de gasto); comparado sempre ao mesmo porte, com a legenda não moral.
- restrição: gramática de Sankey, nunca seta no mapa; valores em reais formatados na exibição.
- estados: vazio, carregando.

**TabelaRanking**
- props: `dados`, `agruparPor: "tipologia" | "porte"`, `busca`, `municipioSelecionado?`
- primeira coluna é a faixa percentílica, não a posição ordinal; ordenável e buscável; título "Grau de dependência estrutural"; nota fixa que separa dependência de gestão; exporta CSV.
- estados: vazio, carregando, linha selecionada em destaque.

**DendrogramaRede** e **TabelaRede**
- props (ambos, mesma interface): `raiz: NoRede`, `expandidos: Set<string>`, `onAlternar: (codigo: string) => void`
- `DendrogramaRede` desenha a árvore de quem depende da cidade selecionada como dendrograma SVG expansível, nós tingidos pelo IDM na rampa espectral; um nó com dependentes alterna o ramo no clique (ou Enter/Espaço). Só o subárvore expandida é posicionada, de modo que o diagrama escala a qualquer polo sem desenhar milhares de nós.
- `TabelaRede` é o equivalente acessível operável por teclado: árvore aninhada (`role="tree"`) que compartilha o mesmo estado `expandidos`, de forma que expandir num lado reflete no outro. O estado dos nós abertos vive no chamador (a rota ou o `DetalheMunicipio`), fonte única entre gráfico e tabela.

**ValidacaoIdmIdhm** (Observable Plot em React)
- props: `dados: ValidacaoIdmIdhmDados`, `municipios: Municipio[]`
- vive só na tela de metodologia; dispersão do IDM contra o IDHM de 2010 mais os números endurecidos: Spearman bruto e parcial controlando log-população, decomposição por eixo, intervalos por bootstrap, estratificação com piso por célula, badge de safra 2010, sem valor-p. Rotulado como associação descritiva exploratória, nunca validade convergente nem causa, conforme [DECISAO_CONTEXTO.md](DECISAO_CONTEXTO.md).

**QuadroLiteratura**
- props: `citacoes: { tema, texto, fontes: { texto, url }[], ressalvaLocal }[]`
- bloco separado, "O que a pesquisa já mostrou", com sete temas de literatura de terceiros datados e com link resolvível por DOI ou fonte institucional (verificados via OpenAlex e Crossref); sem setas nem contiguidade com o dado municipal, conforme [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md).

**BotaoLiteratura**
- props: nenhuma.
- botão flutuante presente em toda tela que abre o `QuadroLiteratura` como camada sobre a página, em vez de um bloco fixo ao pé da tela de metodologia. O IDM é descritivo, não causal: a literatura fica a um clique, creditada a terceiros, nunca contígua ao dado municipal.
- estado interno: `aberto`. Escape fecha a camada.

## Utilitários transversais

**Tooltip** (Radix)
- camada flutuante padrão em mapa, dispersão e tabela; alvo de toque maior que a marca.

**EstadoVazio** e **EstadoCarregando**
- padrões reusados por qualquer componente de dado; texto claro, sem jargão, com esqueleto no carregamento.

**AlternaGraficoTabela**
- todo gráfico oferece a mesma informação em tabela, requisito de acessibilidade e de transparência.

**Contexto de seleção** (`lib/selecao.tsx`: `SelecaoProvider`, `useSelecao`)
- `useSelecao` retorna `{ codigo: string | null, selecionar: (codigo: string | null) => void, limpar: () => void }`.
- cidade em foco compartilhada entre todas as telas, de modo que a seleção sobrevive à navegação entre abas. Persistida em `sessionStorage` (chave `idm.cidadeFoco`), sobrevivendo a um reload. Escape global limpa o foco, exceto durante digitação em campo de texto; o "limpar" do `ChipFoco` na nav faz o mesmo.
