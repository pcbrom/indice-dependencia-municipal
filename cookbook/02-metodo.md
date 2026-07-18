# 02: Reimplementar o índice

Procedimento para chegar aos mesmos artefatos a partir das bases de
[01-fontes.md](01-fontes.md). A definição formal, com a notação completa, está em
[docs/IDM_SPEC.md](../docs/IDM_SPEC.md); aqui está a ordem das operações e o que
conferir em cada etapa.

## Passo 1: montar o universo

Parta do universo do REGIC, 5.570 municípios, e junte pelo código de sete
dígitos: receita total e FPM (FINBRA/DCA 2024), PIB (2023), presença de serviço
(CNES e INEP), população estimada e IDHM.

**Portão de completude.** Município sem PIB, sem FPM ou sem receita total válidos
no ano-base sai do universo, sem imputação. Nenhum eixo é preenchido por média.

> **Confira:** restam **5.513** municípios, cobertura de **98,98%**.

Os **57** municípios fora do universo são os que não têm receita, FPM ou PIB
válidos no ano-base. Entre eles está **Brasília (DF)**, cuja contabilidade é
distrital e não se apresenta no mesmo formato municipal do Siconfi; por isso o
Distrito Federal não aparece como unidade da federação nas camadas de agregação,
que trazem 26 UFs. A exclusão é declarada, nunca imputada: quem reimplementar
chega ao mesmo conjunto aplicando o portão de completude sobre as mesmas bases.

## Passo 2: reconciliar a presença de serviço

Antes de calcular o eixo de serviços, alargue a presença com a evidência de
acesso efetivo, nunca a estreite:

- `tem_hospital_mac` recebe verdadeiro se há hospital de média ou alta
  complexidade **ou** leito de UTI registrado no CNES.
- `tem_ies` recebe verdadeiro se há instituição de ensino superior **ou** curso
  de graduação presencial no Censo da Educação Superior.

A relação é de implicação: uma UTI pressupõe alta complexidade, um curso
presencial pressupõe ensino superior local. O racional está em
[docs/DECISAO_ACESSO.md](../docs/DECISAO_ACESSO.md).

A reconciliação corrige a presença de centenas de municípios, sempre no sentido
de menor dependência. O número exato depende do estado das bases de presença
anteriores à reconciliação, que não são publicadas aqui, então não é usado como
marco de conferência: o que se confere é o resultado final, em `dados/municipios.json`
e nas camadas `dados/acesso_*.json`.

## Passo 3: normalizar

Para cada variável, use o posto percentílico sobre o universo válido:

$$r(x_i) = \frac{\operatorname{rank}(x_i) - 1}{N - 1} \in [0, 1]$$

Postos em ordem crescente, **empates resolvidos pela média dos postos**. Não use
reescalonamento mínimo-máximo: razões fiscais têm extremos que o distorcem.

## Passo 4: computar os três eixos

- **Orbitação:** $O_i = r(d_i)$, com $d_i$ a distância em quilômetros ao polo de
  destino no REGIC, e $d_i = 0$ para polo ou semipolo que não orbita.
- **Fiscal:** média de dois postos, $F_i = \tfrac{1}{2}\,[\,r(f^{(1)}_i) + r(f^{(2)}_i)\,]$,
  com $f^{(1)}$ = FPM sobre receita total e $f^{(2)}$ = receita total sobre PIB.
  $f^{(2)}$ pode exceder 1.
- **Serviços:** $S_i = 1 - (h_i + s_i)/2$, com $h_i$ e $s_i$ os booleanos
  reconciliados do passo 2. A **ausência** de serviço eleva o eixo.

## Passo 5: compor

$$\text{IDM}_i = \tfrac{1}{3}O_i + \tfrac{1}{3}F_i + \tfrac{1}{3}S_i \in [0,1]$$

Pesos iguais, declarados no manifesto e calibráveis. Publique também o posto
percentílico do próprio índice, base da leitura "mais dependente que X por cento".

> **Confira:** mediana do IDM **0,58**, média **0,55**, primeiro quartil **0,44**,
> terceiro quartil **0,69**. Medianas por tipologia: **0,34** nos polos, **0,47**
> nos semipolos, **0,63** nos orbitantes.

## Passo 6: agregação por região funcional

Uma região funcional é uma âncora, polo ou semipolo, mais os orbitantes que
dependem dela. Para cada região: custo da máquina (funções Legislativa e
Administração da DCA Anexo I-E), FPM recebido hoje pelos membros, FPM que a
região receberia como município único pela tabela de coeficientes, e a estrutura
da sede, medida por leito de UTI, curso presencial e agência bancária.

As regiões formam uma **partição** do universo: cada município pertence a
exatamente uma. Um município que é ele próprio âncora fica na região dele, mesmo
orbitando um centro maior, porque não pode ser fundido em dois lugares ao mesmo
tempo; quem não é âncora vai para a região do seu polo; quem sobra forma uma
região de um município só, onde a fusão é inócua.

> **Confira:** **1.443** regiões, das quais **751** agregam de fato e **692** são
> municípios isolados, cobrindo os **5.513** do índice sem repetição, com 4.070
> municípios fora da sede. Entre as 751 que agregam, **423** têm sede com
> estrutura `preservada` e **328** `parcial`. A soma das populações das regiões
> tem de dar exatamente a população do universo; se não der, há dupla contagem.

## O que não é reimplementável a partir daqui

A leitura automática por município (`dados/interpretacoes.json`) é gerada por
modelo de linguagem local sob um harness determinístico, descrito em
[docs/INTERPRETACAO.md](../docs/INTERPRETACAO.md). Ela é **redação**, não cálculo:
nenhum número do painel vem dela, e o artefato é publicado para inspeção. Uma
reimplementação do índice não precisa reproduzi-la.
