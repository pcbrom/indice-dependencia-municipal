import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EstadoVazioProps {
  titulo?: string;
  mensagem: string;
  acao?: ReactNode;
}

// Reused empty state. Plain language, no jargon; a clear next step when there
// is one. Shared by every data component when a filter yields no result.
export function EstadoVazio({ titulo, mensagem, acao }: EstadoVazioProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        padding: "var(--space-7) var(--space-4)",
        color: "var(--ink-secondary)",
        textAlign: "center",
      }}
    >
      <Inbox size={32} aria-hidden />
      {titulo ? (
        <p style={{ fontSize: "var(--text-lg)", color: "var(--ink-primary)" }}>
          {titulo}
        </p>
      ) : null}
      <p style={{ maxWidth: "40ch" }}>{mensagem}</p>
      {acao}
    </div>
  );
}
