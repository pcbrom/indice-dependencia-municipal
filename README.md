# Brasil em Órbita: Índice de Dependência Municipal (IDM)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21431702.svg)](https://doi.org/10.5281/zenodo.21431702)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-blue.svg)](LICENSE)
[![Dados e documentação: CC BY 4.0](https://img.shields.io/badge/dados%20e%20docs-CC%20BY%204.0-lightgrey.svg)](LICENSE-DADOS.md)
[![CI](https://github.com/pcbrom/indice-dependencia-municipal/actions/workflows/ci.yml/badge.svg)](https://github.com/pcbrom/indice-dependencia-municipal/actions/workflows/ci.yml)

Observatório interativo que classifica cada município brasileiro por sua função na rede urbana, cruza essa função com a dependência fiscal e a concentração de serviços, e sintetiza tudo em um Índice de Dependência Municipal (IDM). Reúso integrado de dados abertos federais (IBGE, Tesouro Nacional, DATASUS, INEP e Banco Central).

O painel está publicado em **https://idm.pcbrom.com**.

## Como replicar, passo a passo

O caminho mais curto exige só o [Docker](https://docs.docker.com/get-docker/) e um comando. Ele roda os testes da fórmula, recalcula o IDM dos 5.513 municípios com o código publicado, falha se houver qualquer diferença para o valor publicado e, se a conferência passar, constrói e serve o painel completo no seu computador:

```bash
git clone https://github.com/pcbrom/indice-dependencia-municipal
cd indice-dependencia-municipal
docker compose up --build
```

Abra **http://localhost:8080**: é o mesmo painel publicado, construído a partir deste repositório. O registro da conferência fica em **http://localhost:8080/conferencia.txt**:

```text
== testes da formula ==
21 passed

== recalculo do IDM publicado ==
Conferência: 5513 municípios, maior diferença absoluta para o IDM publicado = 0.00e+00
```

Os passos seguintes detalham cada parte, do mais rápido ao mais completo. Os dois primeiros não exigem baixar nenhuma base oficial, porque os artefatos publicados em `dados/` são o resultado completo do pipeline. Os passos 2 e 3 também rodam automaticamente no [CI](https://github.com/pcbrom/indice-dependencia-municipal/actions/workflows/ci.yml) a cada mudança do repositório.

**1. Conferir sem programar.** A receita [cookbook/03-conferir.md](cookbook/03-conferir.md) lista a proveniência datada de cada base, as medidas de validação e casos de controle que se verificam direto na fonte oficial, como o município com receita acima do próprio PIB.

**2. Reproduzir o índice publicado sem Docker.** Com [uv](https://docs.astral.sh/uv/) instalado, três comandos recalculam o IDM dos 5.513 municípios com a fórmula do código e comparam com o valor publicado:

```bash
git clone https://github.com/pcbrom/indice-dependencia-municipal
cd indice-dependencia-municipal
uv run --project pipeline python pipeline/exemplos/recalcular_idm.py
```

Saída esperada: `Conferência: 5513 municípios, maior diferença absoluta para o IDM publicado = 0.00e+00`.

**3. Rodar o painel em modo de desenvolvimento.** Com [Bun](https://bun.sh/) instalado, o painel abre em `http://localhost:5173` com os artefatos publicados:

```bash
cp -r dados app/public/data
cd app && bun install && bun run dev
```

**4. Regenerar os artefatos a partir das fontes oficiais.** A receita [cookbook/01-fontes.md](cookbook/01-fontes.md) traz o endereço exato e a data de extração de cada base, e [cookbook/04-executar.md](cookbook/04-executar.md) traz a sequência completa do pipeline, na ordem em que um passo alimenta o seguinte, com o resultado esperado de cada etapa.

**5. Adaptar a outro recorte.** O mesmo exemplo recalcula o índice com pesos alternativos ou dentro de uma UF, e a fórmula pode ser importada como biblioteca, como descrito em [Usar como biblioteca](#usar-como-biblioteca):

```bash
uv run --project pipeline python pipeline/exemplos/recalcular_idm.py --pesos 0.5,0.25,0.25
uv run --project pipeline python pipeline/exemplos/recalcular_idm.py --uf PE
```

Para reimplementar o índice do zero, sem usar o código dos autores, a especificação formal está em [docs/IDM_SPEC.md](docs/IDM_SPEC.md) e o método passo a passo em [cookbook/02-metodo.md](cookbook/02-metodo.md).

## O que este repositório contém

Tudo o que produz e apresenta o índice: o código, os artefatos de dado completos e a documentação do método. Qualquer número do painel pode ser conferido contra a fonte oficial, regenerado com o pipeline ou reimplementado do zero a partir da especificação.

```
pipeline/       Python (pandas, geopandas): ingestão, chave IBGE de sete dígitos, cálculo do IDM, validação e manifesto
interpretacao/  leitura automática por município: harness determinístico, dicionário de símbolos e portão de validação
app/            painel web estático (Vite, React e TypeScript), com dado lido no cliente
reproducao/     deploy local em um comando: conferência do índice e painel servido em contêiner
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

## Usar como biblioteca

A fórmula do índice é um módulo puro, sem entrada nem saída de arquivos, instalável à parte:

```bash
pip install "git+https://github.com/pcbrom/indice-dependencia-municipal#subdirectory=pipeline"
```

```python
import pandas as pd
from idm_pipeline import idm_core

df = pd.read_json("dados/municipios.json")
idm = idm_core.compute_idm_frame(df, weights=(0.5, 0.25, 0.25))
```

O exemplo [pipeline/exemplos/recalcular_idm.py](pipeline/exemplos/recalcular_idm.py) usa o artefato publicado, sem nenhuma base bruta, de três modos: reproduz o IDM publicado sem diferença, recalcula com pesos alternativos e compara as ordenações, e normaliza dentro de uma UF para uma leitura estadual. A reprodução roda no CI a cada mudança, junto dos testes da fórmula e do build do painel.

```bash
uv run --project pipeline python pipeline/exemplos/recalcular_idm.py                      # reproduz o IDM publicado
uv run --project pipeline python pipeline/exemplos/recalcular_idm.py --pesos 0.5,0.25,0.25  # pesos alternativos
uv run --project pipeline python pipeline/exemplos/recalcular_idm.py --uf PE               # recorte estadual
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
  version   = {0.2.2},
  doi       = {10.5281/zenodo.21431702},
  url       = {https://doi.org/10.5281/zenodo.21431702}
}
```

## Licença

Três regimes, detalhados em [LICENSE](LICENSE), [LICENSE-DADOS.md](LICENSE-DADOS.md) e [NOTICE](NOTICE):

- **Código** (`pipeline/`, `interpretacao/`, `app/`, `scripts/`, `nginx/`, `Dockerfile`): licença MIT, livre para usar, copiar, modificar e redistribuir.
- **Dados derivados e documentação** (`dados/`, `docs/`, `cookbook/`, este README): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt), livre inclusive para uso comercial, com atribuição.
- **Bases públicas de origem** (IBGE, Tesouro Nacional, DATASUS, INEP, Banco Central, PNUD, Ipea e FJP): dados abertos dos respectivos órgãos, sob os termos deles.
