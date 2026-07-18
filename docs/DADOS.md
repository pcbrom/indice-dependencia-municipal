# Dicionário de fontes

Origem, data de extração, formato e cobertura de cada base do painel IDM. Chave de junção única: código IBGE de município de sete dígitos. Bases em `data/raw/` não entram no controle de versão; este documento e o `manifesto.json` registram a proveniência. Coleta de 03/07/2026.

## Caracterização das fontes críticas

As duas fontes críticas foram baixadas, caracterizadas e cruzadas. Ano-base fixado: REGIC 2018 (edição mais recente da série) mais FINBRA 2024 (exercício encerrado com maior cobertura).

Medidas de 03/07/2026, executadas sobre o dado real:

- **Match REGIC contra FINBRA pela chave de sete dígitos: 99,44% (5539 de 5570)**, por join efetivo, não inferência. Muito acima do piso de 90%. GO no pilar fiscal.
- **Agregado JSON nacional: 315 KB em Brotli** (municípios 289 KB mais ligações 26 KB; 2,78 MB cru, 450 KB gzip).
- **Malha municipal (5570 feições, API de malhas do IBGE): 486 KB em Brotli** na qualidade mínima (807 KB gzip, 3,5 MB cru), ou 1,68 MB em Brotli na qualidade intermediária. A qualidade mínima é a publicada.

As demais medidas de desempenho são de runtime e de publicação; o payload total do panorama nacional, cerca de 800 KB em Brotli, indica interação rápida mesmo em banda estreita, a confirmar em aparelho no deploy.

## REGIC 2018 (IBGE)

- Uso: hierarquia urbana e ligação orbitante para polo; deslocamento por serviço (saúde, ensino superior); centralidade bancária, de saúde e de ensino.
- Fonte oficial: IBGE, base tabular do REGIC 2018 (resultados definitivos), servida por HTTP direto no geoftp do IBGE, sem bloqueio.
- URL: `https://geoftp.ibge.gov.br/organizacao_do_territorio/divisao_regional/regioes_de_influencia_das_cidades/Regioes_de_influencia_das_cidades_2018_Resultados_definitivos/base_tabular/`
- Arquivos em `data/raw/` (extração 2026-07-03): ligações entre cidades, hierarquia e região, cidades v2, matriz de ligações, séries históricas de hierarquia e de ligações, arranjos populacionais.
- Estrutura: hierarquia com 5570 municípios, chave `codmun` de 7 dígitos em 100% dos casos; ligações com 32062 linhas, `cod_ori` e `cod_dest` de 7 dígitos, das quais 5124 são orbitante para polo (`vinculo = sim`). Validação cruzada: a série histórica de 2018 traz exatamente 5124 ligações, batendo com os vínculos.
- Catalogação no Portal Brasileiro de Dados Abertos: consta (confirmação por snapshot do Wayback Machine; acesso direto ao portal bloqueado por WAF). Satisfaz sozinho a exigência de pelo menos um conjunto catalogado.

## FINBRA / DCA 2024 (Tesouro Nacional, Siconfi)

