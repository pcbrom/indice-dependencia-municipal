# Decisão: cenários de escala municipal (concavidade do FPM e simulador)

Define o que o painel entrega sobre reorganização municipal e sob que salvaguardas. Complementa [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md) (postura descritiva e não moral). O núcleo mínimo defensável é a concavidade do coeficiente do FPM; sobre ele, o simulador interativo é admitido apenas sob a arquitetura de honestidade descrita adiante.

## Veredito

O painel entrega duas superfícies, em camadas de compromisso distintas:

- **Bloco descritivo estático na tela fiscal:** a leitura da concavidade do coeficiente do FPM, aritmética da regra vigente, que mostra por que o repasse recompensa a fragmentação municipal. Fundir municípios pequenos derruba o coeficiente e, portanto, o repasse; cooperar sem fundir o preserva. Descritivo, não recomendação.
- **Aba interativa Brasil em Cenários:** um simulador ancorado em que o gestor seleciona um agrupamento contíguo e lê o custo hoje, o efeito determinístico da fusão e uma faixa especulativa de consórcio. Admitido porque a arquitetura de honestidade abaixo impede que o número especulativo tome a autoridade do medido.

## Arquitetura de honestidade do simulador

Três riscos foram identificados no simulador: sensibilidade assimétrica (o eixo do FPM é determinístico e não vira ao mover parâmetro), número autogerado mais persuasivo que o rótulo, e líquido de consórcio dirigido por parâmetros sem calibração brasileira. A aba os neutraliza por construção, não por aviso:

- **Três camadas separadas visualmente**, para que nenhum número especulativo empreste a autoridade de um medido. Medido (custo da máquina hoje, FPM hoje, Siconfi); determinístico (FPM se fundido pela tabela do coeficiente, câmara suprimida); especulativo (líquido de consórcio).
- **O consórcio nunca é ponto, é faixa.** O líquido varre todo o intervalo dos dois parâmetros (economia de escala e custo de governança) e aparece como banda cruzando o zero, com o rótulo fixo de que o sinal depende da premissa, não do dado. O usuário não escolhe um valor: vê que qualquer valor é possível.
- **Contiguidade forçada.** Só agrupamentos de municípios que fazem fronteira real (grafo de adjacência derivado da malha municipal) e do mesmo estado, coerente com a repartição estadual do FPM e com o piso legal de fusão.
- **Duas ressalvas fixas em todo relatório:** a perda de FPM não é economia da União, é redistribuída no estado; a Administração inclui atividades permanentes, não é custo que some com menos municípios.
- **Codificação de cor do sinal.** Prejuízo em vermelho, economia em verde, nos painéis e na faixa, para leitura imediata do que é perda e do que é economia, sem que a cor substitua o número.
- **Cenários prontos, um clique.** Um agrupamento de pequenos contíguos por macrorregião, gerado por regra neutra e reproduzível, como ponto de partida sempre editável; o preset não afirma desfecho, os painéis computam cada resultado.
- **Contexto de órbita mantido.** O simulador roda sobre o mesmo mapa do Mapa de órbitas, com o coroplético do IDM como base, os nomes de polo, semipolo e orbitante e as arestas com seta da rede REGIC do município semente, para que o agrupamento seja lido contra a estrutura urbana real.

## O que continua de fora

- Grade de cenários pré-computados com vencedor predeterminado, ou painel de comparação líquida ação contra ação: substituídos pela seleção livre com as três camadas.
- Líquido de consórcio como valor único: só a faixa de sensibilidade, enquanto a economia de escala e o custo de governança não forem calibrados contra dado brasileiro (demonstrativos de consórcios no Siconfi; Araújo et al., 2025).
- A afinidade de atividade pelo setor dominante do valor adicionado bruto, para municípios pequenos: nos pequenos o setor dominante é Administração pública, colinear com a dependência de FPM, o que torna o critério circular. Só entra excluindo a Administração pública.
- A rede REGIC como formadora de cluster de consórcio: mede órbita vertical de consumo, não cooperação horizontal; fica como anotação até validação contra regiões de saúde ou comissões intergestores regionais.

## O bloco estático da tela fiscal

Um bloco descritivo estático na tela fiscal do painel:

