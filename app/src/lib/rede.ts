// Dependency network of a municipality, derived from the REGIC links: the tree
// of everyone who depends on it (directly or transitively) and the chain up to
// the top of the urban hierarchy. No new source: the tree is built from
// ligacoes.json (origem depends on destino) and the chain from Municipio.polo_ibge.
import type { Ligacao, Municipio } from "./types";

export interface NoRede {
  codigo: string;
  nome: string;
  uf: string;
  idm: number;
  tipologia: Municipio["tipologia"];
  // Cities that depend on this node (origem -> destino == this node). A tree,
  // not a graph: a municipality reached through one parent is not repeated
  // under another, so the dendrogram layout is well defined.
  filhos: NoRede[];
  // Transitive count of descendants, for labels and the collapsed "+N" badge.
  totalDescendentes: number;
}

// Index the links as destino -> [origens]: the children of each node in the
// dependency tree are the municipalities that orbit it.
export function indexarFilhos(ligacoes: Ligacao[]): Map<string, string[]> {
  const porDestino = new Map<string, string[]>();
  for (const l of ligacoes) {
    if (l.origem_ibge === l.destino_ibge) continue;
    const lista = porDestino.get(l.destino_ibge);
    if (lista) lista.push(l.origem_ibge);
    else porDestino.set(l.destino_ibge, [l.origem_ibge]);
  }
  return porDestino;
}

// Build the dependency tree rooted at `codigo`. A shared visited set makes the
// result a tree (first parent wins) and guards against cycles, so construction
// is bounded by the number of municipalities. Children are ordered by subtree
// size then name, so the heaviest branches read first.
export function construirArvore(
  codigo: string,
  porCodigo: Map<string, Municipio>,
  filhosPorDestino: Map<string, string[]>,
  visitados: Set<string> = new Set(),
): NoRede | null {
  const m = porCodigo.get(codigo);
  if (!m) return null;
  visitados.add(codigo);

  const filhos: NoRede[] = [];
  for (const codigoFilho of filhosPorDestino.get(codigo) ?? []) {
    if (visitados.has(codigoFilho)) continue;
    const sub = construirArvore(codigoFilho, porCodigo, filhosPorDestino, visitados);
    if (sub) filhos.push(sub);
  }
  filhos.sort(
    (a, b) =>
      b.totalDescendentes - a.totalDescendentes ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );

  const totalDescendentes = filhos.reduce(
    (soma, f) => soma + 1 + f.totalDescendentes,
    0,
  );
  return {
    codigo,
    nome: m.nome,
    uf: m.uf,
    idm: m.idm,
    tipologia: m.tipologia,
    filhos,
    totalDescendentes,
  };
}

// Chain from a municipality's immediate polo up to the top of the hierarchy,
// following polo_ibge. Cycle-guarded. Returned bottom-up (immediate polo first).
export function cadeiaAscendente(
  codigo: string,
  porCodigo: Map<string, Municipio>,
): Municipio[] {
  const cadeia: Municipio[] = [];
  const visitados = new Set<string>([codigo]);
  let atual = porCodigo.get(codigo);
  while (atual?.polo_ibge && !visitados.has(atual.polo_ibge)) {
    const polo = porCodigo.get(atual.polo_ibge);
    if (!polo) break;
    visitados.add(polo.codigo_ibge);
    cadeia.push(polo);
    atual = polo;
  }
  return cadeia;
}

/**
 * Label for the destination pole of a municipality.
 *
 * A municipality may point at a pole that is not in the loaded list, because
 * the pole was dropped from the index universe for lack of valid fiscal data;
 * Brasilia is the largest such case. In that situation the name still comes
 * from the record itself, carried by the pipeline. Only a municipality with no
 * destination at all is described as orbiting itself.
 */
export function rotuloPolo(
  m: { polo_ibge: string | null; polo_nome: string | null; polo_uf: string | null },
  polo?: { nome: string; uf: string },
): string {
  if (polo) return `${polo.nome} (${polo.uf})`;
  if (m.polo_ibge && m.polo_nome) {
    return m.polo_uf ? `${m.polo_nome} (${m.polo_uf})` : m.polo_nome;
  }
  return "a própria cidade";
}