- Uso: receita total e FPM por município; base do eixo de dependência fiscal.
- Fonte oficial: API de Dados Abertos do Tesouro (Data Lake), endpoint `dca` (Declaração das Contas Anuais, sucessora do FINBRA desde 2014). Não existe CSV único de download em massa para exercícios recentes; a extração é por município.
- Endpoint: `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=2024&no_anexo=DCA-Anexo%20I-C&id_ente={codigo_ibge}`; lista de entes em `.../tt/entes`. Mesmo padrão do pacote R oficial `rsiconfi`.
- Arquivo em `data/raw/`: `finbra_receitas_fpm_2024_ext2026-07-03.csv`, compilação derivada de chamadas por município, 5539 linhas.
- Estrutura: separador `;`, encoding UTF-8, decimal com vírgula; colunas `codigo_ibge; nome; uf; populacao; exercicio; receita_total; fpm`. **Chave já em 7 dígitos nativos** na API; a conversão de 6 mais dígito verificador aplica-se apenas ao FINBRA legado pré-2013, não a esta base. `receita_total` é a receita bruta realizada exceto intra-orçamentárias; `fpm` é a cota-parte do FPM (conta 1.7.1.1.51.0.0), bruta.
- Cobertura medida: 2024 com 5539 de 5570 (99,44%); 2025 com 97,03%, ainda em fechamento. Ano-base escolhido: 2024. Incerteza registrada: 26 municípios (0,47%) sem a linha específica de FPM identificada na base.
- Despesa por função extraída para o custo da máquina pública (DCA-Anexo I-E, exercício 2024, coluna Despesas Empenhadas), pelo mesmo método por ente. Funções extraídas: `01 - Legislativa` e `04 - Administração`, com `Despesas Exceto Intraorçamentárias` como denominador. Endpoint `.../tt/dca?an_exercicio=2024&no_anexo=DCA-Anexo%20I-E&id_ente={codigo_ibge}`. Arquivo em `data/raw/`: `finbra_despesa_funcao_2024_ext2026-07-06.csv` (colunas `codigo_ibge; nome; uf; legislativa; administracao; maquina; despesa_total`), com o agregado nacional, por região e por UF em `agregado_maquina_2024_ext2026-07-06.json`. Cobertura: 5512 de 5513 do universo do painel (um município sem DCA 2024). Leitura de escopo: a função Administração inclui atividades permanentes (administração financeira, planejamento, arrecadação, recursos humanos), não é sinônimo de custo eliminável; o agregado mede o que a máquina custa, não o que se economizaria em uma reforma.
- Catalogação no Portal: consta como DCA (Demonstrativos das Contas Anuais dos Municípios) e como Receita Municipal Anual FINBRA STN/MF (indexado; acesso direto ao portal bloqueado por WAF).

## Fontes complementares

Completam os três eixos do IDM. Chave de sete dígitos em todas.

- **PIB municipal**, IBGE via SIDRA (tabela 5938), ano 2023, cobertura 100% (5570). Usado na razão receita sobre PIB. Arquivo `data/raw/pib_municipal_2023_ext2026-07-03.csv`.
- **CNES**, DATASUS via API de dados abertos da Saúde, presença de hospital geral ou especializado ativo (proxy de média e alta complexidade, não refinado por leitos ou complexidade). 2501 municípios com hospital. Arquivo `data/raw/cnes_hospital_mac_ext2026-07-03.csv`.
- **IES**, cadastro de instituições de ensino superior (e-MEC), presença de instituição com sede ou campus. 698 municípios. Extração de 03/07/2026. A modalidade do curso, que distingue oferta presencial de polo de EAD, vem do Censo da Educação Superior e é tratada na camada de acesso.
- **Malha municipal**, IBGE via API de malhas, qualidade mínima, 5570 feições, 486 KB Brotli. Publicada como `malha.geojson`.

## Camada de contexto (v0.2.0)

Duas fontes de enriquecimento entram como contexto ao lado do índice, nunca como eixo. Extração de 04/07/2026, chave de sete dígitos nativa nas duas, junção à esquerda que não altera o índice nem o portão de completude.

- **População Estimada**, IBGE via SIDRA (tabela 6579, variável 9324), ano 2024, alinhada ao ano-base fiscal. Denominador populacional oficial. Cobertura de 100% (5513 de 5513) dos municípios do índice. Arquivo `data/raw/populacao_estimada_2024_ext2026-07-04.csv`. Campo `populacao_estimada` no `municipios.json`.
- **IDHM**, Atlas do Desenvolvimento Humano no Brasil (PNUD, Ipea, FJP), base do Censo de 2010, obtido pela série ADH_IDHM do IpeaData. Referente externo de desenvolvimento e base da validação descritiva IDM contra IDHM. Cobertura de 99,89% (5507 de 5513); os 6 municípios instalados após o Censo de 2010 (Mojuí dos Campos, Nazária, Pescaria Brava, Balneário Rincão, Pinto Bandeira, Paraíso das Águas) não têm IDHM e ficam nulos, sem imputação. Arquivo `data/raw/idhm_municipal_2010_ext2026-07-04.csv`. Campo `idhm` no `municipios.json`. Safra 2010 declarada na tela e na validação.

A validação descritiva externa (Spearman bruto e parcial controlando log-população, decomposição por eixo, bootstrap, estratificação com piso de 50 por célula, sem valor-p) é publicada em `validacao.json` sob a chave `idm_idhm` e exibida na tela de metodologia. Medida sobre 5507 municípios: Spearman bruto -0,412, parcial -0,479.

## Acesso bancário efetivo (BACEN)

