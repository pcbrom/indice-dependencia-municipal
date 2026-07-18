# 01: Fontes e extração

Todas as bases são federais, abertas e de acesso livre. A tabela traz o endereço
exato usado e a data de extração; o detalhamento de cada uma, com cobertura
medida e ressalvas, está em [docs/DADOS.md](../docs/DADOS.md).

## Bases do índice

| Base | Órgão | Ano-base | Extração | Endereço |
|------|-------|----------|----------|----------|
| REGIC, hierarquia e ligações | IBGE | 2018 | 03/07/2026 | `geoftp.ibge.gov.br/organizacao_do_territorio/divisao_regional/regioes_de_influencia_das_cidades/` (base tabular dos resultados definitivos) |
| FINBRA/DCA, receita e FPM | Tesouro Nacional (Siconfi) | 2024 | 03/07/2026 | `apidatalake.tesouro.gov.br/ords/siconfi/tt/dca`, consulta por município |
| PIB dos Municípios | IBGE (SIDRA t. 5938) | 2023 | 03/07/2026 | `apisidra.ibge.gov.br/values/t/5938/n6/all/v/37/p/last` |
| CNES (estabelecimentos) | DATASUS | 2026 | 03/07/2026 | `cnes.datasus.gov.br`, hospital de média e alta complexidade |
| CNES (leitos) | DATASUS | 2026 | 08/07/2026 | TabNet, leitos de internação e complementares (UTI) |
| Cadastro de IES (e-MEC) | INEP/MEC | 2026 | 03/07/2026 | `emec.mec.gov.br`, presença de instituição de ensino superior |
| Censo da Educação Superior | INEP/MEC | 2024 | 08/07/2026 | `download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_2024.zip`, módulo de cursos, variável de modalidade |
| Informes de agências e correspondentes | Banco Central | 2026 | 08/07/2026 | serviço Olinda, `olinda.bcb.gov.br/olinda/servico/Informes_Agencias` |
| ESTBAN | Banco Central | 2026 | 08/07/2026 | `bcb.gov.br/estatisticas/estatisticabancariamunicipios`, competência 202603 |

A presença de ensino superior usa as duas bases do INEP em conjunto: o cadastro
do e-MEC e a modalidade do curso no Censo, esta última responsável pela
reconciliação descrita em [02-metodo.md](02-metodo.md).

## Bases de contexto e cartografia

| Base | Órgão | Ano-base | Extração | Endereço |
|------|-------|----------|----------|----------|
| População Estimada | IBGE (SIDRA t. 6579) | 2024 | 04/07/2026 | `apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/2024` |
| IDHM, Atlas Brasil | PNUD, Ipea e FJP | 2010 | 04/07/2026 | IpeaData, série `ADH_IDHM` |
| Malha municipal | IBGE | 2022 | 03/07/2026 | `servicodados.ibge.gov.br/api/v3/malhas/paises/BR`, qualidade mínima |
| DCA Anexo I-E, despesa por função | Tesouro Nacional (Siconfi) | 2024 | 06/07/2026 | `apidatalake.tesouro.gov.br/ords/siconfi/tt/dca`, funções Legislativa e Administração |

## Chave de junção

Código IBGE do município, **sete dígitos**, string com zeros à esquerda
preservados. Nenhuma junção usa nome de município.

Duas fontes trazem chave de seis dígitos, sem o dígito verificador: o TabNet do
DATASUS e a ESTBAN. A conversão para sete dígitos se faz casando o prefixo de
seis contra a tabela oficial de municípios; não se recalcula o dígito por
fórmula. Na ESTBAN, atenção: o arquivo traz `CODMUN`, que é o código do SISBACEN
e **não** é o código do IBGE, e uma coluna separada `CODMUN_IBGE`, de sete
dígitos, que é a chave correta.

## Ressalva de safra

O ano-base combina REGIC 2018 com exercício fiscal 2024. A assimetria é
declarada: a hierarquia urbana muda em escala de década, o fenômeno fiscal é
anual. O IDHM é de 2010 e entra apenas como validação descritiva externa, nunca
como eixo.
