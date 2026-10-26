#!/usr/bin/env bash
# Sobe o Gemma 4 E2B em lote via vLLM para gerar interpretacoes.json.
# Requer um venv com vLLM ja instalado, indicado por VLLM_VENV; o script nao
# instala nada.
#
# Cuidados de execucao:
#   - liberar a VRAM de outros servidores de modelo (por exemplo Ollama) antes,
#     senao gpu-memory-utilization estoura;
#   - VLLM_USE_FLASHINFER_SAMPLER=0 evita a compilacao JIT do sampler, que
#     exigiria ninja;
#   - texto puro: --limit-mm-per-prompt zera imagem e audio;
#   - `ollama stop` nao bloqueia ate a memoria ser devolvida. Subir o vLLM em
#     seguida faria o profiling de memoria rodar com a VRAM ainda ocupada, e o
#     engine falharia por cache KV negativo. Por isso o passo 1b espera a VRAM
#     baixar antes de servir.
set -euo pipefail

VENV="${VLLM_VENV:-.venv-vllm}"
MODEL="google/gemma-4-E2B-it"   # ja no cache HF; gated, baixado via hf download
VRAM_LIVRE_MB="${VRAM_LIVRE_MB:-1000}"   # teto de ocupacao aceito antes de subir
ESPERA_MAX_S="${ESPERA_MAX_S:-60}"

# 1) liberar VRAM de modelos servidos pelo Ollama, se houver
for m in gemma4:e2b-it-qat gemma4:e2b gemma4:26b-fast gemma4:31b-it-qat "$MODEL"; do
  ollama stop "$m" 2>/dev/null || true
done

# 1b) esperar a VRAM voltar de fato (ver gotcha da corrida no cabecalho)
usada=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
fim=$((SECONDS + ESPERA_MAX_S))
while [ "$usada" -gt "$VRAM_LIVRE_MB" ] && [ "$SECONDS" -lt "$fim" ]; do
  echo "[servir_vllm] aguardando VRAM: ${usada} MiB ocupados (teto ${VRAM_LIVRE_MB})"
  sleep 3
  usada=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
done
if [ "$usada" -gt "$VRAM_LIVRE_MB" ]; then
  echo "[servir_vllm] ERRO: ${usada} MiB ainda ocupados na GPU apos ${ESPERA_MAX_S}s." >&2
  echo "[servir_vllm] Quem esta segurando:" >&2
  nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv >&2
  exit 1
fi
echo "[servir_vllm] VRAM livre (${usada} MiB ocupados); subindo o vLLM."

# 2) subir o servidor OpenAI-compativel em :8000
VLLM_USE_FLASHINFER_SAMPLER=0 "$VENV/bin/vllm" serve "$MODEL" \
  --port 8000 --gpu-memory-utilization 0.85 --max-model-len 8192 \
  --limit-mm-per-prompt '{"image":0,"audio":0}'
