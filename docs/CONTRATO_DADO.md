# Contrato de dado

Esquema dos artefatos publicados em `dados/`. O contrato é a fronteira entre quem produz o dado e quem o consome: os campos, tipos e unidades abaixo são garantidos; divergência entre o artefato e esta especificação é defeito. Complementa [IDM_SPEC.md](IDM_SPEC.md).

Formato dos artefatos: dado tabular em JSON pré-agregado por recorte; malha em GeoJSON simplificado, abaixo de 2 MB em Brotli. Os campos e tipos abaixo valem para o JSON; a coluna de tipo descreve o valor JSON.

Chave única em todos os artefatos: `codigo_ibge`, string de sete dígitos, com zeros à esquerda preservados. Nunca numérico, para não perder o zero inicial.

## municipios.json

Um objeto por município em $M$, o universo com dado válido. Granularidade de junção do painel.

| Campo | Tipo | Unidade | Nulo | Descrição |
|-------|------|---------|------|-----------|
| codigo_ibge | string(7) | | não | chave IBGE |
| nome | string | | não | nome do município |
| uf | string(2) | | não | sigla da unidade da federação |
| populacao | int32 | habitantes | não | estimativa do ano-base |
| pib | float64 | reais | não | PIB municipal do ano-base |
| porte_faixa | string | | não | faixa populacional (categórica) |
| tipologia | string | | não | polo, semi-polo ou orbitante |
| polo_ibge | string(7) | | sim | polo de destino da ligação de menor distância; nulo quando o município não tem ligação qualificada. Polo e semipolo podem ter o campo preenchido, por orbitarem um centro de hierarquia superior |
| polo_nome | string | | sim | nome do município em `polo_ibge`, para exibição; nulo junto com `polo_ibge` |
| polo_uf | string(2) | | sim | sigla da unidade da federação do polo; nulo junto com `polo_ibge` |
| distancia_polo_km | float64 | km | não | distância tabulada no REGIC até `polo_ibge`; zero quando não há ligação qualificada |
| fpm | float64 | reais | não | FPM recebido no ano-base |
| receita_total | float64 | reais | não | receita total do município |
| razao_fpm_receita | float64 | proporção | não | $f^{(1)}$, entre 0 e 1 |
| razao_receita_pib | float64 | proporção | não | $f^{(2)}$, pode exceder 1 |
| tem_hospital_mac | bool | | não | hospital de média e alta complexidade (CNES) |
| tem_ies | bool | | não | instituição de ensino superior (INEP) |
| eixo_orbitacao | float64 | 0 a 1 | não | $O_i$ |
| eixo_fiscal | float64 | 0 a 1 | não | $F_i$ |
| eixo_servicos | float64 | 0 a 1 | não | $S_i$ |
| idm | float64 | 0 a 1 | não | índice composto |
| idm_percentil | float64 | 0 a 1 | não | posto percentílico do IDM |
| populacao_estimada | int32 | habitantes | sim | contexto: População Estimada do IBGE, fora dos eixos |
| idhm | float64 | 0 a 1 | sim | contexto: IDHM do Atlas Brasil, base do Censo 2010; nulo para município instalado após 2010 |

Os dois últimos campos formam a camada de contexto: entram por junção à esquerda, não alteram o índice nem o portão de completude, e admitem nulo sem imputação.

## ligacoes.json

Um objeto por ligação orbitante para polo do REGIC, para a camada de fluxo do mapa.

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| origem_ibge | string(7) | não | município de origem |
| destino_ibge | string(7) | não | polo de destino |
| uf_origem | string(2) | não | para agregação por unidade da federação |

## destaques.json