Camada de contexto de acesso efetivo, ao lado do índice e nunca como eixo, conforme [DECISAO_ACESSO.md](DECISAO_ACESSO.md). Separa a agência, que oferta crédito e serviço pleno, do correspondente de escopo limitado, e mede o volume efetivo de crédito por habitante. Não altera o IDM nem seus eixos. Extração de 08/07/2026, chave de sete dígitos, junção à esquerda ao universo do painel. Produz `dados/acesso_bancario.json`. Denominador populacional: `populacao_estimada` de 2024, já no `municipios.json`.

- **Agências de instituições supervisionadas**, BACEN via serviço Olinda `Informes_Agencias`. Presença e contagem de agência por município. Endpoint OData: `https://olinda.bcb.gov.br/olinda/servico/Informes_Agencias/versao/v1/odata/Agencias?$format=json`. Chave `MunicipioIbge` em sete dígitos nativos. Posição 07/07/2026 (campo `Posicao`). Arquivo `data/raw/bacen_agencias_ext2026-07-08.json`, 13953 agências. Cobertura: 2882 dos 5513 municípios do painel têm ao menos uma agência (52,3%); os demais ficam com `n_agencias` igual a zero, que é o dado correto, não faltante. Campos `tem_agencia` e `n_agencias`.
- **Correspondentes no país**, BACEN via serviço Olinda `Informes_Correspondentes`. Presença de ponto de correspondente por município, deduplicada por município (a base bruta repete o município uma vez por linha de contratante e serviço). Endpoint OData: `https://olinda.bcb.gov.br/olinda/servico/Informes_Correspondentes/versao/v1/odata/Correspondentes?$format=json`. Chave `MunicipioIBGE` em sete dígitos nativos. Posição 07/07/2026. Arquivo `data/raw/bacen_correspondentes_ext2026-07-08.json`, 216238 linhas em 5571 municípios distintos. Cobertura: 5513 dos 5513 do painel têm correspondente; o indicador `tem_correspondente` é, portanto, quase não discriminante isolado, e o valor de leitura da camada está no contraste com `tem_agencia` (o município que só tem correspondente, sem agência). Campo `tem_correspondente`.
- **Crédito por habitante**, BACEN, ESTBAN (Estatística Bancária Mensal por Município, documento COSIF 4500), competência 202603. Arquivo mensal em CSV latin-1, separado por ponto e vírgula, em `data/raw/estban_municipio_202603_ext2026-07-08.zip`. O saldo de crédito é a rubrica `VERBETE_160_OPERACOES_DE_CREDITO`, o agregado; as sub-rubricas 161 a 176 estão contidas nela e não são somadas, para não duplicar. A chave de junção é a coluna `CODMUN_IBGE`, de sete dígitos, distinta do `CODMUN` do SISBACEN, de quatro a cinco dígitos, que não é o código do IBGE. O saldo por município é somado sobre as instituições e dividido por `populacao_estimada` para obter `credito_pc`. Cobertura: 2892 dos 5513 municípios têm crédito registrado, alinhados aos que têm agência, dado que a ESTBAN reporta por local de agência; os demais ficam com `credito_pc` nulo, ausência correta e não faltante. A ESTBAN cobre bancos comerciais e múltiplos com carteira comercial, não a totalidade do sistema financeiro, e concentra o saldo no município da agência que contabiliza a operação, de modo que o crédito por habitante é medida parcial, declarada como tal, e permanece fora do índice.

## Camada de acesso efetivo: ensino superior presencial (INEP)

Camada de leitura de acesso ao ensino superior que refina a presença de IES em direção à oferta presencial efetiva por município, distinguindo o curso de graduação presencial do polo de educação a distância. Extração de 08/07/2026, chave de sete dígitos nativa. Além de alimentar a leitura, esta base reconcilia a presença de ensino superior no eixo de serviços do IDM: onde há curso presencial, `tem_ies` é verdadeiro, por implicação lógica (ver [DECISAO_ACESSO.md](DECISAO_ACESSO.md), seção de reconciliação). O alargamento é monotônico, nunca estreita a presença.

