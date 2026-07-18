# Brasil em Órbita: Índice de Dependência Municipal (IDM)

Documento de definição do problema que o Índice de Dependência Municipal endereça.

## 1. Contexto

O IBGE, no estudo **REGIC (Regiões de Influência das Cidades)**, hierarquiza a rede urbana brasileira: metrópoles, capitais regionais, centros subregionais e centros de zona somam cerca de 862 cidades com centralidade real. Os demais, mais de quatro mil municípios, são **centros locais**: lugares cuja população depende de outra cidade para acessar saúde de média e alta complexidade, ensino superior, serviço bancário e cartorial. A vida econômica desses municípios acontece a 30, 50 ou 80 quilômetros de distância, na cidade que exerce a função de polo.

A esse desenho funcional soma-se um desenho fiscal: parte relevante dos centros locais tem prefeitura que movimenta mais recursos do que o próprio produto interno bruto municipal, sustentada por transferências constitucionais, sobretudo o Fundo de Participação dos Municípios (FPM). Existe, portanto, uma engrenagem de dependência que raramente é vista de forma integrada.

## 2. Problema

A informação necessária para enxergar essa engrenagem existe, aberta e oficial, porém dispersa em bases distintas (IBGE, Tesouro Nacional, DATASUS, INEP). Não há um instrumento público que integre função urbana, dependência fiscal e concentração de serviços para responder, por município, a duas perguntas simples:

1. Para onde a vida deste município acontece, ou seja, qual é o seu polo e o que ele consome fora dos próprios limites?
2. Quem custeia esta prefeitura, e em que medida ela depende de transferência em vez de economia própria?

## 3. Objetivo e produto

Construir um **observatório interativo (painel navegável)** que classifica cada município brasileiro por sua função na rede urbana, cruza essa função com a dependência fiscal e a concentração de serviços, e sintetiza tudo em um **Índice de Dependência Municipal (IDM)**. O produto deve permitir consulta por município, por unidade da federação, por tipologia e por porte, e apresentar o mapa das órbitas entre centros locais e seus polos.

## 4. Tipologia funcional

Três camadas, derivadas da hierarquia REGIC:

- **Polo:** organiza fluxo e atrai população de fora (metrópole, capital regional, centro subregional).
- **Semi-polo:** centralidade intermediária (centro de zona).
- **Orbitante:** centro local, cuja vida econômica e consumo de serviços ocorrem em outra cidade.

Cada município orbitante fica associado ao seu polo de destino, ligação que o próprio REGIC fornece.

## 5. Índice de Dependência Municipal (IDM)

Índice composto, normalizado no intervalo de 0 a 1, com três eixos de igual peso na versão inicial (pesos a calibrar):

1. **Orbitação:** destino e distância do fluxo principal no REGIC. Quanto mais longe e mais externo o consumo de serviços, maior a contribuição.
2. **Dependência fiscal:** razão FPM sobre receita total; e razão receita da prefeitura sobre o PIB municipal. Captura o caso em que a prefeitura movimenta mais do que a cidade produz.
3. **Autossuficiência de serviços (invertida):** presença de hospital de média e alta complexidade (CNES) e de instituição de ensino superior (INEP). Ausência de serviços aumenta o índice.

IDM alto indica município mais dependente e mais orbitante; IDM baixo indica polo autossuficiente.

## 6. Fontes de dados abertos

Todas federais e de uso livre. Chave de junção comum: código IBGE do município.

| Dado | Fonte oficial | Uso |
|------|---------------|-----|
| REGIC 2018 (Regiões de Influência das Cidades) | IBGE | Hierarquia e ligação orbitante para polo |
| Estimativas de população; PIB dos Municípios | IBGE | Porte e eixo fiscal |
| Malha municipal (shapefiles) | IBGE | Base cartográfica do mapa |
| FINBRA / Siconfi (receitas e despesas municipais) | Tesouro Nacional (STN) | Dependência fiscal |
| FPM (transferências constitucionais) | Tesouro Nacional (Siconfi, DCA) | Percentual de FPM |
| CNES (estabelecimentos de saúde) | DATASUS | Concentração de saúde |
| Cadastro de Instituições de Ensino Superior | INEP | Concentração de ensino superior |
| Agências, correspondentes e ESTBAN | Banco Central | Acesso bancário, camada de contexto |

Os dois itens críticos para a viabilidade são REGIC (define a órbita) e FINBRA/Siconfi (define a dependência fiscal). Devem ser validados primeiro.

## 7. Método

1. Ingestão e padronização das bases pela chave de município (código IBGE de sete dígitos).
2. Construção da tipologia funcional a partir do REGIC.
3. Cálculo dos três eixos e composição do IDM, com normalização e documentação dos pesos.
4. Camada geoespacial de ligações origem para destino (orbitante para polo).
5. Painel com as telas da seção 8.
6. Validação: conferência de casos citados publicamente (por exemplo, municípios cuja receita supera o PIB) e checagem de consistência das ligações REGIC.

## 8. Telas do painel

1. **Mapa de órbitas (Brasil):** cada centro local ligado por uma linha ao seu polo; cor pela intensidade do IDM; filtros por unidade da federação, tipologia e porte.
2. **Perfil do município:** dado um município, mostra o polo, a distância, o que consome fora, receita contra PIB e o percentual de FPM.
3. **Eixo fiscal:** dispersão FPM contra PIB; destaque das prefeituras que movimentam mais do que o próprio PIB; ranking.
4. **Ranking do IDM:** municípios mais dependentes, com corte por porte populacional.
5. **Contexto internacional:** quadro comparando o Brasil com Dinamarca, Japão e Suécia (número de municípios, limiar populacional para existência de município), como moldura para o debate de reorganização.

## 9. Critérios de sucesso

- Reúso integrado de múltiplas bases abertas federais, não de um único conjunto.
- Produto navegável e reproduzível, com método documentado.
- Narrativa cívica clara: transparência sobre a arquitetura de dependência municipal.

## 10. Restrições

- Apenas dados abertos oficiais; toda fonte citada com origem e data de extração.
