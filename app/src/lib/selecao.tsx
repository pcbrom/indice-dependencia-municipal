import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Focused city, shared across every screen so a selection survives navigation
// between tabs (the map, the profile, the fiscal axis, the ranking, the
// network). Persisted in sessionStorage so it also survives a reload, and
// cleared globally by Escape or the "limpar" control in the nav.
interface Selecao {
  codigo: string | null;
  selecionar: (codigo: string | null) => void;
  limpar: () => void;
}

const Ctx = createContext<Selecao | null>(null);
const CHAVE = "idm.cidadeFoco";

function lerInicial(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function gravar(codigo: string | null): void {
  try {
    if (codigo) sessionStorage.setItem(CHAVE, codigo);
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // storage unavailable (private mode, disabled): keep the in-memory value.
  }
}

export function SelecaoProvider({ children }: { children: ReactNode }) {
  const [codigo, setCodigo] = useState<string | null>(lerInicial);

  const selecionar = useCallback((c: string | null) => {
    setCodigo(c);
    gravar(c);
  }, []);
  const limpar = useCallback(() => selecionar(null), [selecionar]);

  // Global Escape clears the focused city, except while typing in a field or
  // when nothing is focused.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const alvo = e.target as HTMLElement | null;
      const tag = alvo?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        alvo?.isContentEditable
      ) {
        return;
      }
      setCodigo((atual) => {
        if (atual === null) return atual;
        gravar(null);
        return null;
      });
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const valor = useMemo(
    () => ({ codigo, selecionar, limpar }),
    [codigo, selecionar, limpar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSelecao(): Selecao {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelecao deve ficar dentro de SelecaoProvider");
  return ctx;
}
