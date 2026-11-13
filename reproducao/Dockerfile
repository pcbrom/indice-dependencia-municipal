# Local reproduction of the IDM: one command, only Docker required.
#
#   docker compose up --build      ->  http://localhost:8080
#
# Stage 1 runs the formula tests and recomputes the IDM of every municipality
# from dados/municipios.json with the published code, failing the build on any
# difference. Stage 2 builds the panel from the same published artifacts.
# Stage 3 serves the panel and the verification log (/conferencia.txt) with the
# same nginx configuration used in production.

# ---- conferencia: tests and reproduction check ----
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS conferencia
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /repo
COPY pipeline/ pipeline/
COPY dados/ dados/
RUN uv sync --project pipeline --extra dev --frozen
RUN set -e; { set -e; echo "IDM: conferencia de reproducao"; date -u "+%Y-%m-%d %H:%M UTC"; echo; \
      echo "== testes da formula =="; \
      (cd pipeline && uv run --frozen pytest -p no:cacheprovider 2>&1 | tail -n 1); \
      echo; echo "== recalculo do IDM publicado =="; \
      uv run --frozen --project pipeline python pipeline/exemplos/recalcular_idm.py --municipios dados/municipios.json; \
    } | tee /conferencia.txt

# ---- painel: static build from the published artifacts ----
FROM oven/bun:1-alpine AS painel
WORKDIR /app
COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile
COPY app/ ./
COPY dados/ ./public/data/
RUN bun run build

# ---- servidor: panel plus verification log ----
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=painel /app/dist /usr/share/nginx/html
COPY --from=conferencia /conferencia.txt /usr/share/nginx/html/conferencia.txt
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY reproducao/charset.conf /etc/nginx/conf.d/charset.conf
EXPOSE 8080