- **A curva do coeficiente do FPM por faixa de população**, com o piso de 0,6, mostrando os degraus da tabela do Tesouro. É aritmética da lei vigente, depende só da população, sem critério nem parâmetro.
- **A concavidade**: fundir dois municípios da faixa mínima leva o coeficiente somado de 1,2 para 0,6, perdendo cerca de metade do FPM da soma; conforme as populações cruzam faixa, a perda vai de metade a zero. Ilustrada por pares adjacentes reais, cada exemplo rotulado por município, com aviso fixo de que é ilustração, não frequência nacional.
- **O FPM em dois lados**: a redução que a região deixa de receber é redistribuída aos demais municípios do mesmo estado, pois o pool estadual é fixo. Nunca uma perda unidirecional rotulada punitiva, que seria o análogo fiscal da leitura de cidade parasita que [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md) combate.
- **A União no fato terminal**: fundir não reduz o que a União paga de FPM; é neutra para o caixa federal. Sem alavanca de reduzir o percentual do repasse.
- **A câmara economizada como contexto medido**: a economia de câmara de um município pequeno, medida no Siconfi (função Legislativa, Anexo I-E), mediana da ordem de dois milhões e meio de reais ao ano, é muito menor que a perda de FPM de uma fusão. Reportada como comparação de magnitude, sem número líquido, sem a parcela arbitrada da Administração.

## Salvaguardas de postura

- Enquadramento descritivo: o bloco e a aba descrevem o incentivo do FPM à fragmentação e testam cenários, não recomendam fundir nem cooperar. Sem contagem de cargos políticos elimináveis como métrica de destaque.
- Nome neutro na interface: a aba se chama Brasil em Cenários.
- **Portão de compreensão.** O bloco e a aba são as superfícies mais prescritivas do painel, por isso passam por um protocolo de compreensão com critério fixado antes do teste: cinco participantes, a pergunta isto recomenda fundir municípios, reprovação se quatro de cinco leem como recomendação. Acrescido de leitura crítica por gestor público (a peça aciona reforma?). Se a aba reprovar, o líquido especulativo de consórcio recua para a faixa apenas, ou é retirado, mantendo as camadas medida e determinística; se o bloco reprovar, recua para a curva do coeficiente em abstrato, sem exemplos com valores.

## Achados de viabilidade

Medidas de julho de 2026 sobre dado real de 2024, que fundamentam o bloco:

- Coeficiente do FPM por faixa, com piso de 0,6; fundir dois mínimos leva de 1,2 para 0,6, de metade a zero conforme o cruzamento de faixa.
- Despesa por função no Siconfi (DCA Anexo I-E), Legislativa e Administração separadas; câmara de pequeno com mediana da ordem de dois milhões e meio ao ano.
- Máquina (Legislativa e Administração) é cerca de 13% da despesa; o restante é serviço, empurrado pelas mínimas constitucionais de 15% em saúde e 25% em educação.
- Numa amostra ilustrativa de quatro clusters adjacentes de pequenos, a fusão deu líquido regional negativo, e a cooperação preservou o FPM; exemplo por cluster, nunca frequência nacional.

## Fontes de dado

- Coeficiente do FPM: tabela por faixa de população, regras do Tesouro Nacional e do TCU.
- FPM e população por município: artefatos do painel (`municipios.json`).
- Despesa por função (custo da máquina): Tesouro Nacional, Siconfi, DCA Anexo I-E, exercício 2024; artefatos do simulador publicados em `dados/`: `cenarios.json`, `analise_agregacao.json` e `contornos.geojson`.

## Evidência internacional

Sustenta a leitura de que a amalgamação raramente entrega a economia prometida, e cita terceiros, não afirma efeito próprio: [Blom-Hansen et al. (2016)](https://doi.org/10.1017/s0003055416000320); [Allers e Geertsema (2016)](https://doi.org/10.1111/jors.12268), sem redução de gasto em quinze anos; Auckland, com gasto em alta; Quebec, fusão revertida por plebiscito; contra a cooperação da intercommunalité francesa e dos consórcios da Lei 11.107/2005 ([Araújo et al., 2025](https://doi.org/10.47402/ed.ep.c.253567011)); revisão em [Tavares (2018)](https://doi.org/10.2478/mgrsd-2018-0005).

## Escopo e cronograma

O bloco da concavidade do FPM e a aba Brasil em Cenários integram o painel, ambos sob o portão acima. A seleção do agrupamento é geográfica, num mapa no mesmo padrão do Mapa de órbitas, com contiguidade forçada. A calibração brasileira dos parâmetros de consórcio (para converter a faixa em estimativa central) fica como trabalho futuro; a prioridade é o portão de compreensão.
