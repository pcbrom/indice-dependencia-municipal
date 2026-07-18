# Especificação do IDM

Definição formal do Índice de Dependência Municipal, versão 1. Fixa a operacionalização dos três eixos, a normalização, a composição, os pesos e o tratamento de faltante, para que uma reimplementação independente chegue aos mesmos valores e cada número do painel rastreie a esta especificação. A definição conceitual está em [PROBLEMA.md](PROBLEMA.md).

O IDM é descritivo, não causal, conforme [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md). Mede posição estrutural, não desempenho de gestão.

## Notação

Seja $M$ o conjunto de municípios com dado válido no ano-base, com $N = |M|$. Para uma variável $x$ definida em $M$, a normalização por posto percentílico é

$$r(x_i) = \frac{\operatorname{rank}(x_i) - 1}{N - 1} \in [0, 1],$$

com `rank` em ordem crescente e empates resolvidos pela média dos postos. O posto percentílico é preferido à normalização min-max por ser robusto a valores extremos, frequentes em razões fiscais.

## Eixo 1: orbitação

Captura o quanto o consumo de serviços ocorre fora do município e a que distância. Seja $d_i$ a distância em quilômetros do município $i$ ao seu polo de destino, com $d_i = 0$ para polos e semi-polos que não orbitam. O eixo é

$$O_i = r(d_i).$$

**Origem de $d_i$ e do polo de destino.** A distância não é calculada: ela vem
tabulada da própria REGIC, na coluna `dist_km` da tabela de ligações entre
cidades. O procedimento é determinístico e reproduzível a partir da fonte:

1. Tome apenas as ligações com vínculo declarado (`vinculo = sim`).
2. Para cada município de origem, o polo de destino é o da ligação de **menor**
   `dist_km`; empate resolvido pela primeira ocorrência na ordenação por
   distância.
3. Município sem ligação qualificada, o que inclui polos e semipolos que não
   orbitam, recebe $d_i = 0$.

Não se usa distância geodésica entre centroides nem distância rodoviária: usar
qualquer uma delas produziria um vetor $d$ diferente e, portanto, um IDM
diferente. Quem reimplementar deve ler `dist_km` da fonte.

Polos, que não se deslocam, recebem $O_i$ baixo; orbitantes distantes recebem $O_i$ alto. Versão 1 usa apenas a distância ao polo principal; a intensidade e a variedade de serviços consumidos fora ficam como refinamento calibrável, registrado aqui, não no código.

## Eixo 2: dependência fiscal

Combina duas razões. A dependência de transferência,

$$f^{(1)}_i = \frac{\text{FPM}_i}{\text{receita total}_i} \in [0, 1],$$

e a razão entre o que a prefeitura movimenta e o que a cidade produz,

$$f^{(2)}_i = \frac{\text{receita total}_i}{\text{PIB}_i},$$

que pode exceder 1 nos casos em que a prefeitura movimenta mais do que o PIB municipal. O eixo é a média dos dois postos percentílicos,

$$F_i = \tfrac{1}{2}\left[\, r\!\left(f^{(1)}_i\right) + r\!\left(f^{(2)}_i\right) \right].$$

## Eixo 3: autossuficiência de serviços, invertida

Presença de hospital de média e alta complexidade (CNES) e de instituição de ensino superior (INEP). Sejam $h_i, s_i \in \{0, 1\}$ os indicadores de presença. A autossuficiência é $a_i = (h_i + s_i)/2$, e o eixo é a sua inversão,

$$S_i = 1 - a_i.$$

Ausência de serviço aumenta o índice. Versão 1 usa presença binária; contagem por habitante fica como refinamento calibrável.

## Composição

$$\text{IDM}_i = w_1 O_i + w_2 F_i + w_3 S_i, \qquad w_1 = w_2 = w_3 = \tfrac{1}{3},$$

com $\text{IDM}_i \in [0, 1]$. Pesos iguais na versão 1, declarados e ajustáveis; qualquer mudança de peso é registrada aqui e refletida no manifesto. O painel também publica o posto percentílico do próprio IDM, $r(\text{IDM}_i)$, para a leitura relativa ao leigo ("mais dependente que X por cento dos municípios").

## Tratamento de faltante

Município sem FINBRA válido no ano-base não entra em $M$, conforme o piso de cobertura declarado: recuar de ano-base, ou restringir o universo e declarar a cobertura na tela, sem imputação. Faltante em CNES ou INEP é tratado como ausência de serviço apenas se a base for exaustiva para o ano-base; caso contrário o município sai de $M$. Nenhum eixo é imputado por média.

## Validação obrigatória

Antes de publicar, registra-se:

- Correlação de Spearman entre $\text{IDM}$ e o logaritmo da população. Se $|\rho| > 0{,}8$, o ranking passa a ser estratificado por porte como leitura primária, para não remedir população.
- Matriz de correlação entre os três eixos, publicada na nota metodológica; eixos muito redundantes são sinalizados.
- Casos verificáveis: municípios cuja receita supera o PIB ($f^{(2)}_i > 1$) e ligações orbitante para polo do REGIC conferidas contra a fonte.

Além da validação interna acima, o painel publica uma validação descritiva externa do IDM contra o IDHM, referente de desenvolvimento de safra 2010, apresentada como camada de contexto. Essa validação é contexto, não parte da definição do índice: não altera eixos, pesos nem cobertura, e é reportada como associação, nunca como efeito causal.

## Rastreabilidade

Cada variável de entrada carrega fonte e data de extração no manifesto. A fórmula acima é a única referência para a implementação; qualquer divergência entre um artefato publicado e esta especificação é defeito do artefato.

## Notas de implementação da versão 0.1.0

Aproximações da primeira versão, a refinar, todas registradas no manifesto e na nota metodológica:

- **Serviços, presença reconciliada:** `tem_hospital_mac` é verdadeiro quando há hospital de média ou alta complexidade ativo no CNES **ou** leito de UTI registrado; `tem_ies` é verdadeiro quando há instituição de ensino superior no cadastro **ou** curso de graduação presencial no Censo da Educação Superior. A regra de alargamento monotônico está descrita em [DECISAO_ACESSO.md](DECISAO_ACESSO.md) e é parte da definição, não refinamento futuro. Um refinamento por intensidade (leitos por habitante, habilitações por especialidade) permanece em aberto.
- **Fiscal, PIB:** o PIB municipal é o de 2023 (edição mais recente do IBGE), combinado à receita de 2024; ver [DADOS.md](DADOS.md).
- **Ano-base:** REGIC 2018 (edição mais recente) mais FINBRA 2024; a assimetria é declarada, hierarquia urbana de mudança lenta contra fenômeno fiscal recente.
- **Cobertura:** 5513 de 5570 municípios (98,98%) com os três eixos; os demais caem por falta de dado fiscal ou de PIB, sem imputação.
