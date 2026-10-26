import { useEffect, useId, useMemo } from "react";
import type {
  AddLayerObject,
  FilterSpecification,
  GeoJSONSource,
  Map as MaplibreMap,
} from "maplibre-gl";
import type { MalhaGeoJSON } from "../lib/data";
import type { Ligacao, Municipio } from "../lib/types";

type ModoOrbita = "saida" | "entrada" | "ambos";

interface EgoGraphOrbitaProps {
  municipio: string; // codigo_ibge of the selected municipality
  ligacoes: Ligacao[];
  modo: ModoOrbita;
  // Map-mode wiring (Tela 1, routes/mapa.tsx): when present, the ego-graph is
  // drawn as a maplibre line layer on the shared map instead of the summary
  // panel. Tela 2 (perfil, routes/municipio.tsx) never passes these and keeps
  // rendering the panel below, unchanged.
  mapa?: MaplibreMap | null;
  malha?: MalhaGeoJSON | null;
  municipios?: Municipio[];
}

const FONTE_EGO = "ego-orbita";
const FONTE_SETAS = "ego-orbita-setas";
const CAMADA_EGO = "ego-orbita-linha";
const CAMADA_EGO_GRUPO = "ego-orbita-grupo";
const CAMADA_SETAS = "ego-orbita-setas-camada";
const CAMADA_EGO_SAIDA = "ego-orbita-linha-saida";
const IMG_SETA = "ego-orbita-seta";
const IMG_SETA_SAIDA = "ego-orbita-seta-saida";

// Incoming edges (who depends on this city) use the accent; the outgoing edge
// (the polo this city depends on) uses the primary ink, which contrasts with
// every step of the IDM ramp and differs from the accent in luminance, so the
// two directions stay apart for color-blind readers too.
const TOKEN_ENTRADA = "--accent";
const TOKEN_SAIDA = "--ink-primary";

// Compass bearing origem->destino in degrees (0 = north, clockwise). Matches
// MapLibre's icon-rotate with icon-rotation-alignment "map" (the map is
// north-up), so the arrow points from the dependent city to the one it depends
// on and stays correct on pan and zoom.
function rumo(o: [number, number], d: [number, number]): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const f1 = rad(o[1]);
  const f2 = rad(d[1]);
  const dl = rad(d[0] - o[0]);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function pontoMedio(
  o: [number, number],
  d: [number, number],
): [number, number] {
  return [(o[0] + d[0]) / 2, (o[1] + d[1]) / 2];
}

// Arrowhead pointing north, filled with the accent token and outlined with the
// surface token so it stays legible over any step of the IDM ramp. Drawn on a
// canvas (no sprite server, CSP-safe) and re-tinted on a theme flip via
// updateImage. Returned at 2x for a crisp icon.
function imagemSeta(cor: string, traco: string): ImageData {
  const s = 28;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(s, s);
  ctx.beginPath();
  ctx.moveTo(s / 2, 3);
  ctx.lineTo(s - 5, s - 6);
  ctx.lineTo(s / 2, s - 11);
  ctx.lineTo(5, s - 6);
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = traco;
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

function lerToken(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

// True while the shared map is still usable. MapaOrbitas owns the map and
// removes it on a route change; a teardown path here (effect cleanup or the
// theme observer) can run just after that, when getSource/getLayer would throw
// because the removed map's style is gone. maplibre sets _removed on remove()
// and drops style, so both are checked before any map API call.
function mapaEstaVivo(mapa: MaplibreMap): boolean {
  const m = mapa as unknown as { _removed?: boolean; style?: unknown };
  return !m._removed && m.style != null;
}

// Approximate centroid: the plain mean of the exterior ring vertices. This is
// adequate for a line endpoint on a national-scale map; it is not an
// area-weighted geometric centroid and should not be used for measurement.
// Exported so MapaOrbitas can place the polo/semi-polo point layer at the
// same centroid this ego-graph uses for its line endpoints, without
// duplicating the polygon-to-point math in two files.
export function centroideAproximado(geometry: unknown): [number, number] | null {
  const anel = anelExterno(geometry);
  if (!anel || anel.length === 0) return null;
  let somaX = 0;
  let somaY = 0;
  let n = 0;
  for (const ponto of anel) {
    const x = ponto[0];
    const y = ponto[1];
    if (typeof x !== "number" || typeof y !== "number") continue;
    somaX += x;
    somaY += y;
    n += 1;
  }
  return n > 0 ? [somaX / n, somaY / n] : null;
}

function anelExterno(geometry: unknown): number[][] | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === "Polygon") {
    const coords = g.coordinates as number[][][] | undefined;
    return coords?.[0] ?? null;
  }
  if (g.type === "MultiPolygon") {
    // First polygon's exterior ring is enough for a single line endpoint.
    const coords = g.coordinates as number[][][][] | undefined;
    return coords?.[0]?.[0] ?? null;
  }
  return null;
}