Agregados nacionais de manchete, derivados da partição tipológica do REGIC e da estimativa populacional do IBGE, emitidos por `build.py` como objeto único. A população usa a estimativa corrente (`populacao_estimada`), a mesma somada por polo na camada de leitura automática, de modo que o número nacional reconcilia com as leituras por rede.

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| total_municipios | int | não | municípios no conjunto válido do índice |
| total_populacao | int | não | soma da população estimada no conjunto válido |
| por_tipologia | objeto | não | por papel (orbitante, semi-polo, polo): `n` e `populacao` |
| dependentes | objeto | não | agregado do papel orbitante: `n_municipios`, `populacao`, `share_municipios`, `share_populacao` |
| cobertura | float | não | fração do universo coberta pelo índice (válidos sobre universo) |
| universo | int | não | total de municípios do país, denominador da cobertura |

## malha.geojson

Geometria municipal simplificada, em GeoJSON, derivada da malha do IBGE na qualidade mínima. Cada feição carrega as propriedades `codigo_ibge` (string de sete dígitos, a chave) e `codarea` (código de área da API do IBGE, redundante) para junção com `municipios.json`. A malha completa do IBGE não é publicada; a versão simplificada cabe no orçamento de 2 MB (ver [DADOS.md](DADOS.md)).

## regioes.geojson

Contorno das cinco macrorregiões brasileiras, dissolvido da malha municipal pelo primeiro dígito do código IBGE (1 Norte, 2 Nordeste, 3 Sudeste, 4 Sul, 5 Centro-Oeste), dissolvido sobre o `malha.geojson` do mesmo conjunto. Artefato derivado, sem fonte externa nova; entra no mapa como camada de linha neutra com rótulo por região, nunca como canal de cor do IDM. `FeatureCollection` de cinco feições, uma por região, cada uma com:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| properties.regiao | string | nome da macrorregião (Norte, Nordeste, Sudeste, Sul, Centro-Oeste) |
| properties.centro | [float, float] | ponto interior representativo `[lon, lat]`, para posicionar o rótulo |
| geometry | Polygon ou MultiPolygon | contorno dissolvido e simplificado (Douglas-Peucker, tolerância de 0,02 grau) |

A geometria é linha-guia estrutural, não limite de levantamento. Não carrega `codigo_ibge`: o artefato agrega municípios, não os individualiza.

## mundo.geojson

Cenário de fundo do mapa: contornos dos países na resolução Natural Earth 110m (domínio público), com o Brasil removido por ser o coroplético do painel. Ativo cartográfico decorativo, estático, não derivado das bases do índice. Desenhado como camada de fundo esmaecida (preenchimento a 0,2 de opacidade), sem tiles nem servidor externo, em conformidade com a política de segurança de conteúdo. `FeatureCollection` de feições de país com `properties` vazio (`{}`) e coordenadas arredondadas; a `geometry` é `Polygon` ou `MultiPolygon`. Sem `codigo_ibge` e sem junção com `municipios.json`: puro contorno de fundo.

## manifesto.json

Proveniência por artefato e por fonte, lido pelo componente de selo de fonte e pela nota metodológica. Esquema:

```json
{
  "ano_base_fiscal": 2024,
  "ano_base_regic": 2018,
  "idm_versao": "0.1.0",
  "pesos": { "orbitacao": 0.3333, "fiscal": 0.3333, "servicos": 0.3333 },
  "cobertura": {
    "municipios_universo": 5570,
    "municipios_validos": 5513,
    "percentual": 0.9898,
    "abaixo_do_piso": false
  },
  "fontes": [
    {
      "nome": "REGIC",
      "orgao": "IBGE",
      "ano": 2018,
      "data_extracao": "2026-07-03",
      "url_catalogo": "https://dados.gov.br/...",
      "uso": "hierarquia, tipologia, ligacao orbitante para polo, distancia"
    },
    {
      "nome": "FINBRA/DCA",
      "orgao": "Tesouro Nacional (Siconfi)",
      "ano": 2024,
      "data_extracao": "2026-07-03",
      "url_catalogo": "https://dados.gov.br/...",
      "uso": "receita total, FPM, populacao"
    }
  ]
}
```

Regras do manifesto: `percentual` de cobertura é auditado contra o piso de 0,90, e `abaixo_do_piso` sinaliza quando o piso não é atingido; `data_extracao` em ISO 8601; `url_catalogo` é a evidência de origem de cada base. Um artefato sem entrada correspondente no manifesto não é publicado.

