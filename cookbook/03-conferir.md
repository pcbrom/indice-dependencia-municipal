# 03: Conferir sem reimplementar

Roteiro para checar o que foi publicado sem escrever uma linha de código. Tudo
abaixo se verifica abrindo os arquivos de `dados/` e consultando a fonte oficial.

## 1. Proveniência: cada número tem origem datada

Abra `dados/manifesto.json`. Ele lista, para cada base, o órgão, o ano de
referência, a data de extração e o endereço de catálogo. Confira que a lista bate
com [01-fontes.md](01-fontes.md) e que o painel exibe as mesmas datas em "Sobre
este painel".

> Cobertura declarada: 5.513 municípios válidos de 5.570, **98,98%**, com
> `abaixo_do_piso` falso, ou seja, acima do piso de 0,90 fixado antes da coleta.
> Os 57 restantes não têm dado fiscal ou de PIB válido no ano-base; entre eles
> Brasília, de contabilidade distrital, razão pela qual as camadas de agregação
> trazem 26 unidades da federação e não 27.

## 2. Validação: as afirmações são checáveis

Abra `dados/validacao.json`.

| Medida | Valor publicado | O que significa |
|--------|-----------------|-----------------|
| Spearman IDM × log população | **−0,690** | o índice não é um disfarce do porte; abaixo do gate de 0,8 em módulo fixado antes |
| Correlação orbitação × fiscal | **−0,093** | não correlacionados, o que não se afirma como independência |
| Correlação orbitação × serviços | **−0,292** | associação fraca |
| Correlação fiscal × serviços | **+0,490** | sobreposição parcial, sem redundância |
| Spearman IDM × IDHM, bruto | **−0,412** | associação descritiva, sobre 5.507 municípios com IDHM |
| Spearman IDM × IDHM, parcial | **−0,479** | controlando o log da população; a associação sobrevive ao porte |
| Municípios com receita acima do PIB | **20** | casos verificáveis publicamente |
| Ligações orbitante para polo | **5.124** | conferíveis contra a publicação do REGIC |

## 3. Casos de controle: verificáveis na fonte

Cada afirmação abaixo é checável direto no órgão de origem, sem intermediação.

**Receita municipal acima do PIB.** Os artefatos registram 20 casos. Os dois
maiores: Itaipulândia (PR), receita de **1,40 vez** o PIB, e Alvorada de Minas
(MG), **1,34 vez**. Confira receita no Siconfi e PIB na tabela 5938 do SIDRA.

**Extremos do índice.** Menos dependentes, IDM em torno de **0,02**: Osasco e
Paulínia (SP), Betim (MG), São Francisco do Conde (BA), Maricá e Saquarema (RJ),
todos polos de base econômica própria robusta. No outro extremo, o topo da lista
é ocupado por orbitantes pequenos e distantes do polo: Teresina de Goiás (GO),
com IDM de **0,97**, é o mais alto; São José do Peixe (PI), Miravânia e Serra
Azul de Minas (MG) vêm logo abaixo, todos acima de 0,95. Ordene
`dados/municipios.json` por `idm` para reproduzir a lista inteira e confirme que
os três eixos explicam a posição de cada um.

**Ligação orbitante para polo.** Tome qualquer orbitante em `dados/ligacoes.json`
e confirme o polo de destino na tabela de ligações do REGIC 2018.

**Acesso efetivo.** Em `dados/acesso_saude.json`, 714 municípios têm leito de
UTI; em `dados/acesso_educacao.json`, 1.121 têm curso presencial; em
`dados/acesso_bancario.json`, 2.882 têm agência e todos os 5.513 têm ao menos um
correspondente. Confira uma amostra no CNES, no Censo da Educação Superior e nos
informes do Banco Central.

## 4. Coerência interna dos artefatos

- A chave `codigo_ibge` tem sempre sete dígitos, como string, com zero à esquerda
  preservado.
- Todo município de `dados/municipios.json` tem os três eixos entre 0 e 1 e o
  `idm` igual à média simples dos três, dentro do arredondamento publicado.
- Nenhum campo obrigatório é nulo; os campos de contexto (`populacao_estimada`,
  `idhm`) admitem nulo, sem imputação, conforme
  [docs/CONTRATO_DADO.md](../docs/CONTRATO_DADO.md).
- A soma de polos, semipolos e orbitantes fecha em 5.513: **1.013**, **431** e
  **4.069**.

## 5. O que o painel declara que não faz

O IDM é descritivo e não estima efeito causal próprio. A aba de cenários é
aritmética da regra vigente do FPM sobre dado medido, apresentada como descrição
do incentivo, nunca como recomendação de fusão. O racional está em
[docs/DECISAO_CAUSAL.md](../docs/DECISAO_CAUSAL.md) e
[docs/DECISAO_CENARIOS.md](../docs/DECISAO_CENARIOS.md). Se alguma tela sugerir
recomendação, é defeito, não intenção.
