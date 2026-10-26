import * as Plot from "@observablehq/plot";
import { X } from "lucide-react";
import type { PointerEvent as PointerEventoReact } from "react";
import { useEffect, useRef, useState } from "react";
import { formatarPercentual, quadranteFiscal, rotuloPorte } from "../lib/data";
import type { CortesPorte } from "../lib/data";
import type { Municipio } from "../lib/types";
import { EstadoVazio } from "./EstadoVazio";

// Corner quadrant labels: semibold ink with a surface-colored halo so they read
// clearly over the point cloud.
const estiloRotuloQuadrante = {
  fill: "var(--ink-secondary)",
  fontSize: 12,
  fontWeight: 600,
  stroke: "var(--surface-page)",
  strokeWidth: 3,
} as const;

interface Dominio {
  x: [number, number];
  y: [number, number];
}

type TipoEscala = "linear" | "log";

// Full extent of the data, the reset/default view for the zoom. A log scale
// cannot include 0, so its lower bounds start at the data minimum (both ratios
// are strictly positive).
function dominioInicial(dados: Municipio[], escala: TipoEscala): Dominio {
  const xs = dados.map((m) => m.razao_fpm_receita);
  const ys = dados.map((m) => m.razao_receita_pib);
  const xmin = xs.length > 0 ? Math.min(...xs) : 0.001;
  const ymin = ys.length > 0 ? Math.min(...ys) : 0.01;
  const ymax = ys.length > 0 ? Math.max(...ys) : 1;
  if (escala === "log") {
    return { x: [Math.max(1e-3, xmin * 0.9), 1], y: [Math.max(1e-3, ymin * 0.9), ymax * 1.1] };
  }
  return { x: [0, 1], y: [Math.max(0, ymin - 0.03), ymax + 0.05] };
}

// Pixel to data along an axis, honouring the scale type (linear or log).
function pixelParaDado(px: number, faixa: [number, number], dom: [number, number], log: boolean): number {
  const t = (px - faixa[0]) / (faixa[1] - faixa[0]);
  if (log) {
    return Math.exp(Math.log(dom[0]) + t * (Math.log(dom[1]) - Math.log(dom[0])));
  }
  return dom[0] + t * (dom[1] - dom[0]);
}

// New domain endpoint after zooming toward a center by factor f, in the scale's
// own space (multiplicative for log, additive for linear).
function novoEndpoint(e: number, centro: number, f: number, log: boolean): number {
  return log ? centro * Math.pow(e / centro, f) : centro + (e - centro) * f;
}

function medianaLista(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 1
    ? (ord[meio] ?? 0)
    : ((ord[meio - 1] ?? 0) + (ord[meio] ?? 0)) / 2;
}

interface DispersaoFiscalProps {
  dados: Municipio[]; // already filtered by porte by the caller (see routes/fiscal.tsx)
  // Human-readable description of the active porte filter, folded into the
  // aria-label so a screen reader user knows the same recorte the sighted
  // reader sees, without owning the filter control itself.
  rotuloFiltro: string;
  // codigo_ibge of the focused city (shared selection): drawn with an accent
  // ring on top of its dot so the same municipality is legible across tabs.
  destaque?: string;
  // Median FPM/receita and receita/PIB per porte, so the tooltip can name the
  // fiscal quadrant of each municipality against peers of its own size.
  cortesPorte?: Map<string, CortesPorte>;
}

