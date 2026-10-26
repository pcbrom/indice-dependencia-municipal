# IDM - multi-stage build.
# Stage 1 builds the static Vite app (app/) with bun; stage 2 serves dist/ with
# an unprivileged nginx. The image builds on the serving host, so no toolchain
# is needed there beyond Docker.

# ---- builder: build the Vite app ----
FROM oven/bun:1-alpine AS builder
WORKDIR /app
# Install with the lockfile first, for cache reuse across source changes.
COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile
COPY app/ ./
RUN bun run build

# ---- runtime: serve the static site ----
# nginxinc/nginx-unprivileged runs entirely as the nginx user (UID 101), no root
# master. It listens on 8080 (non-root cannot bind <1024); the host maps
# 127.0.0.1:3006 -> container:8080.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
