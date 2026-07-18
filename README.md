# Brasil em Órbita: Índice de Dependência Municipal (IDM)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21431702.svg)](https://doi.org/10.5281/zenodo.21431702)

Observatório interativo que classifica cada município brasileiro por sua função na rede urbana, cruza essa função com a dependência fiscal e a concentração de serviços, e sintetiza tudo em um Índice de Dependência Municipal (IDM). Reúso integrado de dados abertos federais (IBGE, Tesouro Nacional, DATASUS, INEP e Banco Central).

O painel está publicado em **https://idm.pcbrom.com**.

## O que este repositório contém, e o que não contém

Este repositório publica os **artefatos de dado** produzidos pelo índice e a
**documentação do método**, com detalhe suficiente para conferir cada número
divulgado ou reimplementar o índice do zero a partir das fontes oficiais.

Ele **não contém o software**. O pipeline de processamento, a camada de geração
da leitura automática e a aplicação do painel não integram este repositório e
permanecem com os autores; ver [LICENSE](LICENSE). Se você veio procurar o
código do painel, ele não está aqui, e o caminho é o contato indicado na licença.

## Estrutura

```
dados/      artefatos publicados: o IDM, as ligacoes, as camadas de acesso,
            a malha, a validacao e o manifesto de proveniencia
docs/       definicao do problema, especificacao formal do indice, fontes e metodo
cookbook/   como reproduzir e como conferir os artefatos
```

## Documentação

A definição do problema está em [docs/PROBLEMA.md](docs/PROBLEMA.md); a definição formal do índice em [docs/IDM_SPEC.md](docs/IDM_SPEC.md); as fontes, com data de extração e cobertura, em [docs/DADOS.md](docs/DADOS.md); o formato dos artefatos em [docs/CONTRATO_DADO.md](docs/CONTRATO_DADO.md). As decisões de método que afetam a leitura dos números estão em [docs/DECISAO_CAUSAL.md](docs/DECISAO_CAUSAL.md) (postura descritiva), [docs/DECISAO_ACESSO.md](docs/DECISAO_ACESSO.md) (acesso efetivo no eixo de serviços) e [docs/DECISAO_CENARIOS.md](docs/DECISAO_CENARIOS.md) (agregação por região funcional); a camada de leitura automática em [docs/INTERPRETACAO.md](docs/INTERPRETACAO.md). A reprodução passo a passo está em [cookbook/README.md](cookbook/README.md).

## Reprodutibilidade

Os artefatos em `dados/` são gerados a partir de bases oficiais datadas e publicados por inteiro, não em amostra. Cada número rastreia a uma base com data de extração declarada no manifesto de proveniência, e o método que o produz está especificado em `docs/` com detalhe suficiente para reimplementação independente.

## Como citar

O DOI de conceito abaixo resolve sempre para a versão mais recente; para citar
exatamente esta versão, use `10.5281/zenodo.21431703`.

```bibtex
@dataset{brom_souza_2026_idm,
  title     = {Brasil em Órbita: Índice de Dependência Municipal (IDM)},
  author    = {Brom, Pedro Carvalho and Souza, Daniel Soares de},
  year      = {2026},
  publisher = {Zenodo},
  version   = {0.1.0},
  doi       = {10.5281/zenodo.21431702},
  url       = {https://doi.org/10.5281/zenodo.21431702}
}
```

## Licença

Três regimes distintos, detalhados em [LICENSE](LICENSE) e creditados em [NOTICE](NOTICE):

- **Bases públicas de origem** (IBGE, Tesouro Nacional, DATASUS, INEP, Banco Central, PNUD/Ipea/FJP): dados abertos dos respectivos órgãos, sob os termos deles. Qualquer pessoa pode obtê-las na fonte, e nada aqui restringe esse uso.
- **Documentação** (`docs/`, `cookbook/`, este README): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt), livre inclusive para uso comercial, com atribuição.
- **Artefatos de dado em `dados/`**: resultado do processamento dos autores, publicados para consulta, conferência e verificação independente, uso livre para essa finalidade com crédito. Redistribuição, incorporação a produtos de terceiros e exploração comercial ficam reservadas e dependem de licença expressa.

O software que produz e apresenta esses artefatos, o pipeline e o painel, não integra este repositório e permanece com todos os direitos reservados.