- **Ensino superior presencial**, INEP, microdados do Censo da Educação Superior 2024 (divulgados em 30/12/2025). Fonte oficial: INEP, servida por HTTP direto em `https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_2024.zip`. O servidor apresenta cadeia de certificado incompleta, que exige atenção na configuração do cliente HTTP no momento do download. Módulo de cursos (`MICRODADOS_CADASTRO_CURSOS_2024.CSV`, 452 MB descompactado, codificação latin-1), lido em streaming linha a linha. Variável `TP_MODALIDADE_ENSINO` (1 presencial, 2 a distância) separa a modalidade; chave `CO_MUNICIPIO` em sete dígitos nativos, por local de oferta do curso. Artefato `dados/acesso_educacao.json` com `ies_presencial` e `n_cursos_presenciais` por município. Cobertura medida: 3551 municípios com curso de qualquer modalidade, dos quais 1121 com ao menos um curso presencial (34824 registros de curso presencial no total); os demais figuram apenas como polo de EAD, com `ies_presencial` falso, exatamente a distinção pretendida. O ZIP em `data/raw/censup_2024_ext2026-07-08.zip` carrega a data de extração e fica fora do controle de versão; só o artefato agregado é publicado.

## Camada de acesso efetivo: leitos e complexidade em saúde (CNES/DATASUS)

Camada de leitura de acesso à saúde que refina a presença de hospital em direção à intensidade e ao tipo de leito por município, distinguindo o hospital com leito de UTI do hospital sem, e a alta da média complexidade. Extração de 08/07/2026, competência mais recente disponível (Mai/2026). Além de alimentar a leitura, esta base reconcilia a presença de saúde de alta complexidade no eixo de serviços do IDM: onde há leito de UTI, `tem_hospital_mac` é verdadeiro, por implicação lógica (ver [DECISAO_ACESSO.md](DECISAO_ACESSO.md), seção de reconciliação). O alargamento é monotônico, nunca estreita a presença.

- **Leitos por município**, CNES/DATASUS, agregado municipal obtido pelo TabNet (Recursos Físicos, Hospitalar), sem baixar DBC bruto. Duas consultas, ambas com Linha=Município, Incremento=Quantidade existente, competência Mai/2026:
  - Leitos complementares (`http://tabnet.datasus.gov.br/cgi/tabcgi.exe?cnes/cnv/leiutibr.def`, arquivo `lubr2605.dbf`): matriz município por tipo de leito complementar. As colunas cujo rótulo começa por "UTI" (adulto I/II/III, pediátrica I/II/III, neonatal I/II/III, de queimados e coronariana) somam os leitos de UTI, proxy de alta complexidade. Unidade intermediária, unidade de isolamento, cuidados intermediários e suporte ventilatório entram no total de complementares mas ficam de fora da contagem de UTI. A coluna Total dá o total de leitos complementares.
  - Leitos de internação (`http://tabnet.datasus.gov.br/cgi/tabcgi.exe?cnes/cnv/leiintbr.def`, arquivo `ltbr2605.dbf`): total de leitos clínicos, cirúrgicos, obstétricos, pediátricos, hospital-dia e outras especialidades, proxy de média complexidade.
- Variáveis do artefato `dados/acesso_saude.json` por município: `uti_leitos` (contagem de leitos de UTI), `tem_uti` (booleano, `uti_leitos > 0`), `leitos_totais` (internação mais complementares) e `alta_media_ratio` (complementares sobre internação; nulo quando não há leito de internação). Estrutura compacta com `fonte`, `data_base` (`2026-05`), `n` e `municipios`.
- Chave e conversão 6 para 7 dígitos: o TabNet rotula cada linha com o código municipal de 6 dígitos do DATASUS (IBGE sem dígito verificador). Os seis primeiros dígitos do código IBGE de 7 dígitos identificam o município de forma única, sendo o sétimo dígito verificador derivado; a conversão é, portanto, uma bijeção, feita pelo casamento dos seis primeiros dígitos contra a tabela municipal do REGIC (universo de 5570). O preenchimento com zeros à esquerda, sozinho, não recupera o dígito verificador; a normalização atua apenas como padronizador de formato do lado de 7 dígitos da tabela de referência, e a bijeção 6 para 7 é o mecanismo efetivo.
- Cobertura medida: universo de 5570 municípios; 714 com leito de UTI (`tem_uti` verdadeiro), 1646 com algum leito complementar, 3599 com leito de internação. Totais nacionais: 64007 leitos de UTI, 82958 leitos complementares, 457948 leitos de internação. Município ausente das consultas não tem leito registrado no CNES e recebe zero, dado correto e não faltante a imputar. Os CSV crus em `data/raw/cnes_leitos_uti_ext2026-07-08.csv` e `data/raw/cnes_leitos_internacao_ext2026-07-08.csv` carregam a data de extração e ficam fora do controle de versão; só o artefato agregado é publicado.

