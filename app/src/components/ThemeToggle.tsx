import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Tema = "light" | "dark";

function lerTema(): Tema {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

// Reads and writes data-theme on the root. Both themes are designed; this only
// switches the active token set. Persists the choice for the next visit.
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() =>
    typeof document === "undefined" ? "light" : lerTema(),
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    try {
      localStorage.setItem("idm-theme", tema);
    } catch {
      // storage unavailable; the in-memory choice still applies for the session
    }
  }, [tema]);

  const proximo: Tema = tema === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTema(proximo)}
      aria-label={`Ativar tema ${proximo === "dark" ? "escuro" : "claro"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "var(--space-6)",
        height: "var(--space-6)",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
        color: "var(--ink-primary)",
      }}
    >
      {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