## validacao.json

Relatorio de validacao obrigatoria, publicado junto aos artefatos para que as
afirmacoes do painel sejam checadas, nao aceitas. Objeto unico com:
`n_municipios`; `spearman_idm_log_pop`; `stratify_by_porte` (booleano, verdadeiro
se o gate de 0,8 em modulo for atingido e o ranking passar a ser estratificado);
`corr_eixos` (matriz 3x3 entre orbitacao, fiscal e servicos); `n_receita_maior_pib`;
`n_ligacoes`; `ligacoes_dangling` (pontas de ligacao fora do universo valido,
contadas por ponta, nao por aresta); e `idm_idhm`, com o rho bruto e o parcial
controlando o log da populacao, seus intervalos de bootstrap de 95 por cento, a
decomposicao por eixo e os estratos por porte e regiao, com piso de 50 por celula.

## acesso_saude.json, acesso_educacao.json, acesso_bancario.json

Camadas de acesso efetivo. Cada arquivo traz `fonte`, `data_base`, `n` e a lista
`municipios`. Alimentam a leitura de acesso e, no caso de saude e educacao,
reconciliam a presenca de servico do indice (ver
[DECISAO_ACESSO.md](DECISAO_ACESSO.md)).

| Artefato | Campos por municipio |
|----------|----------------------|
| `acesso_saude.json` | `uti_leitos` (int), `tem_uti` (bool, `uti_leitos > 0`), `leitos_totais` (int), `alta_media_ratio` (float, nulo quando nao ha leito de internacao) |
| `acesso_educacao.json` | `ies_presencial` (bool), `n_cursos_presenciais` (int). So constam municipios presentes na base de origem; ausencia significa nenhuma oferta registrada |
| `acesso_bancario.json` | `tem_agencia` (bool), `n_agencias` (int), `tem_correspondente` (bool), `credito_pc` (float, saldo de operacoes de credito por habitante, nulo onde a ESTBAN nao reporta) |

O campo `credito_pc` e medida parcial: a ESTBAN cobre bancos comerciais e
multiplos com carteira comercial e contabiliza o saldo no municipio da agencia,
nao no do tomador. Publicado como contexto, fora do indice.

## cenarios.json

Custo da maquina publica por municipio, base da analise de agregacao. Traz
`fonte`, `n` e a lista `municipios`, cada um com `codigo_ibge`, `legislativa` e
`administracao`, em reais, correspondendo as funcoes homonimas da despesa por
funcao do exercicio de 2024.

## analise_agregacao.json

Resultado da agregacao por regiao funcional. As regioes formam uma **particao**
do universo: cada municipio pertence a exatamente uma, de modo que a contagem de
municipios e um efetivo, nunca uma soma de pertencimentos, e a soma das
populacoes das regioes iguala a populacao do universo.

Objeto com `fonte`, `unidade`, `n_regioes_funcionais`, `n_regioes_agregadoras`, o
bloco `nacional` e a arvore `regioes`, navegavel de macrorregiao para unidade da
federacao e desta para as regioes funcionais. O bloco nacional e cada nivel
trazem: `n_regioes` (celulas da particao), `n_regioes_agregadoras` (as que tem
mais de um municipio, onde a fusao faz algo), `n_isolados` (regioes de um
municipio so, onde a fusao e inocua), `n_municipios` e `n_orbitantes`; `maquina`, `fpm_hoje`, `fpm_redistribuido` e `camara_suprimida`, em
reais; `idm_atual` e `idm_simulado`, ponderados pela populacao; e
`pct_estrutura`, a fracao de sedes com estrutura preservada, e `estrutura_dist`, a
distribuicao das sedes entre `preservada`, `parcial` e `fraca`. Ambos sao medidos
somente sobre as regioes que agregam: uma regiao de um municipio so nao tem sede
em que concentrar servico.

Cada regiao funcional, dentro de `regioes[macro].ufs[uf].regioes`, traz:

