interface EstadoCarregandoProps {
  // Number of skeleton rows to render while data resolves.
  linhas?: number;
  rotulo?: string;
}

// Reused loading state. A skeleton, not a spinner, so the layout does not jump
// when data arrives. Shared by every data component.
export function EstadoCarregando({
  linhas = 3,
  rotulo = "Carregando dados",
}: EstadoCarregandoProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={rotulo}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
      }}
    >
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          style={{
            height: "var(--space-5)",
            width: `${90 - i * 8}%`,
            background: "var(--gridline)",
            borderRadius: "var(--radius-control)",
          }}
        />
      ))}
      <span className="visually-hidden">{rotulo}</span>
    </div>
  );
}
