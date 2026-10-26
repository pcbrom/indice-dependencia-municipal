interface SeloFonteProps {
  fonte: string;
  dataExtracao: string; // ISO 8601, read from the manifest
}

// The source-plus-date pair, read from the manifest, shown beside each figure
// or group, so every number on screen traces back to a dated source.
export function SeloFonte({ fonte, dataExtracao }: SeloFonteProps) {
  const data = formatarData(dataExtracao);
  return (
    <p
      style={{
        fontSize: "var(--text-caption)",
        color: "var(--ink-muted)",
        margin: 0,
      }}
    >
      fonte: {fonte}
      {data ? ` (extraído em ${data})` : ""}
    </p>
  );
}

function formatarData(iso: string): string {
  // Parse the date parts directly: `new Date("2026-07-03")` is UTC midnight and
  // shifts back a day when formatted in a negative-offset locale (BRT).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
