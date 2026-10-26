# 04: Executar o código

Procedimento para rodar o painel com os artefatos publicados e para regenerar esses artefatos com o pipeline, a partir das bases oficiais de [01-fontes.md](01-fontes.md). Todos os comandos partem da raiz do repositório.

## Pré-requisitos

- Python 3.12 ou superior e [uv](https://docs.astral.sh/uv/) para o pipeline.
- [Bun](https://bun.sh/) para o painel. Node com npm também funciona, trocando `bun` por `npm` nos comandos.
- Docker, opcional, para rodar o pipeline ou servir o painel em contêiner.
- GPU com vLLM, opcional, só para regenerar a leitura automática por município.

## Caminho 1: o painel com os artefatos publicados

Não exige baixar nenhuma base. O painel lê os artefatos de `dados/` no navegador.

```bash
cp -r dados app/public/data
cd app
bun install
bun run dev          # servidor de desenvolvimento em http://localhost:5173
bun run build        # verificação de tipos e build estático em app/dist
```

> **Confira:** o mapa abre com 5.513 municípios e a faixa de destaque informa 4.069 municípios dependentes.

## Caminho 2: regenerar os artefatos com o pipeline

As bases brutas ficam em `data/raw/`, fora do controle de versão, com a data de extração no nome do arquivo. O pipeline procura os nomes abaixo; a origem, o recorte e o formato de cada base estão em [01-fontes.md](01-fontes.md) e em [docs/DADOS.md](../docs/DADOS.md).

| Base | Nome esperado em `data/raw/` |
|------|------------------------------|
| REGIC 2018, hierarquia | `regic2018_municipios_hierarquia_e_regiao_2026-07-03.xlsx` |
| REGIC 2018, ligações | `regic2018_ligacoes_entre_cidades_2026-07-03.xlsx` |
| FINBRA/DCA 2024, receitas e FPM | `finbra_receitas_fpm_2024_ext2026-07-03.csv` |
| PIB dos Municípios | `pib_municipal_*.csv` |
| População Estimada | `populacao_estimada_*.csv` |
| CNES, hospital de média e alta complexidade | `cnes_hospital_mac_*.csv` |
| INEP, instituições de ensino superior | `inep_ies_*.csv` |
| IDHM, camada de contexto | `idhm_municipal_*.csv` |
| Malha municipal simplificada | `malha_municipios_minima_2026-07-03.geojson` |

A sequência completa, na ordem em que um passo alimenta o seguinte:

```bash
cd pipeline && uv sync --extra dev && cd ..

# 1. índice, ligações, validação, malha e contornos
uv run --project pipeline python pipeline/build.py --raw data/raw --out app/public/data

# 2. camadas de acesso efetivo (saúde, ensino superior e bancário)
uv run --project pipeline python pipeline/extrair_acesso_saude.py
uv run --project pipeline python pipeline/extrair_acesso_educacao.py
uv run --project pipeline python pipeline/extrair_acesso_bancario.py

# 3. de novo o índice, agora com a reconciliação da presença de serviço pelas camadas de acesso
uv run --project pipeline python pipeline/build.py --raw data/raw --out app/public/data

# 4. Brasil em Cenários: custo da máquina pública e agregação por região funcional
uv run --project pipeline python pipeline/extrair_despesa_funcao.py --out-csv data/raw/finbra_despesa_funcao.csv
uv run --project pipeline python pipeline/construir_cenarios.py --despesa data/raw/finbra_despesa_funcao.csv
```

Cada script aceita `--help` com os caminhos de entrada e saída. Os testes da fórmula rodam sem nenhuma base:

```bash
cd pipeline && uv run pytest
```

> **Confira:** os arquivos gerados em `app/public/data/` coincidem com os de `dados/`, e `manifesto.json` registra a cobertura de 98,98%.

### Em contêiner

```bash
docker build -t idm-pipeline -f pipeline/Dockerfile pipeline
docker run --rm -v "$PWD/data:/data" -v "$PWD/app/public/data:/pipeline/out" idm-pipeline python build.py
```

## Caminho 3: regenerar a leitura automática por município

Opcional. Exige GPU e um ambiente com vLLM, indicado pela variável `VLLM_VENV`. O desenho da camada, com o harness, o dicionário de símbolos e o portão de validação, está em [docs/INTERPRETACAO.md](../docs/INTERPRETACAO.md).

```bash
export VLLM_VENV=/caminho/do/venv-com-vllm
bash interpretacao/servir_vllm.sh            # sobe o modelo em http://localhost:8000
"$VLLM_VENV"/bin/python interpretacao/gerar.py \
    --base-url http://localhost:8000/v1 --model google/gemma-4-E2B-it \
    --concurrency 48 --out app/public/data/interpretacoes.json
```

A geração é idempotente: municípios cujo registro de origem não mudou reaproveitam a leitura anterior.

## Servir o painel em produção

O `Dockerfile` da raiz constrói o painel e o serve com nginx sem privilégios de root, na porta 8080 do contêiner. A configuração do nginx, com cabeçalhos de segurança e cache, está em `nginx/default.conf`.

```bash
cp -r dados app/public/data
docker build -t idm .
docker run --rm -p 8080:8080 idm
```
