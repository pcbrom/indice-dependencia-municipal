# Decisão: causalidade e perguntas visuais por público

Documento de decisão sobre causalidade. Define se o painel do IDM adiciona uma camada causal e quais perguntas importam visualmente, e como agregado, para dois públicos, a população leiga e o gestor público municipal.

## Veredito

Viável. O IDM permanece integralmente descritivo. O painel não estima efeito causal próprio; usa a causalidade apenas na forma mais honesta e barata, citando a literatura consolidada em um quadro separado, com a ressalva de que os efeitos identificados são locais. As perguntas visuais foram separadas por público e classificadas como descritivas ou citação, sem vocabulário causal sobre associação.

## Por que não estimar causal próprio

A tentação natural seria estimar o efeito da dependência de FPM sobre o esforço de arrecadação própria, o efeito flypaper. A decisão é não estimar, por três razões técnicas:

- A ferramenta de refutação disponível (DoWhy) valida ajuste de porta dos fundos, não a validade de uma descontinuidade; um desenho de regressão descontínua sério exigiria teste de densidade, escolha de janela e robustez local, fora do orçamento.
- A distribuição do FPM cria incentivo à fragmentação de municípios abaixo de cerca de 10.188 habitantes, o que sugere possível manipulação da variável de corte; se houver acúmulo em torno das faixas, a descontinuidade deixa de ser exógena e o desenho cai.
- Mesmo um desenho limpo estimaria um efeito local à vizinhança dos cortes, não um efeito para os 5.570 municípios; renderizá-lo como camada nacional afirmaria mais do que o método permite.

O menor uso honesto da causalidade é citar a literatura, não reestimá-la. O efeito flypaper e a preguiça fiscal já estão documentados; o painel os credita e concentra o esforço nas telas descritivas.

## Perguntas visuais e agregados por público

Cada pergunta é marcada como descritiva ou citação. Nenhuma pergunta descritiva recebe enquadramento causal por contiguidade visual.

### População

1. De onde vem o dinheiro que paga os serviços da minha cidade? Descritiva: composição entre receita própria e repasse.
2. Para onde as pessoas da minha cidade viajam quando precisam de hospital, e a que distância? Descritiva: fluxos do REGIC em quilômetros.
3. O que existe de saúde e de escola aqui, e o que só existe no polo? Descritiva: presença por CNES e INEP.

### Gestor

4. Como a composição de receita do meu município se compara à de municípios do mesmo porte e da mesma posição na rede urbana? Descritiva: agregado por faixa populacional cruzada com nível de hierarquia do REGIC.
5. Quantos municípios dependem do meu polo para cada serviço, e quantos habitantes isso representa? Descritiva: agregado de órbita.
6. O que a pesquisa já mostrou sobre transferências e arrecadação própria? Citação de literatura, com identificação de terceiros (descontinuidade nos cortes do FPM) e efeito declarado como local aos cortes, concentrado abaixo de vinte mil habitantes, não extrapolável ao conjunto.

Cortadas por falta de identificação: efeito de perder o polo e lacunas a priorizar. Descreviam causa sem desenho de identificação que a sustente; a mesma realidade é entregue, sem afirmar causa, pelas perguntas 2, 3 e 5.

## Enquadramento não moral do eixo fiscal

O eixo fiscal é o ponto onde a distorção de ler o índice como nota de gestão pode reentrar. O enquadramento é estrutural, nunca moral: a Constituição de 1988 desenhou um sistema em que o FPM é a maior fonte de cerca de sessenta por cento das prefeituras, e cidades pequenas dependem mais por desenho da lei. A comparação é sempre contra municípios do mesmo porte, nunca contra a média nacional, o que faz o gate de compreensão passar por construção.

Redação recomendada, explícita sobre dinheiro para evitar ambiguidade: "A cada R\$ 10 que a prefeitura gasta, quantos vêm de impostos da própria cidade e quantos vêm de repasse federal?" A legenda fixa acompanha: "Isso descreve o tamanho da economia local, não a qualidade da prefeitura." Fica registrada uma ressalva de redação: formulações do tipo "quantos vieram de fora" arriscam leitura de estigma ou de pessoas, não de recursos, e devem ser testadas antes de adotadas; a redação acima, que nomeia imposto e repasse, é preferida até o teste com leigos decidir.

## Alavancas ao gestor sem vocabulário causal

O gestor recebe margem de ação sem que o painel afirme efeito: comparação posicional (o município arrecada um valor; a mediana do seu porte é outro), que informa distância à referência sem alegar causa; o vocabulário causal fica restrito ao quadro de literatura, onde pertence aos autores citados; e separação visual dura entre dado municipal e citação de pesquisa, em blocos distintos, sem setas nem contiguidade que sugira que o dado local confirma o efeito da literatura.

## Salvaguarda visual: dinheiro não é seta no mapa

O fluxo de deslocamento de serviço, do município ao polo, é espacial e pode ser desenhado como grafo de setas sobre o mapa, o ego-graph de órbita do painel. O fluxo fiscal, não. O FPM é transferência vertical da União, sem origem geográfica no território; uma seta de dinheiro entre dois pontos do mapa seria erro de categoria, e uma seta de repasse entrando somada a pouca arrecadação própria lê-se como cidade parasita, a acusação que esta decisão combate. O entra e sai do dinheiro vive em gramática de Sankey na tela fiscal, comparado ao mesmo porte, nunca como seta no mapa. Rótulos de valor nas setas de órbita só sob interação e só com o que a fonte fornece, distância, número de municípios e população, nunca contagem de pessoas por ligação.

## Riscos de leitura a verificar com público leigo

- Gate de culpa: a legenda fixa e a comparação por porte reduzem, mas não garantem, que o leigo não leia baixa arrecadação própria como prefeitura fraca. Critério objetivo de reprovação definido antes do teste.
- Redação do eixo fiscal: risco de leitura de estigma; testar a redação junto ao gate.
- Fidelidade da citação: o quadro de literatura precisa comunicar efeito local sem que o leitor o generalize para a própria cidade.
- Comparabilidade dos grupos de porte e posição: células pequenas geram medianas instáveis ou municípios quase identificáveis; risco técnico de dado, tratado por agregação mínima.
- Separação visual em tela estreita: dado municipal e citação não podem colar no mobile.

## Maior alavanca

O critério objetivo de reprovação do portão de culpa e a redação do eixo fiscal são fixados antes da construção. É o ponto por onde a leitura moralizante pode reentrar.

## Fontes

Dependência fiscal e efeito flypaper:

- IPEA. Efeitos assimétricos das transferências governamentais. Repositório IPEA.
- ANPAD. Análise do efeito flypaper em governos locais brasileiros.
- Congresso USP FIPECAFI, 2023. Efeitos das transferências fiscais intergovernamentais sobre a eficiência de arrecadação.
- Revista Mineira de Contabilidade. Transferências intergovernamentais e gastos públicos: o efeito flypaper nos municípios de Minas Gerais.

Deslocamento para serviços de saúde (REGIC 2018):

- IBGE. Regiões de Influência das Cidades 2018, destaques de deslocamentos para serviços de saúde (72 km para média complexidade, 155 km para alta).
- Fiocruz, Saúde Amanhã. Nota técnica sobre a REGIC 2018.
- IEPS. A regionalização da saúde no Brasil.

Viabilidade e dependência de pequenos municípios:

- Revista de Economia Brasileira, USP. A (in)dependência de pequenos municípios ao FPM no Brasil.
- Senado Federal. A criação de municípios após a Constituição de 1988.
- SciELO, Nova Economia. Características socioeconômicas e tipologia dos municípios de pequeno porte no Brasil.
