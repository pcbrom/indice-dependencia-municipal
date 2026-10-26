import { useEffect, useRef, useState } from "react";
import type {
  AddLayerObject,
  FilterSpecification,
  GeoJSONSource,
  Map as MaplibreMap,
  Marker as MaplibreMarker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  carregarMalha,
  carregarMundo,
  carregarMunicipios,
  carregarRegioes,
  filtrarMunicipios,
} from "../lib/data";
import type { MalhaGeoJSON } from "../lib/data";
import type { FiltrosMapa, Ligacao, Municipio } from "../lib/types";
import { centroideAproximado } from "./EgoGraphOrbita";
import { EstadoCarregando } from "./EstadoCarregando";
import { EstadoVazio } from "./EstadoVazio";

const FONTE_MUNDO = "mundo";
const CAMADA_MUNDO_FILL = "mundo-fill";
const CAMADA_MUNDO_LINHA = "mundo-linha";
const FONTE_MALHA = "malha-idm";
const CAMADA_PREENCHIMENTO = "malha-idm-preenchimento";
const CAMADA_CONTORNO = "malha-idm-contorno";
const CAMADA_SELECAO = "malha-idm-selecao";
const CAMADA_CLUSTER = "malha-idm-cluster";
const CAMADA_CLUSTER_FILL = "malha-idm-cluster-fill";
const CAMADA_FRONTEIRA = "malha-idm-fronteira";
const FONTE_POLOS = "polos-idm";
const CAMADA_POLOS = "polos-idm-pontos";
const FONTE_REGIOES = "regioes-idm";
const CAMADA_REGIOES = "regioes-idm-contorno";
const CAMADA_CAPITAIS = "capitais-idm-contorno";

// The 27 Brazilian state (and DF) capitals by IBGE code. Their municipal
// polygon receives a distinct outline on the mesh as a geographic reference,
// independent of the data filter. Brasilia (5300108) is included even though it
// has no IDM row (DF finances are reported at the state level, see
// docs/DADOS.md): its polygon exists in the mesh, so the capital contour still
// draws.
const CAPITAIS_IBGE = [
  "1100205", "1200401", "1302603", "1400100", "1501402", "1600303", "1721000",
  "2111300", "2211001", "2304400", "2408102", "2507507", "2611606", "2704302",
  "2800308", "2927408", "3106200", "3205309", "3304557", "3550308", "4106902",
  "4205407", "4314902", "5002704", "5103403", "5208707", "5300108",
];

// Native maplibre clustering (supercluster running inside the GL source),
// tuned to read like Leaflet.markercluster: bubbles absorb nearby points at
// low zoom and let go as the reader approaches. clusterMaxZoom 7 is roughly
// state-level in Brazil's extent (docs/DECISAO_UX.md tela 1 starts at zoom
// 3); past that every polo/semi-polo renders as its own point.
const CLUSTER_RAIO_PX = 48;
const CLUSTER_ZOOM_MAX = 7;

// Once the reader is close enough that clusters have broken into individual
// points, the city name is drawn beside each unclustered polo/semi-polo so the
// dot is identifiable (docs/DECISAO_UX.md: identifiability of the point).
// Below this zoom only the dot shows, so far-apart isolated points at national
// zoom do not litter the map with name pills.
const ROTULO_ZOOM_MIN = 6;

// Layered labeling: polos earn a name from ROTULO_ZOOM_MIN up (the largest win
// the collision pass first, so far out only big polos show), while semi-polos
// stay unlabeled until the reader is closer, so they never crowd the polos.
const ROTULO_ZOOM_SEMIPOLO = 8;

// Rough on-screen size of a name pill, in CSS pixels, used only to test whether
// two labels would overlap during the declutter pass. The caption font is 12px
// 600; ~6.6px per glyph plus the horizontal padding is close enough for a
// bounding box, and a small inflation keeps neighbors from touching.
function caixaRotulo(nome: string): { largura: number; altura: number } {
  return { largura: nome.length * 6.6 + 8, altura: 16 };
}

