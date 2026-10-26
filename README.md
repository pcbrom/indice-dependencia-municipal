# Brasil em Órbita: Índice de Dependência Municipal (IDM)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21431702.svg)](https://doi.org/10.5281/zenodo.21431702)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-blue.svg)](LICENSE)
[![Dados e documentação: CC BY 4.0](https://img.shields.io/badge/dados%20e%20docs-CC%20BY%204.0-lightgrey.svg)](LICENSE-DADOS.md)

Observatório interativo que classifica cada município brasileiro por sua função na rede urbana, cruza essa função com a dependência fiscal e a concentração de serviços, e sintetiza tudo em um Índice de Dependência Municipal (IDM). Reúso integrado de dados abertos federais (IBGE, Tesouro Nacional, DATASUS, INEP e Banco Central).

O painel está publicado em **https://idm.pcbrom.com**.

## O que este repositório contém

Tudo o que produz e apresenta o índice: o código, os artefatos de dado completos e a documentação do método. Qualquer número do painel pode ser conferido contra a fonte oficial, regenerado com o pipeline ou reimplementado do zero a partir da especificação.

```
pipeline/       Python (pandas, geopandas): ingestão, chave IBGE de sete dígitos, cálculo do IDM, validação e manifesto
interpretacao/  leitura automática por município: harness determinístico, dicionário de símbolos e portão de validação
app/            painel web estático (Vite, React e TypeScript), com dado lido no cliente
dados/          artefatos publicados: índice, ligações, camadas de acesso, cenários, malha, validação e manifesto de proveniência
docs/           definição do problema, especificação formal do índice, fontes, contrato de dado, decisões de método e sistema visual
cookbook/       como reproduzir, como executar o código e como conferir os artefatos
```

## Executar

Os comandos completos, com pré-requisitos e verificação, estão em [cookbook/04-executar.md](cookbook/04-executar.md). Em resumo:

```bash
# painel, com os artefatos publicados
cp -r dados app/public/data
cd app && bun install && bun run dev

# pipeline, a partir das bases oficiais datadas em data/raw/ (ver cookbook/01-fontes.md)
cd pipeline && uv sync --extra dev
uv run python build.py --raw ../data/raw --out ../app/public/data
uv run pytest
```

## Documentação

A definição do problema está em [docs/PROBLEMA.md](docs/PROBLEMA.md) e a definição formal do índice em [docs/IDM_SPEC.md](docs/IDM_SPEC.md). As fontes, com data de extração e cobertura, estão em [docs/DADOS.md](docs/DADOS.md), e o formato dos artefatos em [docs/CONTRATO_DADO.md](docs/CONTRATO_DADO.md). As decisões de método que afetam a leitura dos números estão em [docs/DECISAO_CAUSAL.md](docs/DECISAO_CAUSAL.md) (postura descritiva), [docs/DECISAO_ACESSO.md](docs/DECISAO_ACESSO.md) (acesso efetivo no eixo de serviços) e [docs/DECISAO_CENARIOS.md](docs/DECISAO_CENARIOS.md) (agregação por região funcional). A camada de leitura automática está em [docs/INTERPRETACAO.md](docs/INTERPRETACAO.md), e o sistema visual do painel em [docs/TOKENS.md](docs/TOKENS.md) e [docs/COMPONENTES.md](docs/COMPONENTES.md). Alguns comentários do código citam documentos de planejamento de interface que não integram este repositório; nenhum deles é necessário para executar o código ou reproduzir os números.

## Reprodutibilidade

Os artefatos em `dados/` são gerados a partir de bases oficiais datadas e publicados por inteiro, não em amostra. Cada número rastreia a uma base com data de extração declarada no manifesto de proveniência, e o código que o produz está neste repositório, ao lado da especificação que permite reimplementá-lo de forma independente.

## Como citar

O DOI de conceito abaixo resolve sempre para a versão mais recente. O DOI de cada versão aparece na página do depósito no Zenodo.

```bibtex
@dataset{brom_souza_2026_idm,
  title     = {Brasil em Órbita: Índice de Dependência Municipal (IDM)},
  author    = {Brom, Pedro Carvalho and Souza, Daniel Soares de},
  year      = {2026},
  publisher = {Zenodo},
  version   = {0.2.0},
  doi       = {10.5281/zenodo.21431702},
  url       = {https://doi.org/10.5281/zenodo.21431702}
}
```

## Licença

Três regimes, detalhados em [LICENSE](LICENSE), [LICENSE-DADOS.md](LICENSE-DADOS.md) e [NOTICE](NOTICE):

- **Código** (`pipeline/`, `interpretacao/`, `app/`, `scripts/`, `nginx/`, `Dockerfile`): licença MIT, livre para usar, copiar, modificar e redistribuir.
- **Dados derivados e documentação** (`dados/`, `docs/`, `cookbook/`, este README): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt), livre inclusive para uso comercial, com atribuição.
- **Bases públicas de origem** (IBGE, Tesouro Nacional, DATASUS, INEP, Banco Central, PNUD, Ipea e FJP): dados abertos dos respectivos órgãos, sob os termos deles.
