import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

// Standard floating layer for map, scatter and table. The touch target is
// larger than the mark; content is a designed floating surface, not a bare div.
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={8}
            style={{
              maxWidth: "min(90vw, 320px)",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--surface-1)",
              color: "var(--ink-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shadow-floating)",
              fontSize: "var(--text-body)",
              lineHeight: "var(--leading-body)",
            }}
          >
            {content}
            <RadixTooltip.Arrow style={{ fill: "var(--surface-1)" }} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