| Campo | Descricao |
|-------|-----------|
| `id`, `ancora` | codigo IBGE de sete digitos da ancora da regiao |
| `ancora_nome`, `ancora_tipologia` | nome e tipologia (polo ou semi-polo) da ancora |
| `uf`, `regiao` | unidade da federacao e macrorregiao da ancora |
| `membros` | lista de codigos IBGE dos municipios da regiao, incluindo a ancora |
| `n`, `populacao` | contagem de municipios e populacao somada |
| `legislativa`, `administracao`, `maquina` | despesa das duas funcoes e a soma, em reais |
| `fpm_hoje`, `fpm_fundido`, `perda`, `frac_perdida` | FPM dos membros hoje, o da regiao fundida, a diferenca e a fracao |
| `coef_somado`, `coef_fundido` | soma dos coeficientes de FPM dos membros e o coeficiente da regiao fundida |
| `camara_suprimida` | despesa da funcao Legislativa dos orbitantes |
| `idm_atual`, `idm_simulado` | IDM medio ponderado pela populacao, atual e assumindo o perfil da ancora |
| `tipologia_fundida` | tipologia que a ancora assumiria com a populacao somada |
| `estrutura` | objeto com `hospital`, `ies`, `uti`, `presencial`, `agencia` (booleanos) e `nivel` (`preservada`, `parcial` ou `fraca`) |

## contornos.geojson

Contornos dissolvidos usados na navegacao da analise de agregacao, em tres
niveis. `FeatureCollection` de **1474** feicoes, cada uma com `properties.tipo` e
`properties.id`:

| `tipo` | Feicoes | `id` |
|--------|---------|------|
| `funcional` | 1443 | codigo IBGE de sete digitos da ancora da regiao funcional |
| `uf` | 26 | sigla da unidade da federacao |
| `regiao` | 5 | nome da macrorregiao |

O total excede as 1443 regioes funcionais porque o artefato carrega tambem os
contornos dos dois niveis superiores de navegacao. A malha e restrita ao universo
do indice antes da dissolucao, de modo que nenhum contorno representa municipio
fora de M. Geometria dissolvida da malha municipal, sem fonte externa nova.

## interpretacoes.json

Leitura interpretativa por município, gerada pelo harness de [INTERPRETACAO.md](INTERPRETACAO.md). Objeto raiz com metadados e a lista `municipios`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| modelo | string | modelo que gerou a leitura |
| gerado_em | string | data de geração (ISO 8601) |
| n | int | número de registros |
| sem_leitura | int | quantos ficaram sem leitura aprovada pelo portão; zero na versão publicada |
| municipios | lista | um registro por município (abaixo) |

Cada registro de `municipios`:

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| codigo_ibge | string(7) | não | chave IBGE |
| como_esta | string | sim | síntese hierarquizada (posição, órbita, serviços, traço fiscal) |
| problema | string | sim | o traço estrutural central frente ao porte |
| rede | string | sim | de quem depende e se o polo resolve, ou o tamanho da rede que sustenta |
| para_o_gestor | lista de string | sim | 1 a 2 leituras de uso frente ao porte, habilitação, não prescrição |
| telas | objeto | sim | fatias por tela: `mapa`, `perfil`, `fiscal`, `ranking`, uma frase cada |
| sem_leitura | bool | sim | presente apenas quando o portão reprovou toda tentativa, caso em que só `ranking` é preenchido; ausente em todos os registros da versão publicada |
| hash | string | não | hash dos campos-fonte, para idempotência |

O conteúdo é descritivo e estrutural, sem juízo de gestão nem afirmação de causa, conforme [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md). A fatia `ranking` é templada de forma determinística; as demais e o consolidado vêm do modelo, sob o GATE.

## Convenções transversais

- Unidades monetárias em reais, sem formatação, com o arredondamento a cargo de quem exibe.
- Datas em ISO 8601.
- Sem valores sentinela para nulo; nulo é `null` no JSON.
- Tipos estáveis entre versões de ano-base; mudança de tipo é quebra de contrato e exige nota.