## Artefatos cartográficos: contorno regional derivado e cenário de fundo

Dois artefatos do mapa não constituem fonte de dado do índice: um deriva da própria malha, o outro é ativo decorativo. Ambos são publicados como GeoJSON estático, sem tiles nem servidor externo.

- **Contorno das macrorregiões (`regioes.geojson`), derivado.** Sem fonte externa: a macrorregião de cada município é o primeiro dígito do código IBGE de sete dígitos (1 Norte, 2 Nordeste, 3 Sudeste, 4 Sul, 5 Centro-Oeste). O artefato resulta da dissolução da malha municipal por essa chave, sobre o mesmo `malha.geojson` publicado. A geometria dissolvida passa por simplificação Douglas-Peucker com tolerância de 0,02 grau, tratada como linha-guia estrutural e não como limite de levantamento, para manter o artefato leve. Cada uma das cinco feições carrega um ponto interior representativo (`representative_point`) que posiciona o rótulo no cliente. O consumo é uma camada de linha neutra, em tom de tinta esmaecida e nunca na rampa de cor do IDM, para ler como geografia e não como segundo canal de dado; o rótulo da região aparece nos zooms afastados e cede lugar aos nomes de cidade na aproximação. Medida de 04/07/2026: 5 feições, 57 KB (58.542 bytes).

- **Cenário de países (`mundo.geojson`), decorativo.** Contornos dos países na resolução Natural Earth 110m (domínio público, Natural Earth), com o Brasil removido, por ser ele o coroplético do painel. As propriedades das feições são retiradas e as coordenadas arredondadas, de modo que o arquivo permaneça um ativo cartográfico de fundo e não uma tabela. É desenhado como camada de fundo esmaecida, com preenchimento a 0,2 de opacidade em estilo Google Earth, abaixo do coroplético, para que o Brasil leia em força plena e o restante do mundo situe o território sem competir com o dado. Ativo cartográfico publicado como ativo estático, não derivado das bases do índice, e sem entrada de proveniência de índice por não alimentar nenhum eixo. Medida de 04/07/2026: 176 feições, 162 KB (165.572 bytes).

## Resultado do IDM 0.1.0

Os artefatos publicados em `dados/` trazem o IDM 0.1.0 sobre 5513 municípios (98,98%), com os três eixos computados. Validação obrigatória:

- Spearman entre IDM e log da população: **-0,690**. Abaixo de 0,8 em módulo, então o ranking não é estratificado por porte: o índice não é um proxy de população.
- Matriz de correlação dos eixos: orbitação e fiscal -0,093, orbitação e serviços -0,292, fiscal e serviços 0,490. Sem par redundante; os três eixos medem coisas distintas.
- Casos verificáveis: 20 municípios com receita acima do PIB; 5124 ligações orbitante para polo do REGIC, das quais 84 arestas têm ao menos uma ponta fora do universo válido, correspondendo a 85 pontas, por falta de dado fiscal.

## Notas sobre a construção do índice

- A extração do FINBRA usa a API do Data Lake do Tesouro por município, não um CSV único.
- A padronização de chave 6 mais dígito verificador prevista no contrato é desnecessária para 2024; manter apenas como salvaguarda se algum dado auxiliar vier em 6 dígitos.
- O portão de completude exclui os municípios sem receita ou sem FPM, e a cobertura real (99,44% menos os 0,47% sem FPM) segue acima do piso.

## Limitações declaradas

- A presença de serviço é binária: registra que o município tem saúde de alta complexidade e ensino superior, não a intensidade da oferta. A camada de acesso qualifica a presença, mas o eixo permanece de dois componentes.
- As safras das bases são assimétricas: REGIC 2018, PIB 2023, exercício fiscal 2024, CNES e BACEN de 2026, IDHM de 2010 na validação externa.
- O crédito por habitante da ESTBAN cobre bancos comerciais e múltiplos com carteira comercial e é contabilizado no município da agência, não no do tomador; entra como contexto, fora do índice.
- Os 57 municípios fora do universo não são publicados como lista; a exclusão se reconstrói aplicando o portão de completude sobre as mesmas bases.

