import type { Tipologia } from "../lib/types";

interface BadgeTipologiaProps {
  tipologia: Tipologia;
}

// Three fixed visual states; the textual label always sits beside the mark, so
// identity is never carried by color alone (accessibility requirement).
const rotulo: Record<Tipologia, string> = {
  polo: "Polo",
  "semi-polo": "Semi-polo",
  orbitante: "Orbitante",
};

// Node size, not hue, differentiates the class on the map. The dot must not
// reuse the IDM sequential ramp: that channel encodes the index value, and
// tinting the badge with it would collide with the map's single color channel.
// A neutral ink tone is used; identity is carried by the textual label.
const DOT_NEUTRAL = "var(--ink-muted)";

export function BadgeTipologia({ tipologia }: BadgeTipologiaProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-1) var(--space-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-caption)",
        color: "var(--ink-secondary)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "var(--space-2)",
          height: "var(--space-2)",
          borderRadius: "var(--radius-full)",
          background: DOT_NEUTRAL,
        }}
      />
      {rotulo[tipologia]}
    </span>
  );
}