// Ego-graph of the selected municipio's orbit: one outgoing line to its polo
// (docs/DASHBOARD.md 5.4, "para onde a vida vai") and, when the municipio is
// itself a polo, the incoming lines of its dependents ("quem depende de
// mim"). This layer spatializes service displacement only; money never
// becomes an arrow on the map (docs/DECISAO_CAUSAL.md, salvaguarda visual).
// Value labels (distance, count) belong to the municipio's side panel
// (Tela 2), never printed over every line on the national map.
export function EgoGraphOrbita({
  municipio,
  ligacoes,
  modo,
  mapa,
  malha,
  municipios,
}: EgoGraphOrbitaProps) {
  const descricaoId = useId();

  const mostraSaida = modo === "saida" || modo === "ambos";
  const mostraEntrada = modo === "entrada" || modo === "ambos";

  const saidas = useMemo(
    () => ligacoes.filter((l) => l.origem_ibge === municipio),
    [ligacoes, municipio],
  );
  const entradas = useMemo(
    () => ligacoes.filter((l) => l.destino_ibge === municipio),
    [ligacoes, municipio],
  );

  const municipioAtual = useMemo(
    () => municipios?.find((m) => m.codigo_ibge === municipio),
    [municipios, municipio],
  );

  // Centroids are recomputed only when the mesh reference changes (loaded
  // once by MapaOrbitas), not on every selection change.
  const centroides = useMemo(() => {
    const resultado = new Map<string, [number, number]>();
    if (!malha) return resultado;
    for (const feature of malha.features) {
      const codigo = feature.properties.codigo_ibge;
      if (!codigo || resultado.has(codigo)) continue;
      const centro = centroideAproximado(feature.geometry);
      if (centro) resultado.set(codigo, centro);
    }
    return resultado;
  }, [malha]);

  useEffect(() => {
    if (!mapa || !mapaEstaVivo(mapa)) return;

    const origem = centroides.get(municipio);
    const linhas: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const setas: GeoJSON.Feature<GeoJSON.Point>[] = [];

    // The grouping: the selected city, its polo, and its orbitantes. The direct
    // dependency edges (drawn solid, with a direction arrow) are the star from
    // and to the selected city; every other REGIC link among group members is
    // the group's own interdependence (drawn dashed).
    const grupo = new Set<string>([municipio]);
    if (municipioAtual?.polo_ibge) grupo.add(municipioAtual.polo_ibge);
    for (const l of entradas) grupo.add(l.origem_ibge);

    const diretas = new Set<string>();
    const adicionarDireta = (
      a: string,
      ca: [number, number] | undefined,
      b: string,
      cb: [number, number] | undefined,
      classe: "direta" | "saida" = "direta",
    ) => {
      if (!ca || !cb) return;
      diretas.add(`${a}|${b}`);
      linhas.push({
        type: "Feature",
        properties: { classe },
        geometry: { type: "LineString", coordinates: [ca, cb] },
      });
      setas.push({
        type: "Feature",
        properties: { rumo: rumo(ca, cb), seta: classe === "saida" ? IMG_SETA_SAIDA : IMG_SETA },
        geometry: { type: "Point", coordinates: pontoMedio(ca, cb) },
      });
    };

    // Outgoing edge, municipio -> its own polo (Municipio.polo_ibge). The arrow
    // points from the dependent city to the polo it depends on.
    if (mostraSaida && municipioAtual?.polo_ibge) {
      adicionarDireta(
        municipio,
        origem,
        municipioAtual.polo_ibge,
        centroides.get(municipioAtual.polo_ibge),
        "saida",
      );
    }

    // Incoming edges, orbitantes -> this municipio, each arrow pointing at the
    // depended-upon city.
    if (mostraEntrada) {
      for (const l of entradas) {
        adicionarDireta(
          l.origem_ibge,
          centroides.get(l.origem_ibge),
          municipio,
          origem,
        );
      }
    }

    // Group interdependence: any REGIC link with both ends inside the group
    // that is not one of the direct edges already drawn (e.g. an orbitante of
    // this city that also links to its polo).
    for (const l of ligacoes) {
      if (l.origem_ibge === l.destino_ibge) continue;
      if (!grupo.has(l.origem_ibge) || !grupo.has(l.destino_ibge)) continue;
      if (diretas.has(`${l.origem_ibge}|${l.destino_ibge}`)) continue;
      const ca = centroides.get(l.origem_ibge);
      const cb = centroides.get(l.destino_ibge);
      if (!ca || !cb) continue;
      linhas.push({
        type: "Feature",
        properties: { classe: "grupo" },
        geometry: { type: "LineString", coordinates: [ca, cb] },
      });
    }

    const dadosLinhas = { type: "FeatureCollection", features: linhas };
    const dadosSetas = { type: "FeatureCollection", features: setas };

    if (!mapa.hasImage(IMG_SETA)) {
      mapa.addImage(
        IMG_SETA,
        imagemSeta(lerToken(TOKEN_ENTRADA), lerToken("--surface-1")),
        { pixelRatio: 2 },
      );
    }
    if (!mapa.hasImage(IMG_SETA_SAIDA)) {
      mapa.addImage(
        IMG_SETA_SAIDA,
        imagemSeta(lerToken(TOKEN_SAIDA), lerToken("--surface-1")),
        { pixelRatio: 2 },
      );
    }

    const fonteLinhas = mapa.getSource(FONTE_EGO) as GeoJSONSource | undefined;
    if (fonteLinhas) {
      fonteLinhas.setData(dadosLinhas as unknown as GeoJSON.GeoJSON);
    } else {
      mapa.addSource(FONTE_EGO, {
        type: "geojson",
        data: dadosLinhas as unknown as GeoJSON.GeoJSON,
      });
      // Group interdependence first (dashed, faint), then the direct edges
      // (solid, prominent) on top so the dependency relationship reads clearly.
      mapa.addLayer({
        id: CAMADA_EGO_GRUPO,
        type: "line",
        source: FONTE_EGO,
        filter: ["==", ["get", "classe"], "grupo"] as unknown as FilterSpecification,
        paint: {
          "line-color": lerToken("--accent"),
          "line-width": 1,
          "line-opacity": 0.35,
          "line-dasharray": [2, 2],
        },
      } as unknown as AddLayerObject);
      mapa.addLayer({
        id: CAMADA_EGO,
        type: "line",
        source: FONTE_EGO,
        filter: ["==", ["get", "classe"], "direta"] as unknown as FilterSpecification,
        paint: {
          "line-color": lerToken(TOKEN_ENTRADA),
          "line-width": 2,
          "line-opacity": 0.75,
        },
      } as unknown as AddLayerObject);
      mapa.addLayer({
        id: CAMADA_EGO_SAIDA,
        type: "line",
        source: FONTE_EGO,
        filter: ["==", ["get", "classe"], "saida"] as unknown as FilterSpecification,
        paint: {
          "line-color": lerToken(TOKEN_SAIDA),
          "line-width": 2.5,
          "line-opacity": 0.85,
        },
      } as unknown as AddLayerObject);
    }

    const fonteSetas = mapa.getSource(FONTE_SETAS) as GeoJSONSource | undefined;
    if (fonteSetas) {
      fonteSetas.setData(dadosSetas as unknown as GeoJSON.GeoJSON);
    } else {
      mapa.addSource(FONTE_SETAS, {
        type: "geojson",
        data: dadosSetas as unknown as GeoJSON.GeoJSON,
      });
      mapa.addLayer({
        id: CAMADA_SETAS,
        type: "symbol",
        source: FONTE_SETAS,
        layout: {
          "icon-image": ["get", "seta"],
          "icon-size": 1.3,
          "icon-rotate": ["get", "rumo"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      } as unknown as AddLayerObject);
    }

    return () => {
      // Clear both sources on unmount or on a new selection; the layers stay
      // attached (removed only when the map tears down), avoiding churn. Skip
      // when the map was already removed by MapaOrbitas on a route change,
      // where getSource would throw on the gone style.
      if (!mapaEstaVivo(mapa)) return;
      const fl = mapa.getSource(FONTE_EGO) as GeoJSONSource | undefined;
      if (fl) fl.setData({ type: "FeatureCollection", features: [] } as unknown as GeoJSON.GeoJSON);
      const fs = mapa.getSource(FONTE_SETAS) as GeoJSONSource | undefined;
      if (fs) fs.setData({ type: "FeatureCollection", features: [] } as unknown as GeoJSON.GeoJSON);
    };
  }, [mapa, centroides, municipio, municipioAtual, mostraSaida, mostraEntrada, entradas, ligacoes]);

  // Theme reactivity for the ego-graph's own layer: MapaOrbitas owns a
  // MutationObserver that re-reads tokens for the choropleth layers it
  // creates (fill, contorno, selecao), but it has no knowledge of the
  // ego-orbita line layer, which this component adds on the same GL context.
  // Without this observer the dashed line kept the accent color captured at
  // mount time and went stale (wrong hue, sometimes low-contrast) after a
  // theme flip.
  useEffect(() => {
    if (!mapa) return;
    const observer = new MutationObserver(() => {
      if (!mapaEstaVivo(mapa)) return;
      const cor = lerToken(TOKEN_ENTRADA);
      const corSaida = lerToken(TOKEN_SAIDA);
      const contorno = lerToken("--surface-1");
      if (mapa.getLayer(CAMADA_EGO)) {
        mapa.setPaintProperty(CAMADA_EGO, "line-color", cor);
      }
      if (mapa.getLayer(CAMADA_EGO_GRUPO)) {
        mapa.setPaintProperty(CAMADA_EGO_GRUPO, "line-color", cor);
      }
      if (mapa.getLayer(CAMADA_EGO_SAIDA)) {
        mapa.setPaintProperty(CAMADA_EGO_SAIDA, "line-color", corSaida);
      }
      if (mapa.hasImage(IMG_SETA)) {
        mapa.updateImage(IMG_SETA, imagemSeta(cor, contorno));
      }
      if (mapa.hasImage(IMG_SETA_SAIDA)) {
        mapa.updateImage(IMG_SETA_SAIDA, imagemSeta(corSaida, contorno));
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [mapa]);

  if (mapa) {
    // Map mode: no value label sits on the line itself. A single aria-live
    // summary keeps the interaction accessible without printing a number
    // over every line on the national map.
    const partes: string[] = [];
    if (mostraSaida && municipioAtual?.polo_ibge) {
      partes.push("linha até o polo de destino desenhada no mapa");
    }
    if (mostraEntrada) {
      partes.push(`${entradas.length} orbitante(s) apontam para este município no mapa`);
    }
    return (
      <p id={descricaoId} className="visually-hidden" aria-live="polite">
        {partes.join("; ")}
      </p>
    );
  }

  // Panel mode (Tela 2, routes/municipio.tsx): unchanged summary of the links.
  return (
    <div
      aria-label="Grafo de órbita do município"
      style={{
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        color: "var(--ink-secondary)",
        fontSize: "var(--text-body)",
      }}
    >
      {mostraSaida && (
        <p>
          para onde a vida vai: {saidas.length} ligação(ões) de saída ao polo
        </p>
      )}
      {mostraEntrada && (
        <p>quem depende de mim: {entradas.length} orbitante(s) de entrada</p>
      )}
    </div>
  );
}
