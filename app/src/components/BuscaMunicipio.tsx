import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buscarMunicipios, carregarMunicipios } from "../lib/data";
import type { Municipio } from "../lib/types";

interface BuscaMunicipioProps {
  onSelect: (codigoIbge: string) => void;
}

// First element on mobile. Autocomplete by name, tolerant to accent and
// spelling, resolving to codigo_ibge before any filter runs. Selecting a result
// navigates to the profile. States: empty, loading, no result, list.
export function BuscaMunicipio({ onSelect }: BuscaMunicipioProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Municipio[]>([]);
  const [carregando, setCarregando] = useState(false);
  const universo = useRef<Municipio[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setCarregando(true);
    // Lazy-load the national list once, then filter in memory on every keystroke.
    const lista = universo.current
      ? Promise.resolve(universo.current)
      : carregarMunicipios();
    lista
      .then((todos) => {
        universo.current = todos;
        if (cancelado) return;
        setResultados(buscarMunicipios(q, todos));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [query]);

  const semResultado = query.trim().length >= 2 && !carregando && resultados.length === 0;

  return (
    <div style={{ position: "relative" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
        }}
      >
        <Search size={18} aria-hidden style={{ color: "var(--ink-muted)" }} />
        <input
          id="busca-municipio"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Encontre sua cidade"
          aria-label="Encontre sua cidade"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--ink-primary)",
            fontSize: "var(--text-base)",
          }}
        />
      </label>

      {(resultados.length > 0 || carregando || semResultado) && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            insetInline: 0,
            marginTop: "var(--space-1)",
            listStyle: "none",
            padding: "var(--space-1)",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-floating)",
            zIndex: 20,
            maxHeight: "40vh",
            overflowY: "auto",
          }}
        >
          {carregando && (
            <li style={{ padding: "var(--space-2)", color: "var(--ink-muted)" }}>
              Buscando...
            </li>
          )}
          {semResultado && (
            <li style={{ padding: "var(--space-2)", color: "var(--ink-muted)" }}>
              Nenhuma cidade encontrada
            </li>
          )}
          {resultados.map((m) => (
            <li key={m.codigo_ibge} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => onSelect(m.codigo_ibge)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "var(--space-2) var(--space-3)",
                  background: "transparent",
                  border: "none",
                  borderRadius: "var(--radius-control)",
                  color: "var(--ink-primary)",
                  fontSize: "var(--text-body)",
                }}
              >
                {m.nome}{" "}
                <span style={{ color: "var(--ink-muted)" }}>({m.uf})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
