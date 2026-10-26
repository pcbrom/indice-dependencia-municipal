# Tokens de design

Valores concretos do sistema de design, a fonte única de verdade para cor, espaço, tipografia e raio. São os tokens que separam o acabamento profissional do genérico. A paleta foi validada quanto a contraste e daltonismo; qualquer troca de matiz obriga a revalidar antes de publicar. Aplicados como custom properties de CSS, com override para o tema escuro.

Regra de uso: componente nunca traz cor ou espaçamento literal; referencia o token por papel. O tema claro e o escuro são desenhados, não gerados por inversão.

## Cor

Chrome e tinta:

| Papel | Claro | Escuro |
|-------|-------|--------|
| surface-1 (superfície de gráfico) | `#fcfcfb` | `#1a1a19` |
| surface-page (plano da página) | `#f9f9f7` | `#0d0d0d` |
| ink-primary | `#0b0b0b` | `#ffffff` |
| ink-secondary | `#52514e` | `#c3c2b7` |
| ink-muted (eixo, rótulo) | `#898781` | `#898781` |
| gridline | `#e1e0d9` | `#2c2c2a` |
| baseline | `#c3c2b7` | `#383835` |
| border (anel de 1 px) | `rgba(11,11,11,0.10)` | `rgba(255,255,255,0.10)` |

IDM espectral (azul a amarelo a vermelho, esquema RdYlBu invertido), o único canal de cor do mapa. A matiz carrega a leitura: azul menos dependente, amarelo intermediário, vermelho mais dependente. Passos de `--idm-100` a `--idm-700`:

| step | hex | step | hex |
|---|---|---|---|
| 100 | `#4575b4` | 450 | `#fee090` |
| 200 | `#74add1` | 500 | `#fdae61` |
| 300 | `#abd9e9` | 600 | `#f46d43` |
| 400 | `#e0f3f8` | 700 | `#d73027` |

A barra de legenda do mapa é a rampa contínua entre `--idm-100`, `--idm-450` e `--idm-700`.

Eixo fiscal divergente (azul para vermelho, cinza neutro no ponto onde receita iguala PIB): polo frio `#2a78d6`, neutro `#f0efec` claro e `#383835` escuro, polo quente `#d03b3b`.

Acento único: azul `#2a78d6` no claro, `#3987e5` no escuro. Um só acento; sem segunda cor decorativa.

Status (fixo, nunca tematizado, sempre com ícone e rótulo): good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`. Reservado para estado, nunca para série.

## Espaço

Escala de base 4, aplicada sem exceção a margem, padding e gap:

`4, 8, 12, 16, 24, 32, 48, 64` px, nomeados `space-1` a `space-8`.

## Tipografia

Família única, sem face de display. A pilha em uso é a fonte Inter variável auto-hospedada pelo pacote `@fontsource-variable/inter`, importado em `app/src/main.tsx` e servida do próprio site, sem requisição a CDN externo, compatível com a CSP; a pilha de sistema (`system-ui, -apple-system, "Segoe UI", sans-serif`) permanece como fallback. O token `--font-sans` reflete essa ordem: `"Inter Variable"` seguido da pilha de sistema. Um só arquivo variável cobre os pesos de 100 a 900 e renderiza igual em qualquer máquina.

A base do documento aplica suavização de fonte (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`) e `text-rendering: optimizeLegibility`. Algarismos tabulares ficam disponíveis pela classe utilitária `.tabular` (`font-variant-numeric: tabular-nums`), aplicada onde números precisam alinhar na vertical ou permanecer estáveis enquanto mudam.

Escala de tamanho, nomeada por papel:

| Token | px | Uso |
|-------|-----|-----|
| text-caption | 12 | selo de fonte, legenda |
| text-body | 14 | corpo, rótulo de tile |
| text-base | 16 | texto padrão |
| text-lg | 20 | subtítulo, título de grupo |
| text-xl | 28 | título de tela |
| text-hero | 40 | número herói do IDM |

Entrelinha de 1,5 no corpo (`--leading-body`) e 1,2 nos títulos (`--leading-title`). Peso 400 para corpo (`--weight-body`), 600 para título (`--weight-title`); sem itálico decorativo. Os títulos recebem tracking negativo leve pelo token `--tracking-title` (`-0.01em`), que compacta o espaçamento entre letras e firma a leitura dos pesos maiores. Figuras proporcionais no número herói; `tabular-nums` apenas onde há alinhamento vertical, via a classe `.tabular`.

### Hierarquia por papel

A hierarquia é aplicada por estilos de elemento em `app/src/styles/global.css`, de modo que um mesmo nível lê igual em toda tela:

| Papel | Seletor | Tamanho | Notas |
|-------|---------|---------|-------|
| Título de página | `h1` | `--text-xl` (28 px) | entrelinha, peso e tracking de título |
| Tese (lead do mapa) | `.tipo-tese` | `--text-lg` (20 px) | é o `h1` da tela do mapa, mas fica no tamanho de seção por ser lead, não título de página |
| Título de seção | `h2` | `--text-lg` (20 px) | |
| Subtítulo de grupo | `h3` | `--text-base` (16 px) | |
| Rótulo de seção | `.rotulo-secao` | `--text-caption` (12 px) | maiúsculas, `letter-spacing: 0.06em`, tinta `--ink-muted`; cabeçalho de bloco dentro de painel ou overlay de detalhe |

Todo `h1`, `h2` e `h3` compartilha `--leading-title`, `--weight-title` e `--tracking-title`; o rótulo de seção inverte o sinal do tracking, com espaçamento positivo para a leitura em maiúsculas.

## Raio e elevação

Raio: `4` (controle), `8` (card), `12` (bloco), `full` (chip e badge). Sombra usada com parcimônia, um único nível suave para separar camada flutuante (tooltip, menu); sem sombra em card estático. Superfície e borda de 1 px carregam a separação, não a sombra.

## Foco e estado

Anel de foco visível de 2 px na cor de acento, com deslocamento de 2 px, em todo elemento interativo, requisito de acessibilidade. Estados obrigatórios por componente interativo: repouso, hover, foco, ativo, desabilitado, e, onde houver dado, vazio e carregando.

## Esboço de custom properties

```css
:root {
  --surface-1: #fcfcfb;
  --surface-page: #f9f9f7;
  --ink-primary: #0b0b0b;
  --ink-secondary: #52514e;
  --ink-muted: #898781;
  --gridline: #e1e0d9;
  --accent: #2a78d6;
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  --radius-control: 4px; --radius-card: 8px; --radius-block: 12px;
  --font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
  --text-hero: 40px; --text-xl: 28px; --text-lg: 20px;
  --text-base: 16px; --text-body: 14px; --text-caption: 12px;
  --tracking-title: -0.01em;
}
:root[data-theme="dark"] {
  --surface-1: #1a1a19;
  --surface-page: #0d0d0d;
  --ink-primary: #ffffff;
  --ink-secondary: #c3c2b7;
  --gridline: #2c2c2a;
  --accent: #3987e5;
}
```
