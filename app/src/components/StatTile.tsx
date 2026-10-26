import * as Popover from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";

export interface StatTileProps {
  rotuloComum: string; // the plain-language phrase, shown first
  valor: string; // already formatted for display
  termoTecnico?: string; // the technical term, tucked under a "?" control
  unidade?: string;
}

// One line. The plain phrase comes first; the technical term is folded into a
// "?" control that opens on tap, not on hover (mobile-honest disclosure).
export function StatTile({
  rotuloComum,
  valor,
  termoTecnico,
  unidade,
}: StatTileProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "var(--space-3) 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          fontSize: "var(--text-body)",
          color: "var(--ink-secondary)",
        }}
      >
        {rotuloComum}
        {termoTecnico ? (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={`Definição: ${rotuloComum}`}
                style={{
                  display: "inline-flex",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "var(--ink-muted)",
                }}
              >
                <HelpCircle size={14} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={6}
                style={{
                  maxWidth: "min(90vw, 280px)",
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--surface-1)",
                  color: "var(--ink-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  boxShadow: "var(--shadow-floating)",
                  fontSize: "var(--text-body)",
                }}
              >
                {termoTecnico}
                <Popover.Arrow style={{ fill: "var(--surface-1)" }} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
      </span>
      <span
        className="tabular"
        style={{ fontSize: "var(--text-base)", color: "var(--ink-primary)" }}
      >
        {valor}
        {unidade ? (
          <span
            style={{
              marginLeft: "var(--space-1)",
              fontSize: "var(--text-caption)",
              color: "var(--ink-muted)",
            }}
          >
            {unidade}
          </span>
        ) : null}
      </span>
    </div>
  );
}
