import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { BarChart3, Table } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type Vista = "grafico" | "tabela";

interface AlternaGraficoTabelaProps {
  grafico: ReactNode;
  tabela: ReactNode;
  rotuloGrafico?: string;
  rotuloTabela?: string;
}

// Every chart offers the same information as a table (accessibility and
// transparency requirement). This wrapper carries the toggle and renders one
// of the two views its caller supplies.
export function AlternaGraficoTabela({
  grafico,
  tabela,
  rotuloGrafico = "Gráfico",
  rotuloTabela = "Tabela",
}: AlternaGraficoTabelaProps) {
  const [vista, setVista] = useState<Vista>("grafico");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <ToggleGroup.Root
        type="single"
        value={vista}
        onValueChange={(v) => {
          if (v === "grafico" || v === "tabela") setVista(v);
        }}
        aria-label="Alternar entre gráfico e tabela"
        style={{
          display: "inline-flex",
          alignSelf: "flex-end",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
          overflow: "hidden",
        }}
      >
        <ToggleGroup.Item
          value="grafico"
          style={itemStyle(vista === "grafico")}
        >
          <BarChart3 size={16} aria-hidden /> {rotuloGrafico}
        </ToggleGroup.Item>
        <ToggleGroup.Item value="tabela" style={itemStyle(vista === "tabela")}>
          <Table size={16} aria-hidden /> {rotuloTabela}
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      <div>{vista === "grafico" ? grafico : tabela}</div>
    </div>
  );
}

function itemStyle(ativo: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-1)",
    padding: "var(--space-1) var(--space-3)",
    border: "none",
    fontSize: "var(--text-body)",
    color: ativo ? "var(--on-accent)" : "var(--ink-secondary)",
    background: ativo ? "var(--accent)" : "transparent",
  } as const;
}