// Axis-aligned overlap test between two label boxes [x0, y0, x1, y1].
function sobrepoe(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

// Point feature properties for the polos/semi-polos source: never
// "orbitante" (docs/DECISAO_UX.md, orbitantes stay coropletico-only).
interface PontoPoloProperties {
  codigo_ibge: string;
  tipologia: "polo" | "semi-polo";
  nome: string;
}
type PontosPolosGeoJSON = GeoJSON.FeatureCollection<GeoJSON.Point, PontoPoloProperties>;

const formatoContagem = new Intl.NumberFormat("pt-BR");

// Bubble diameter/font grow in steps by count, like Leaflet.markercluster's
// small/medium/large rings. Every value is a space or type-scale token
// (docs/TOKENS.md); no literal px sneaks into the cluster bubble.
function tamanhoBolhaCluster(contagem: number): { diametro: string; fonte: string } {
  if (contagem >= 100) return { diametro: "var(--space-8)", fonte: "var(--text-lg)" };
  if (contagem >= 10) return { diametro: "var(--space-7)", fonte: "var(--text-body)" };
  return { diametro: "var(--space-6)", fonte: "var(--text-caption)" };
}

// Applies size, label and aria-label for a cluster bubble; reused both when
// the bubble is created and when its count changes after a re-cluster (a
// filter change or a zoom step that regroups points).
function aplicarEstiloBolhaCluster(el: HTMLButtonElement, contagem: number): void {
  const { diametro, fonte } = tamanhoBolhaCluster(contagem);
  el.style.width = diametro;
  el.style.height = diametro;
  el.style.fontSize = fonte;
  el.textContent = formatoContagem.format(contagem);
  el.setAttribute(
    "aria-label",
    `${formatoContagem.format(contagem)} centros nesta região, aproximar`,
  );
}

// HTML marker element for a cluster bubble. Styled only with design tokens;
// color and border read live CSS custom properties (var(...)), so unlike the
// GL circle layer below this element needs no re-paint from the theme
// MutationObserver: flipping data-theme on the root recolors it for free.
function criarElementoBolhaCluster(contagem: number, aoClicar: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.padding = "0";
  el.style.lineHeight = "1";
  el.style.fontFamily = "var(--font-sans)";
  el.style.fontWeight = "600";
  el.style.color = "var(--on-accent)";
  el.style.background = "var(--accent)";
  el.style.border = "2px solid var(--surface-1)";
  el.style.borderRadius = "var(--radius-full)";
  el.style.cursor = "pointer";
  aplicarEstiloBolhaCluster(el, contagem);
  el.addEventListener("click", aoClicar);
  return el;
}

// HTML marker element for a city-name label pinned beside an unclustered
// point. Non-interactive (pointer-events: none) so it never intercepts a click
// meant for the dot underneath. Styled only with tokens, so it recolors with
// the theme through the CSS cascade, needing no MutationObserver entry.
function criarElementoRotuloPonto(nome: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = nome;
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "nowrap";
  el.style.fontFamily = "var(--font-sans)";
  el.style.fontSize = "var(--text-caption)";
  el.style.fontWeight = "600";
  el.style.lineHeight = "1";
  el.style.color = "var(--ink-primary)";
  // Just the name over a faint, transparent badge: no border, no shadow. A
  // text halo in the surface color keeps it legible over any step of the IDM
  // ramp underneath.
  el.style.background = "color-mix(in srgb, var(--surface-1) 45%, transparent)";
  el.style.borderRadius = "var(--radius-control)";
  el.style.padding = "0 var(--space-1)";
  el.style.textShadow =
    "0 0 2px var(--surface-1), 0 0 2px var(--surface-1)";
  return el;
}

// HTML marker element for a macro-region name (Norte, Sul, ...), pinned at the
// region's representative point. Uppercase and letter-spaced to read as a map
// stratum distinct from the city-name pill; non-interactive; token-styled so it
// recolors with the theme through the cascade.
function criarElementoRotuloRegiao(nome: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = nome;
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "nowrap";
  el.style.fontFamily = "var(--font-sans)";
  el.style.fontSize = "var(--text-body)";
  el.style.fontWeight = "600";
  el.style.letterSpacing = "0.08em";
  el.style.textTransform = "uppercase";
  el.style.color = "var(--ink-secondary)";
  // Just the name over a faint, transparent badge, matching the city labels.
  el.style.background = "color-mix(in srgb, var(--surface-1) 45%, transparent)";
  el.style.borderRadius = "var(--radius-control)";
  el.style.padding = "0 var(--space-1)";
  el.style.textShadow = "0 0 2px var(--surface-1), 0 0 2px var(--surface-1)";
  return el;
}

// Reads a resolved CSS custom property from the root. MapLibre's GL paint
// pipeline cannot consume var() directly (it is not a DOM cascade), so the
// token value is read once and re-applied whenever the theme flips (see the
// MutationObserver effect below). This keeps every map color traceable to a
// token in styles/tokens.css instead of a literal.
function lerToken(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

// MapLibre GL needs a WebGL context. Chrome no longer falls back to software
// WebGL automatically, so a machine with hardware acceleration disabled or a
// blocklisted GPU has no WebGL and the map cannot render. Detected up front so
// the reader gets a precise message instead of a misleading "data failed" one.
function suportaWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

// Data-driven expression that colors the choropleth by IDM on the sequential
// blue ramp (docs/TOKENS.md), darker meaning more dependent. Municipios absent
// from the join (should not happen once the pipeline covers the universe)
// fall back to the neutral gridline token instead of a literal gray.
function expressaoPreenchimento(): unknown[] {
  return [
    "case",
    ["==", ["get", "idm"], null],
    lerToken("--gridline"),
    [
      "interpolate",
      ["linear"],
      ["get", "idm"],
      0,
      lerToken("--idm-100"),
      0.25,
      lerToken("--idm-300"),
      0.5,
      lerToken("--idm-450"),
      0.75,
      lerToken("--idm-600"),
      1,
      lerToken("--idm-700"),
    ],
  ];
}

export interface MapaProntoInfo {
  mapa: MaplibreMap;
  malha: MalhaGeoJSON;
}

interface MapaOrbitasProps {
  filtros: FiltrosMapa;
  municipioSelecionado?: string;
  // REGIC links, used to resolve the selected city's network (its polo plus the
  // orbitantes pointing to it) so those cities' names are labeled and every
  // other label dims, mirroring the ego-graph lines drawn by EgoGraphOrbita.
  ligacoes?: Ligacao[];
  // Fired once, after the mesh source and the choropleth layers are on the
  // map. routes/mapa.tsx uses this to hand the live map instance and the
  // joined mesh down to EgoGraphOrbita, which draws its own line layer on the
  // same GL context (see docs/DASHBOARD.md 5.4, "ego-graph de orbita").
  onMapaPronto?: (info: MapaProntoInfo) => void;
  // Fired when the reader clicks a polo/semi-polo point or any municipio's
  // choropleth fill. Selection only, never a navigation: routes/mapa.tsx
  // reveals PainelPolo with the summary instead of jumping straight to the
  // profile (docs/DECISAO_UX.md redesign of Tela 1).
  onSelecionarMunicipio?: (codigoIbge: string) => void;
  // Cluster overlay (Brasil em Cenarios, routes/cenarios.tsx): a solid accent
  // outline over the municipalities in the grouping, and a dashed one over the
  // contiguous same-state neighbors that can still be added. Additive over the
  // IDM choropleth, which is kept as the base; empty on the plain map.
  selecaoCluster?: string[];
  fronteiraCluster?: string[];
  // When set, each listed municipality is painted its given color over the
  // choropleth, the simulated IDM of its functional region (its anchor's). Works
  // at any scope, one region or a whole UF/region/country. Undefined shows the
  // real per-municipality IDM (the current view). See routes/cenarios.tsx.
  simuladoPorCodigo?: Record<string, string>;
}

// MapLibre GL choropleth of the IDM: the single color channel of the map
// (docs/DASHBOARD.md 5.1). No external tile server, empty style compatible
// with the CSP (docs/DASHBOARD.md, secao 1: site estatico, sem servidor
// vivo). Loads the mesh and the municipios itself and performs the
// client-side join by codigo_ibge; the tipologia chips act as a native
// maplibre filter, never as a second color channel (docs/DECISAO_UX.md).
export function MapaOrbitas({
  filtros,
  municipioSelecionado,
  ligacoes = [],
  onMapaPronto,
  onSelecionarMunicipio,
  selecaoCluster,
  fronteiraCluster,
  simuladoPorCodigo,
}: MapaOrbitasProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<MaplibreMap | null>(null);
  const prontoRef = useRef(false);
  // Full municipio list, kept for the combined uf/faixaIdm/porte/tipologia
  // filter below; the effect that reacts to filtro changes needs it without
  // re-fetching or re-triggering the mount effect.
  const municipiosRef = useRef<Municipio[]>([]);
  // Full (unfiltered) polos/semi-polos point set, the raw material the
  // filtro effect below slices from every time a chip/UF/porte/faixa changes;
  // the clustered source only ever holds the currently visible subset.
  const pontosPolosBaseRef = useRef<PontosPolosGeoJSON>({
    type: "FeatureCollection",
    features: [],
  });
  // HTML cluster bubbles keyed by supercluster's cluster_id, kept in sync
  // with querySourceFeatures on every move/render (see the load handler).
  const clusterMarkersRef = useRef<Map<number, MaplibreMarker>>(new Map());
  // City-name label markers for unclustered points, keyed by codigo_ibge, kept
  // in sync alongside the cluster bubbles on every move/render.
  const rotuloMarkersRef = useRef<Map<string, MaplibreMarker>>(new Map());
  // Five fixed macro-region name markers, created once and toggled by zoom
  // (shown when zoomed out, hidden as the city labels take over).
  const regiaoMarkersRef = useRef<MaplibreMarker[]>([]);
  // Centroid, name, tipologia and population for every municipality, so a
  // network member that is an orbitante (no point on the map) can still be
  // labeled, and so labels can be prioritized by population when they collide.
  const municipioInfoRef = useRef<
    Map<
      string,
      {
        centro: [number, number];
        nome: string;
        tipologia: Municipio["tipologia"];
        populacao: number;
      }
    >
  >(new Map());
  // Codigos in the selected city's network (itself, its polo, and the
  // orbitantes pointing to it); empty when nothing is selected.
  const redeAtivaRef = useRef<Set<string>>(new Set());
  // Codigo of the point currently hovered, so its name shows even when the
  // declutter pass would otherwise drop it.
  const hoverRef = useRef<string | null>(null);
  const clusterFrameRef = useRef<number | null>(null);
  const atualizarClustersRef = useRef<(() => void) | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [semWebgl, setSemWebgl] = useState(false);

  // Refs keep the bootstrap effect free of dependencies that would tear down
  // and recreate the GL context on every render (callback identity churn on
  // every render of the parent route).
  const onMapaProntoRef = useRef(onMapaPronto);
  onMapaProntoRef.current = onMapaPronto;
  const onSelecionarMunicipioRef = useRef(onSelecionarMunicipio);
  onSelecionarMunicipioRef.current = onSelecionarMunicipio;

  useEffect(() => {
    if (!container.current) return;
    // WebGL first: without it MapLibre cannot create a context, and the map is
    // the only screen that hard-depends on it (the data loads fine, the other
    // screens work). Show a precise message instead of loading for nothing.
    if (!suportaWebGL()) {
      setSemWebgl(true);
      setCarregando(false);
      return;
    }
    let disposed = false;

    void Promise.all([
      import("maplibre-gl"),
      carregarMalha(),
      carregarMunicipios(),
      carregarRegioes(),
      carregarMundo(),
    ])
      .then(([maplibre, malha, municipios, regioes, mundo]) => {
        if (disposed || !container.current) return;

        // Client-side join: each mesh feature carries only codigo_ibge (see
        // lib/data carregarMalha docstring); idm and tipologia come from the
        // municipio of the same key.
        municipiosRef.current = municipios;
        const porCodigo = new Map<string, Municipio>();
        for (const m of municipios) porCodigo.set(m.codigo_ibge, m);
        const malhaJunta: MalhaGeoJSON = {
          type: "FeatureCollection",
          features: malha.features.map((feature) => {
            const codigo = feature.properties.codigo_ibge;
            const municipio = codigo ? porCodigo.get(codigo) : undefined;
            return {
              ...feature,
              properties: {
                ...feature.properties,
                idm: municipio?.idm ?? null,
                tipologia: municipio?.tipologia ?? null,
              },
            };
          }),
        };

        // Polo/semi-polo point layer, placed at each feature's centroid
        // (the same approximation EgoGraphOrbita uses for its line
        // endpoints). Orbitantes never become a point (docs/DECISAO_UX.md,
        // "o no e ponto de tamanho fixo"): they stay coropletico-only.
        const pontosPolos: PontosPolosGeoJSON = {
          type: "FeatureCollection",
          features: malhaJunta.features.flatMap((feature) => {
            const tipologia = feature.properties.tipologia;
            if (tipologia !== "polo" && tipologia !== "semi-polo") return [];
            const centro = centroideAproximado(feature.geometry);
            if (!centro) return [];
            const codigo = feature.properties.codigo_ibge ?? "";
            const municipio = codigo ? porCodigo.get(codigo) : undefined;
            return [
              {
                type: "Feature" as const,
                properties: {
                  codigo_ibge: codigo,
                  tipologia,
                  nome: municipio?.nome ?? "",
                },
                geometry: { type: "Point" as const, coordinates: centro },
              },
            ];
          }),
        };
        pontosPolosBaseRef.current = pontosPolos;

        // Centroid + name for every municipality with both, so the selected
        // city's network (which includes orbitantes that have no point) can be
        // labeled at each member's centroid.
        const infoPorCodigo = new Map<
          string,
          {
            centro: [number, number];
            nome: string;
            tipologia: Municipio["tipologia"];
            populacao: number;
          }
        >();
        for (const feature of malhaJunta.features) {
          const codigo = feature.properties.codigo_ibge;
          if (!codigo) continue;
          const centro = centroideAproximado(feature.geometry);
          const municipio = porCodigo.get(codigo);
          if (centro && municipio) {
            infoPorCodigo.set(codigo, {
              centro,
              nome: municipio.nome,
              tipologia: municipio.tipologia,
              populacao: municipio.populacao,
            });
          }
        }
        municipioInfoRef.current = infoPorCodigo;

        const mapa = new maplibre.Map({
          container: container.current,
          style: {
            version: 8,
            sources: {},
            layers: [
              {
                id: "bg",
                type: "background",
                paint: { "background-color": lerToken("--surface-page") },
              },
            ],
          },
          center: [-52, -14],
          zoom: 3,
          minZoom: 1,
          attributionControl: false,
        });
        mapaRef.current = mapa;
        mapa.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-left",
        );

        mapa.on("load", () => {
          if (disposed) return;

          // World scenery (Natural Earth, Brazil removed): faint land behind the
          // choropleth so Brazil reads at full strength and the rest of the
          // world sits at ~20% opacity, Google-Earth style. Added first, so it
          // is the bottom layer.
          mapa.addSource(FONTE_MUNDO, {
            type: "geojson",
            data: mundo as unknown as GeoJSON.GeoJSON,
          });
          mapa.addLayer({
            id: CAMADA_MUNDO_FILL,
            type: "fill",
            source: FONTE_MUNDO,
            paint: { "fill-color": lerToken("--baseline"), "fill-opacity": 0.2 },
          } as unknown as AddLayerObject);
          mapa.addLayer({
            id: CAMADA_MUNDO_LINHA,
            type: "line",
            source: FONTE_MUNDO,
            paint: { "line-color": lerToken("--border"), "line-width": 0.4 },
          } as unknown as AddLayerObject);

          mapa.addSource(FONTE_MALHA, {
            type: "geojson",
            data: malhaJunta as unknown as GeoJSON.GeoJSON,
          });

          mapa.addLayer({
            id: CAMADA_PREENCHIMENTO,
            type: "fill",
            source: FONTE_MALHA,
            paint: {
              "fill-color": expressaoPreenchimento(),
              // Softer than a stand-alone choropleth (was 0.92): the polo
              // points and the ego-graph lines added on top need to read
              // clearly against the fill (see PainelPolo interaction below).
              "fill-opacity": 0.78,
            },
          } as unknown as AddLayerObject);

          mapa.addLayer({
            id: CAMADA_CONTORNO,
            type: "line",
            source: FONTE_MALHA,
            paint: {
              "line-color": lerToken("--border"),
              "line-width": 0.4,
            },
          } as unknown as AddLayerObject);

          // Macro-region contour: a neutral structural line dissolved from the
          // mesh (pipeline regioes.py), above the municipal borders but below
          // the selection and the polo points. A muted ink, not an IDM-ramp
          // color, so it reads as geography and never as a second data channel.
          mapa.addSource(FONTE_REGIOES, {
            type: "geojson",
            data: regioes as unknown as GeoJSON.GeoJSON,
          });
          mapa.addLayer({
            id: CAMADA_REGIOES,
            type: "line",
            source: FONTE_REGIOES,
            paint: {
              "line-color": lerToken("--ink-muted"),
              "line-width": 1.3,
              "line-opacity": 0.75,
            },
          } as unknown as AddLayerObject);

          // Capital outline: the municipal polygon of each of the 27 capitals,
          // traced on the mesh in primary ink so it stays distinct from the
          // accent-blue selection highlight. Independent of the data filter (a
          // geographic reference, not a data slice).
          mapa.addLayer({
            id: CAMADA_CAPITAIS,
            type: "line",
            source: FONTE_MALHA,
            filter: [
              "in",
              ["get", "codigo_ibge"],
              ["literal", CAPITAIS_IBGE],
            ] as unknown as FilterSpecification,
            paint: {
              "line-color": lerToken("--ink-primary"),
              "line-width": 1.8,
            },
          } as unknown as AddLayerObject);

          // Region name markers, created once at their representative points and
          // toggled by zoom below.
          for (const feature of regioes.features) {
            const el = criarElementoRotuloRegiao(feature.properties.regiao);
            const marcador = new maplibre.Marker({ element: el, anchor: "center" })
              .setLngLat(feature.properties.centro)
              .addTo(mapa);
            regiaoMarkersRef.current.push(marcador);
          }

          // Selection highlight: a thin accent outline; empty codigo matches
          // nothing until a municipio is selected via search or click.
          mapa.addLayer({
            id: CAMADA_SELECAO,
            type: "line",
            source: FONTE_MALHA,
            paint: { "line-color": lerToken("--accent"), "line-width": 2.5 },
            filter: ["==", ["get", "codigo_ibge"], ""],
          } as unknown as AddLayerObject);

          // Simulated fill (cenarios): each listed municipality painted its
          // simulated-IDM color over the choropleth. Empty until the reader
          // toggles the simulated view; sits above the choropleth but below the
          // cluster outlines. The color match is set by the effect below.
          mapa.addLayer({
            id: CAMADA_CLUSTER_FILL,
            type: "fill",
            source: FONTE_MALHA,
            paint: { "fill-color": lerToken("--idm-100"), "fill-opacity": 0.9 },
            filter: ["in", ["get", "codigo_ibge"], ["literal", []]],
          } as unknown as AddLayerObject);

          // Cluster overlays (cenarios): a dashed outline over the addable
          // frontier, then a solid, thicker outline over the grouping itself on
          // top. Both start empty and are driven by the effect below; on the
          // plain map they never match a feature.
          mapa.addLayer({
            id: CAMADA_FRONTEIRA,
            type: "line",
            source: FONTE_MALHA,
            paint: {
              "line-color": lerToken("--accent"),
              "line-width": 1.5,
              "line-dasharray": [2, 2],
              "line-opacity": 0.7,
            },
            filter: ["in", ["get", "codigo_ibge"], ["literal", []]],
          } as unknown as AddLayerObject);
          mapa.addLayer({
            id: CAMADA_CLUSTER,
            type: "line",
            source: FONTE_MALHA,
            paint: { "line-color": lerToken("--accent"), "line-width": 3 },
            filter: ["in", ["get", "codigo_ibge"], ["literal", []]],
          } as unknown as AddLayerObject);

          // Clustered source: supercluster (bundled with maplibre-gl) groups
          // nearby points below clusterMaxZoom into a synthetic feature
          // carrying point_count; past that zoom every polo/semi-polo is its
          // own feature again, the Leaflet.markercluster behaviour this
          // component is asked to mirror.
          mapa.addSource(FONTE_POLOS, {
            type: "geojson",
            data: pontosPolos as unknown as GeoJSON.GeoJSON,
            cluster: true,
            clusterRadius: CLUSTER_RAIO_PX,
            clusterMaxZoom: CLUSTER_ZOOM_MAX,
          });

          // Polo/semi-polo point layer on top of the choropleth, restricted
          // to unclustered features: the style has no glyphs (no font
          // server, see the CSP note in docs/DASHBOARD.md), so a clustered
          // feature's count is never rendered as a symbol/text-field here.
          // It is drawn instead as an HTML marker bubble by
          // atualizarBolhasCluster below. Fixed size per tipologia (polo
          // larger than semi-polo, never driven by IDM) and a single accent
          // fill with a surface-toned stroke so the dot reads over any step
          // of the IDM ramp underneath (docs/DECISAO_UX.md: "o no e ponto de
          // tamanho fixo, colorido so pelo IDM" refers to the choropleth; the
          // point itself never repeats that channel, it is a second,
          // deliberately distinct affordance for polos).
          mapa.addLayer({
            id: CAMADA_POLOS,
            type: "circle",
            source: FONTE_POLOS,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": ["match", ["get", "tipologia"], "polo", 7, "semi-polo", 4.5, 0],
              "circle-color": lerToken("--accent"),
              "circle-stroke-width": 1.5,
              "circle-stroke-color": lerToken("--surface-1"),
            },
          } as unknown as AddLayerObject);

          // Cluster bubbles as HTML markers, kept in sync with the GL
          // source's own clustering. querySourceFeatures reads whatever
          // supercluster currently reports for the visible tiles; features
          // are deduped by cluster_id because the same cluster can be
          // returned once per tile at the boundary.
          function atualizarBolhasCluster(): void {
            if (disposed || !prontoRef.current) return;
            const fonte = mapa.getSource(FONTE_POLOS) as
              | GeoJSONSource
              | undefined;
            if (!fonte) return;
            const brutos = mapa.querySourceFeatures(FONTE_POLOS, {
              filter: ["has", "point_count"] as unknown as FilterSpecification,
            });

            const vistos = new Set<number>();
            for (const feature of brutos) {
              const props = feature.properties ?? {};
              const clusterId = props["cluster_id"] as number | undefined;
              if (clusterId === undefined || vistos.has(clusterId)) continue;
              vistos.add(clusterId);
              const contagem = (props["point_count"] as number | undefined) ?? 0;
              const coordenadas = (feature.geometry as GeoJSON.Point)
                .coordinates as [number, number];

              const existente = clusterMarkersRef.current.get(clusterId);
              if (existente) {
                existente.setLngLat(coordenadas);
                aplicarEstiloBolhaCluster(
                  existente.getElement() as HTMLButtonElement,
                  contagem,
                );
                continue;
              }

              const el = criarElementoBolhaCluster(contagem, () => {
                void fonte
                  .getClusterExpansionZoom(clusterId)
                  .then((zoom) => {
                    if (typeof zoom !== "number") return;
                    mapa.easeTo({ center: coordenadas, zoom });
                  })
                  .catch(() => {
                    // Expansion zoom unavailable (cluster already resolved,
                    // race with a data reload): no-op, the next
                    // atualizarBolhasCluster pass will reconcile the bubble.
                  });
              });
              const marcador = new maplibre.Marker({ element: el })
                .setLngLat(coordenadas)
                .addTo(mapa);
              clusterMarkersRef.current.set(clusterId, marcador);
            }

            // Drop bubbles for clusters that left the viewport, merged, or
            // split apart after a zoom step or a filter-driven setData.
            for (const [id, marcador] of clusterMarkersRef.current) {
              if (!vistos.has(id)) {
                marcador.remove();
                clusterMarkersRef.current.delete(id);
              }
            }
          }
          // City-name labels, decluttered by collision. Candidates are ranked,
          // then placed greedily: a name is drawn only if its box clears every
          // name already placed, so the map never stacks overlapping pills.
          // Rank (highest first): the hovered point, then the selected city's
          // network, then polos by population, then semi-polos by population.
          // Layering by zoom keeps semi-polos out until ROTULO_ZOOM_SEMIPOLO,
          // so far out only the big polos that win the collision pass show
          // (the "grandes polos em repouso" behaviour); hovering any point
          // always reveals its name even if it was decluttered away.
          interface CandidatoRotulo {
            codigo: string;
            coord: [number, number];
            nome: string;
            opacidade: string;
          }

          function atualizarRotulos(): void {
            if (disposed || !prontoRef.current) return;
            const rede = redeAtivaRef.current;
            const temSelecao = rede.size > 0;
            const zoom = mapa.getZoom();
            const hover = hoverRef.current;
            const info = municipioInfoRef.current;

            const hoverCands: CandidatoRotulo[] = [];
            const redeCands: CandidatoRotulo[] = [];
            const poloCands: CandidatoRotulo[] = [];
            const semiCands: CandidatoRotulo[] = [];
            const jaCandidato = new Set<string>();

            const adicionar = (
              lista: CandidatoRotulo[],
              codigo: string,
              coord: [number, number],
              nome: string,
              opacidade: string,
            ) => {
              if (!nome || jaCandidato.has(codigo)) return;
              jaCandidato.add(codigo);
              lista.push({ codigo, coord, nome, opacidade });
            };

            // Hovered point: always a candidate, top priority, any zoom.
            if (hover) {
              const dado = info.get(hover);
              if (dado) adicionar(hoverCands, hover, dado.centro, dado.nome, "1");
            }

            // Network members: full opacity, any zoom, sorted by population so
            // the larger cities win placement when the network is dense.
            if (temSelecao) {
              const membros = [...rede]
                .map((codigo) => ({ codigo, dado: info.get(codigo) }))
                .filter((x) => x.dado)
                .sort((a, b) => b.dado!.populacao - a.dado!.populacao);
              for (const { codigo, dado } of membros) {
                adicionar(redeCands, codigo, dado!.centro, dado!.nome, "1");
              }
            }

            // Base point labels from the visible unclustered points, split by
            // tipologia so polos are placed before semi-polos; dimmed to 50%
            // under an active selection.
            if (zoom >= ROTULO_ZOOM_MIN) {
              const opacidadeBase = temSelecao ? "0.5" : "1";
              const brutos = mapa.querySourceFeatures(FONTE_POLOS, {
                filter: ["!", ["has", "point_count"]] as unknown as FilterSpecification,
              });
              const polos: { codigo: string; coord: [number, number]; nome: string; pop: number }[] = [];
              const semis: typeof polos = [];
              for (const feature of brutos) {
                const props = feature.properties ?? {};
                const codigo = props["codigo_ibge"] as string | undefined;
                const nome = props["nome"] as string | undefined;
                const tipologia = props["tipologia"] as string | undefined;
                if (!codigo || !nome || jaCandidato.has(codigo)) continue;
                const coord = (feature.geometry as GeoJSON.Point).coordinates as [
                  number,
                  number,
                ];
                const pop = info.get(codigo)?.populacao ?? 0;
                (tipologia === "semi-polo" ? semis : polos).push({ codigo, coord, nome, pop });
              }
              polos.sort((a, b) => b.pop - a.pop);
              for (const p of polos) adicionar(poloCands, p.codigo, p.coord, p.nome, opacidadeBase);
              if (zoom >= ROTULO_ZOOM_SEMIPOLO) {
                semis.sort((a, b) => b.pop - a.pop);
                for (const s of semis) adicionar(semiCands, s.codigo, s.coord, s.nome, opacidadeBase);
              }
            }

            // Greedy placement in rank order; a candidate whose box overlaps an
            // already-placed one is dropped for this frame.
            const canvas = mapa.getCanvas();
            const largura = canvas.clientWidth;
            const altura = canvas.clientHeight;
            const colocados: [number, number, number, number][] = [];
            const desejado = new Map<string, CandidatoRotulo>();

            for (const cand of [...hoverCands, ...redeCands, ...poloCands, ...semiCands]) {
              const ponto = mapa.project(cand.coord);
              if (
                ponto.x < -60 ||
                ponto.x > largura + 60 ||
                ponto.y < -30 ||
                ponto.y > altura + 30
              ) {
                continue;
              }
              const { largura: w, altura: h } = caixaRotulo(cand.nome);
              const x0 = ponto.x - w / 2;
              const y0 = ponto.y + 8;
              const caixa: [number, number, number, number] = [x0, y0, x0 + w, y0 + h];
              if (colocados.some((c) => sobrepoe(c, caixa))) continue;
              colocados.push(caixa);
              desejado.set(cand.codigo, cand);
            }

            // Reconcile markers against the placed set.
            for (const [codigo, cand] of desejado) {
              const existente = rotuloMarkersRef.current.get(codigo);
              if (existente) {
                existente.setLngLat(cand.coord);
                (existente.getElement() as HTMLDivElement).style.opacity =
                  cand.opacidade;
                continue;
              }
              const el = criarElementoRotuloPonto(cand.nome);
              el.style.opacity = cand.opacidade;
              const marcador = new maplibre.Marker({
                element: el,
                anchor: "top",
                offset: [0, 8],
              })
                .setLngLat(cand.coord)
                .addTo(mapa);
              rotuloMarkersRef.current.set(codigo, marcador);
            }
            for (const [codigo, marcador] of rotuloMarkersRef.current) {
              if (!desejado.has(codigo)) {
                marcador.remove();
                rotuloMarkersRef.current.delete(codigo);
              }
            }
          }

          // Region labels are the inverse of the city labels: visible while
          // zoomed out, hidden past ROTULO_ZOOM_MIN so they hand off cleanly to
          // the per-point city names. Toggled by display, never recreated.
          function atualizarRotulosRegiao(): void {
            const mostrar =
              mapa.getZoom() < ROTULO_ZOOM_MIN && redeAtivaRef.current.size === 0;
            for (const marcador of regiaoMarkersRef.current) {
              (marcador.getElement() as HTMLDivElement).style.display = mostrar
                ? ""
                : "none";
            }
          }

          function atualizarSobreposicoes(): void {
            atualizarBolhasCluster();
            atualizarRotulos();
            atualizarRotulosRegiao();
          }
          atualizarClustersRef.current = atualizarSobreposicoes;

          function agendarBolhasCluster(): void {
            if (clusterFrameRef.current !== null) return;
            clusterFrameRef.current = requestAnimationFrame(() => {
              clusterFrameRef.current = null;
              atualizarSobreposicoes();
            });
          }
          mapa.on("move", agendarBolhasCluster);
          mapa.on("moveend", atualizarSobreposicoes);
          mapa.on("sourcedata", (e) => {
            if (e.sourceId === FONTE_POLOS && e.isSourceLoaded) {
              atualizarSobreposicoes();
            }
          });

          // Click selects, it never navigates: routes/mapa.tsx reveals
          // PainelPolo with the summary and moves the ego-graph highlight,
          // leaving "ver perfil completo" inside the panel as the only path
          // to the full profile (docs/DECISAO_UX.md).
          mapa.on("click", CAMADA_POLOS, (e) => {
            const codigo = e.features?.[0]?.properties?.["codigo_ibge"] as
              | string
              | undefined;
            if (codigo) onSelecionarMunicipioRef.current?.(codigo);
          });
          mapa.on("mouseenter", CAMADA_POLOS, () => {
            mapa.getCanvas().style.cursor = "pointer";
          });
          // Track the hovered point so its name is revealed even when the
          // declutter pass would otherwise drop it.
          mapa.on("mousemove", CAMADA_POLOS, (e) => {
            const codigo = e.features?.[0]?.properties?.["codigo_ibge"] as
              | string
              | undefined;
            if (codigo && codigo !== hoverRef.current) {
              hoverRef.current = codigo;
              atualizarRotulos();
            }
          });
          mapa.on("mouseleave", CAMADA_POLOS, () => {
            mapa.getCanvas().style.cursor = "";
            if (hoverRef.current !== null) {
              hoverRef.current = null;
              atualizarRotulos();
            }
          });

          mapa.on("click", CAMADA_PREENCHIMENTO, (e) => {
            const codigo = e.features?.[0]?.properties?.["codigo_ibge"] as
              | string
              | undefined;
            if (codigo) onSelecionarMunicipioRef.current?.(codigo);
          });
          mapa.on("mouseenter", CAMADA_PREENCHIMENTO, () => {
            mapa.getCanvas().style.cursor = "pointer";
          });
          mapa.on("mouseleave", CAMADA_PREENCHIMENTO, () => {
            mapa.getCanvas().style.cursor = "";
          });

          prontoRef.current = true;
          // Initial pass so region labels show at the opening zoom and the
          // cluster bubbles render before the first user interaction.
          atualizarSobreposicoes();
          setCarregando(false);
          onMapaProntoRef.current?.({ mapa, malha: malhaJunta });
        });
      })
      .catch(() => {
        if (!disposed) setErro(true);
      });

    return () => {
      disposed = true;
      prontoRef.current = false;
      if (clusterFrameRef.current !== null) {
        cancelAnimationFrame(clusterFrameRef.current);
        clusterFrameRef.current = null;
      }
      for (const marcador of clusterMarkersRef.current.values()) {
        marcador.remove();
      }
      clusterMarkersRef.current.clear();
      for (const marcador of rotuloMarkersRef.current.values()) {
        marcador.remove();
      }
      rotuloMarkersRef.current.clear();
      for (const marcador of regiaoMarkersRef.current) {
        marcador.remove();
      }
      regiaoMarkersRef.current = [];
      atualizarClustersRef.current = null;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
    // Mounted once: the mesh and municipios load a single time and the GL
    // context is never recreated on filter or selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combined filter applied to the GL layer, not to the loaded data: tipologia
  // chips toggle a native maplibre filter (docs/DASHBOARD.md 5.1 e 5.4,
  // "tipologia como filtro, nao como marca"), and the later refinement (UF, faixa
  // de IDM, porte) reuses the same in-memory predicate as every other screen
  // (lib/data filtrarMunicipios) instead of duplicating the criteria as a
  // second maplibre expression. When nothing is filtered out, the layer
  // filter is cleared instead of listing every codigo_ibge.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !prontoRef.current) return;
    const universo = municipiosRef.current;
    const visiveis = filtrarMunicipios(universo, filtros);
    const filtro: FilterSpecification | null =
      visiveis.length === universo.length
        ? null
        : ([
            "in",
            ["get", "codigo_ibge"],
            ["literal", visiveis.map((m) => m.codigo_ibge)],
          ] as unknown as FilterSpecification);
    mapa.setFilter(CAMADA_PREENCHIMENTO, filtro);
    mapa.setFilter(CAMADA_CONTORNO, filtro);

    // The polo/semi-polo source is clustered (supercluster runs inside the
    // GL source itself), so a layer filter cannot narrow it the way it does
    // for the choropleth: an "in" filter would only hide rendered points or
    // bubbles while point_count kept summing the filtered-out municipios,
    // showing a stale count. The source data is rebuilt instead, from the
    // same codigo_ibge allow-list used above, so supercluster reclusters
    // over exactly the visible subset and every bubble count stays correct.
    const codigosVisiveis = new Set(visiveis.map((m) => m.codigo_ibge));
    const fontePolos = mapa.getSource(FONTE_POLOS) as GeoJSONSource | undefined;
    fontePolos?.setData({
      type: "FeatureCollection",
      features: pontosPolosBaseRef.current.features.filter((feature) =>
        codigosVisiveis.has(feature.properties.codigo_ibge),
      ),
    } as unknown as GeoJSON.GeoJSON);
    // Refresh bubbles immediately for visual continuity; the "sourcedata"
    // listener registered at load also reconciles once supercluster finishes
    // reclustering the new data (setData itself is async under the hood).
    atualizarClustersRef.current?.();
  }, [filtros, carregando]);

  // Selection highlight follows the busca/clique selection tracked by
  // routes/mapa.tsx. Besides outlining the selected fill, it resolves the
  // city's network (itself, its polo, and the orbitantes pointing to it, the
  // same nodes EgoGraphOrbita links) so the label pass can name those cities
  // and dim the rest.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !prontoRef.current) return;
    mapa.setFilter(CAMADA_SELECAO, [
      "==",
      ["get", "codigo_ibge"],
      municipioSelecionado ?? "",
    ] as unknown as FilterSpecification);

    const rede = new Set<string>();
    if (municipioSelecionado) {
      rede.add(municipioSelecionado);
      const selecionado = municipiosRef.current.find(
        (m) => m.codigo_ibge === municipioSelecionado,
      );
      if (selecionado?.polo_ibge) rede.add(selecionado.polo_ibge);
      for (const l of ligacoes) {
        if (l.destino_ibge === municipioSelecionado) rede.add(l.origem_ibge);
      }
    }
    redeAtivaRef.current = rede;

    // Spotlight: on selection the choropleth of every non-member fades so the
    // orbit stays lit in its IDM colors and reads as a coherent territory,
    // without a hull geometry or a second color channel. Cleared back to the
    // flat fill opacity on deselect.
    const membros = [...rede];
    mapa.setPaintProperty(
      CAMADA_PREENCHIMENTO,
      "fill-opacity",
      membros.length > 0
        ? ([
            "case",
            ["in", ["get", "codigo_ibge"], ["literal", membros]],
            0.9,
            0.12,
          ] as unknown as number)
        : 0.78,
    );

    atualizarClustersRef.current?.();
  }, [municipioSelecionado, ligacoes, carregando]);

  // Cluster overlay filters (cenarios): outline the grouping and its addable
  // frontier over the choropleth. No-op on the plain map, where both props are
  // undefined and the layers stay empty.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !prontoRef.current) return;
    mapa.setFilter(CAMADA_CLUSTER, [
      "in", ["get", "codigo_ibge"], ["literal", selecaoCluster ?? []],
    ] as unknown as FilterSpecification);
    mapa.setFilter(CAMADA_FRONTEIRA, [
      "in", ["get", "codigo_ibge"], ["literal", fronteiraCluster ?? []],
    ] as unknown as FilterSpecification);
    // Simulated fill: paint each listed municipality its simulated color via a
    // match expression, or clear the layer.
    const codigos = simuladoPorCodigo ? Object.keys(simuladoPorCodigo) : [];
    mapa.setFilter(CAMADA_CLUSTER_FILL, [
      "in", ["get", "codigo_ibge"], ["literal", codigos],
    ] as unknown as FilterSpecification);
    if (codigos.length > 0 && simuladoPorCodigo) {
      const match: unknown[] = ["match", ["get", "codigo_ibge"]];
      for (const [c, cor] of Object.entries(simuladoPorCodigo)) match.push(c, cor);
      match.push(lerToken("--idm-100")); // fallback, never hit under the filter
      mapa.setPaintProperty(CAMADA_CLUSTER_FILL, "fill-color", match as never);
    }
  }, [selecaoCluster, fronteiraCluster, simuladoPorCodigo, carregando]);

  // Theme reactivity: paint colors are resolved tokens, re-read and reapplied
  // when data-theme flips on the root (ThemeToggle owns that attribute). The
  // cluster bubbles need no entry here: they are plain DOM elements styled
  // with var(--accent)/var(--on-accent)/var(--surface-1) (see
  // criarElementoBolhaCluster), so the CSS cascade recolors them the instant
  // data-theme changes, the same way any other HTML element on the page does.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const mapa = mapaRef.current;
      if (!mapa || !prontoRef.current) return;
      mapa.setPaintProperty("bg", "background-color", lerToken("--surface-page"));
      mapa.setPaintProperty(CAMADA_MUNDO_FILL, "fill-color", lerToken("--baseline"));
      mapa.setPaintProperty(CAMADA_MUNDO_LINHA, "line-color", lerToken("--border"));
      mapa.setPaintProperty(CAMADA_CONTORNO, "line-color", lerToken("--border"));
      mapa.setPaintProperty(CAMADA_SELECAO, "line-color", lerToken("--accent"));
      mapa.setPaintProperty(
        CAMADA_PREENCHIMENTO,
        "fill-color",
        expressaoPreenchimento(),
      );
      mapa.setPaintProperty(CAMADA_POLOS, "circle-color", lerToken("--accent"));
      mapa.setPaintProperty(
        CAMADA_POLOS,
        "circle-stroke-color",
        lerToken("--surface-1"),
      );
      mapa.setPaintProperty(CAMADA_REGIOES, "line-color", lerToken("--ink-muted"));
      mapa.setPaintProperty(
        CAMADA_CAPITAIS,
        "line-color",
        lerToken("--ink-primary"),
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  if (semWebgl) {
    return (
      <EstadoVazio
        titulo="O mapa precisa de WebGL"
        mensagem="Este navegador está sem WebGL, exigido pelo mapa. No Chrome, ative Configurações, Sistema, Usar aceleração de hardware quando disponível, e reinicie; ou confira chrome://gpu. As demais telas funcionam sem WebGL."
      />
    );
  }

  if (erro) {
    return (
      <EstadoVazio
        titulo="Não foi possível carregar o mapa"
        mensagem="A malha municipal ou o índice não puderam ser carregados neste ambiente."
      />
    );
  }

  const legendaSelecao = municipioSelecionado
    ? `, selecionado ${municipioSelecionado}`
    : "";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {carregando && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: "var(--surface-1)",
          }}
        >
          <EstadoCarregando rotulo="Carregando o mapa" linhas={1} />
        </div>
      )}
      <div
        ref={container}
        role="application"
        aria-label={`Mapa de órbitas do IDM, coroplético colorido pelo índice de dependência municipal; polos e semi-polos marcados por ponto de acento, agrupados em bolhas com contagem quando o zoom está baixo e rotulados com o nome da cidade quando o zoom aproxima os pontos; clique um ponto para ver o resumo no painel lateral, ou uma bolha para aproximar e separar o grupo${legendaSelecao}`}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "320px",
          background: "var(--surface-1)",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