// Observable Plot inside React: revenue-over-GDP against the FPM share, with a
// continuous divergent read (see docs/DASHBOARD.md, sec 5.1) anchored on the
// neutral line where revenue equals GDP. Comparison is always by porte (see
// docs/DECISAO_CAUSAL.md); the porte filter itself is owned by the caller so
// the accessible table alternative can share the same recorte (see
// routes/fiscal.tsx).
export function DispersaoFiscal({ dados, rotuloFiltro, destaque, cortesPorte }: DispersaoFiscalProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [largura, setLargura] = useState(720);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  // Zoom by re-plotting with adjusted domains: wheel zooms toward the cursor,
  // drag pans, double-click resets. Kept crisp (real marks, not a CSS scale).
  const [dominio, setDominio] = useState<Dominio | null>(null);
  const [escala, setEscala] = useState<TipoEscala>("linear");
  const dominioRef = useRef<Dominio | null>(null);
  const faixaPixelRef = useRef<Dominio | null>(null);
  const arrasteRef = useRef<{ x: number; y: number } | null>(null);
  const escalaRef = useRef<TipoEscala>("linear");
  escalaRef.current = escala;

  const dominioAtual = dominio ?? dominioInicial(dados, escala);
  dominioRef.current = dominioAtual;

  // Reset the view whenever the shown set or the scale type changes.
  useEffect(() => {
    setDominio(null);
  }, [dados, escala]);

  // Track the host width so the plot fills its container without ever forcing
  // horizontal page scroll.
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const largura0 = entries[0]?.contentRect.width;
      if (largura0 && largura0 > 0) setLargura(largura0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!host.current || dados.length === 0) return;

    const razoes = dados.map((m) => m.razao_receita_pib);
    const maiorFpm = Math.max(...dados.map((m) => m.razao_fpm_receita));
    // Quadrant guides at the median of the shown set: when a single porte is
    // filtered this is that porte's median, so the cross matches the per-porte
    // quadrant named in the tooltip.
    const medFpm = medianaLista(dados.map((m) => m.razao_fpm_receita));
    const medPib = medianaLista(razoes);

    const grafico = Plot.plot({
      width: largura,
      height: 420,
      marginRight: 32,
      style: {
        background: "transparent",
        color: "var(--ink-secondary)",
        fontSize: "12px",
      },
      x: {
        label: "% do FPM na receita (razão fpm/receita)",
        type: escala === "log" ? "log" : "linear",
        domain: dominioAtual.x,
        // Ratio in 0..1 shown as a percentage on the axis. Note: Plot's
        // `percent: true` would multiply the data by 100 while the domain stays
        // [0, 1], pushing every point off to the right; format the ticks
        // instead and keep the data in its native 0..1 range.
        tickFormat: (t: number) => `${(t * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      },
      y: {
        label: "receita / PIB",
        type: escala === "log" ? "log" : "linear",
        domain: dominioAtual.y,
        tickFormat: (t: number) =>
          t.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      },
      marks: [
        // Grid drawn explicitly with the token color; the built-in x/y grid
        // option would use currentColor instead of --gridline.
        Plot.gridX({ stroke: "var(--gridline)" }),
        Plot.gridY({ stroke: "var(--gridline)" }),
        // Quadrant cross at the porte median (fiscal profile, docs/DECISAO_CAUSAL):
        // solid, so it reads as the structural division.
        Plot.ruleX([medFpm], { stroke: "var(--ink-muted)", strokeWidth: 1.5 }),
        Plot.ruleY([medPib], { stroke: "var(--ink-muted)", strokeWidth: 1.5 }),
        // Reference line where revenue equals GDP: dashed, a secondary guide.
        Plot.ruleY([1], { stroke: "var(--baseline)", strokeWidth: 1.5, strokeDasharray: "6 4" }),
        Plot.text(
          [{ x: maiorFpm, y: 1 }],
          {
            x: "x",
            y: "y",
            dy: -8,
            textAnchor: "end",
            text: () => "receita = PIB",
            fill: "var(--ink-muted)",
          },
        ),
        Plot.dot(dados, {
          x: "razao_fpm_receita",
          y: "razao_receita_pib",
          r: 4,
          // Colored by the IDM on the map's spectral ramp (color-mix resolves the
          // tokens at paint time, so it tracks a live theme switch).
          fill: (d: Municipio) => corIdm(d.idm),
          fillOpacity: 0.8,
          stroke: "var(--surface-1)",
          strokeWidth: 0.75,
          clip: true,
        }),
        // Accent ring on the focused city, drawn on top so it stays legible
        // over its own dot; empty when nothing is focused.
        Plot.dot(
          dados.filter((m) => m.codigo_ibge === destaque),
          {
            x: "razao_fpm_receita",
            y: "razao_receita_pib",
            r: 8,
            fill: "none",
            stroke: "var(--accent)",
            strokeWidth: 2.5,
          },
        ),
        // Quadrant labels, one per corner (the full name is in the tooltip).
        // A surface-colored halo (stroke under fill) keeps them legible over the
        // point cloud; semibold ink so they read as chart structure.
        Plot.text([{}], { frameAnchor: "top-left", dx: 8, dy: 8, textAnchor: "start", text: () => "base própria robusta", ...estiloRotuloQuadrante }),
        Plot.text([{}], { frameAnchor: "top-right", dx: -8, dy: 8, textAnchor: "end", text: () => "sustentado pelo repasse", ...estiloRotuloQuadrante }),
        Plot.text([{}], { frameAnchor: "bottom-left", dx: 8, dy: -8, textAnchor: "start", text: () => "autônomo e enxuto", ...estiloRotuloQuadrante }),
        Plot.text([{}], { frameAnchor: "bottom-right", dx: -8, dy: -8, textAnchor: "end", text: () => "dependente do repasse", ...estiloRotuloQuadrante }),
        Plot.tip(
          dados,
          Plot.pointer({
            x: "razao_fpm_receita",
            y: "razao_receita_pib",
            title: (d: Municipio) => {
              const base =
                `${d.nome} (${d.uf}), porte ${rotuloPorte(d.porte_faixa)}\n` +
                `IDM: ${d.idm.toFixed(2).replace(".", ",")}\n` +
                `receita / PIB: ${d.razao_receita_pib.toFixed(2).replace(".", ",")}x\n` +
                `FPM/receita: ${formatarPercentual(d.razao_fpm_receita)}\n` +
                `acima do PIB: ${d.razao_receita_pib >= 1 ? "sim" : "não"}`;
              return cortesPorte
                ? `${base}\nquadrante: ${quadranteFiscal(d, cortesPorte).rotulo}`
                : base;
            },
          }),
        ),
      ],
    });
    // Capture the plot area pixel ranges so the wheel/drag handlers can convert
    // cursor pixels to data coordinates.
    const rangeX = grafico.scale("x")?.range;
    const rangeY = grafico.scale("y")?.range;
    const rx = rangeX ? Array.from(rangeX as Iterable<number>) : [];
    const ry = rangeY ? Array.from(rangeY as Iterable<number>) : [];
    if (rx.length >= 2 && ry.length >= 2) {
      faixaPixelRef.current = {
        x: [rx[0] ?? 0, rx[1] ?? 0],
        y: [ry[0] ?? 0, ry[1] ?? 0],
      };
    }

    const node = host.current;
    node.replaceChildren(grafico);
    return () => {
      grafico.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, largura, destaque, cortesPorte, dominio, escala]);

  // Wheel zoom toward the cursor: a non-passive listener so it can preventDefault
  // and not scroll the page.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const aoRodar = (e: WheelEvent) => {
      const faixa = faixaPixelRef.current;
      const d = dominioRef.current;
      if (!faixa || !d) return;
      e.preventDefault();
      const log = escalaRef.current === "log";
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dataX = pixelParaDado(sx, faixa.x, d.x, log);
      const dataY = pixelParaDado(sy, faixa.y, d.y, log);
      const f = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      setDominio({
        x: [novoEndpoint(d.x[0], dataX, f, log), novoEndpoint(d.x[1], dataX, f, log)],
        y: [novoEndpoint(d.y[0], dataY, f, log), novoEndpoint(d.y[1], dataY, f, log)],
      });
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, []);

  const aoPressionar = (e: PointerEventoReact<HTMLDivElement>) => {
    arrasteRef.current = { x: e.clientX, y: e.clientY };
    host.current?.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: PointerEventoReact<HTMLDivElement>) => {
    const faixa = faixaPixelRef.current;
    const d = dominioRef.current;
    if (!arrasteRef.current || !faixa || !d) return;
    const dx = e.clientX - arrasteRef.current.x;
    const dy = e.clientY - arrasteRef.current.y;
    arrasteRef.current = { x: e.clientX, y: e.clientY };
    if (escalaRef.current === "log") {
      const kx = Math.exp(
        (-dx * (Math.log(d.x[1]) - Math.log(d.x[0]))) / (faixa.x[1] - faixa.x[0]),
      );
      const ky = Math.exp(
        (-dy * (Math.log(d.y[1]) - Math.log(d.y[0]))) / (faixa.y[1] - faixa.y[0]),
      );
      setDominio({
        x: [d.x[0] * kx, d.x[1] * kx],
        y: [d.y[0] * ky, d.y[1] * ky],
      });
      return;
    }
    const passoX = (d.x[1] - d.x[0]) / (faixa.x[1] - faixa.x[0]);
    const passoY = (d.y[1] - d.y[0]) / (faixa.y[1] - faixa.y[0]);
    setDominio({
      x: [d.x[0] - dx * passoX, d.x[1] - dx * passoX],
      y: [d.y[0] - dy * passoY, d.y[1] - dy * passoY],
    });
  };
  const aoSoltar = () => {
    arrasteRef.current = null;
  };

  if (dados.length === 0) {
    return (
      <EstadoVazio mensagem="Nenhum município no recorte atual para a dispersão fiscal." />
    );
  }

  const rotulo =
    `Dispersão fiscal: receita sobre PIB por participação do FPM na receita, ` +
    `${dados.length} municípios no recorte ${rotuloFiltro}. Cada ponto é ` +
    `colorido pelo IDM: azul menos dependente, amarelo intermediário, vermelho ` +
    `mais dependente. Quadrantes cortados pela mediana do porte.`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <LegendaIdmDispersao />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={() => setAjudaAberta(true)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: "var(--accent)",
            fontSize: "var(--text-body)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          como ler os quadrantes
        </button>
        <div role="group" aria-label="Escala do gráfico" style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", overflow: "hidden" }}>
          {(["linear", "log"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={escala === t}
              onClick={() => setEscala(t)}
              style={{
                padding: "var(--space-1) var(--space-3)",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-body)",
                color: escala === t ? "var(--on-accent)" : "var(--ink-secondary)",
                background: escala === t ? "var(--accent)" : "transparent",
              }}
            >
              {t === "linear" ? "linear" : "log-log"}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={host}
        role="img"
        aria-label={rotulo}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
        onDoubleClick={() => setDominio(dominioInicial(dados, escala))}
        style={{ touchAction: "none", cursor: "grab" }}
      />
      <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
        Roda do mouse aproxima, arraste move, duplo-clique reseta.
      </span>
      {ajudaAberta && <QuadrantesModal onFechar={() => setAjudaAberta(false)} />}
    </div>
  );
}

// Reader's guide to the fiscal quadrants: the 2x2 grid with the axis directions
// spelled out, so the corners read intuitively. The cut is the porte median;
// the frame is descriptive of revenue structure, never a management grade.
function QuadrantesModal({ onFechar }: { onFechar: () => void }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar]);

  const celula = (titulo: string, texto: string) => (
    <div
      style={{
        padding: "var(--space-3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
      }}
    >
      <strong style={{ fontSize: "var(--text-body)", color: "var(--ink-primary)" }}>{titulo}</strong>
      <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-secondary)" }}>{texto}</span>
    </div>
  );

  return (
    <div
      className="detalhe-fundo"
      role="presentation"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Como ler os quadrantes fiscais"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          background: "var(--surface-page)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-block)",
          boxShadow: "var(--shadow-floating)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Como ler os quadrantes</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" style={{ display: "inline-flex", background: "transparent", border: "none", padding: "var(--space-1)", color: "var(--ink-secondary)", cursor: "pointer" }}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "var(--text-body)", color: "var(--ink-secondary)" }}>
          O corte de cada eixo é a <strong>mediana do porte</strong>: cada cidade
          comparada com as do próprio tamanho.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)", textAlign: "center" }}>
            ↑ orçamento grande frente ao PIB
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
            {celula("Base própria robusta", "arrecada do próprio território e movimenta muito frente ao PIB")}
            {celula("Orçamento sustentado pelo repasse", "o FPM eleva o orçamento acima do que a economia local geraria")}
            {celula("Autônomo e enxuto", "vive da própria base, com orçamento proporcionalmente pequeno")}
            {celula("Dependente do repasse", "pequeno município que depende do FPM, base local fraca")}
          </div>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--ink-muted)", textAlign: "center" }}>
            ↓ orçamento pequeno frente ao PIB
          </span>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
            <span>← arrecadação própria (mais esforço próprio)</span>
            <span>depende do FPM →</span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--ink-muted)" }}>
          Perfil descritivo da estrutura de receita, não nota de gestão:
          dependência reflete a posição na rede urbana e as regras de repasse
          federais.
        </p>
      </div>
    </div>
  );
}

// Legend for the dot color, which encodes the IDM on the spectral ramp (a
// literal-color fill opts the marks out of Plot's automatic legend). Meaning is
// also carried in the chart's aria-label for anyone who cannot see the gradient.
function LegendaIdmDispersao() {
  return (
    <div
      aria-hidden
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
    >
      <div
        style={{
          height: "var(--space-2)",
          borderRadius: "var(--radius-full)",
          background:
            "linear-gradient(to right, var(--idm-100), var(--idm-450), var(--idm-700))",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          fontSize: "var(--text-caption)",
          color: "var(--ink-muted)",
        }}
      >
        <span>IDM: menos dependente</span>
        <span>mais dependente</span>
      </div>
    </div>
  );
}

// Dots are colored by the IDM on the map's spectral ramp (blue less dependent,
// yellow in the middle, red more dependent). This adds a variable the axes do
// not carry (the composite index), keeps a clearly visible intermediate tone,
// and unifies the color language with the map. color-mix over the tokens so it
// tracks the theme.
const PARADAS_IDM = [
  { t: 0, c: "--idm-100" },
  { t: 0.25, c: "--idm-300" },
  { t: 0.5, c: "--idm-450" },
  { t: 0.75, c: "--idm-600" },
  { t: 1, c: "--idm-700" },
] as const;

function corIdm(v: number): string {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 1; i < PARADAS_IDM.length; i++) {
    const p1 = PARADAS_IDM[i];
    const p0 = PARADAS_IDM[i - 1];
    if (!p1 || !p0) continue;
    if (x <= p1.t) {
      const peso = p1.t > p0.t ? (x - p0.t) / (p1.t - p0.t) : 0;
      return `color-mix(in srgb, var(${p1.c}) ${(peso * 100).toFixed(1)}%, var(${p0.c}))`;
    }
  }
  const ultima = PARADAS_IDM[PARADAS_IDM.length - 1];
  return `var(${ultima ? ultima.c : "--idm-700"})`;
}
