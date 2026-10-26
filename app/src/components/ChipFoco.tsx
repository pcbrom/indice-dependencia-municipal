import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarMunicipios } from "../lib/data";
import { useSelecao } from "../lib/selecao";
import type { Municipio } from "../lib/types";

// The focused city as a persistent chip in the nav: the central control over
// the shared selection. Clicking the name opens the profile; the X (and the
// global Escape) clears the selection everywhere. Hidden when nothing is
// focused. The name is resolved from the in-session cached municipios.
export function ChipFoco() {
  const { codigo, limpar } = useSelecao();
  const navigate = useNavigate();
  const [municipio, setMunicipio] = useState<Municipio | null>(null);

  useEffect(() => {
    if (!codigo) {
      setMunicipio(null);
      return;
    }
    let vivo = true;
    carregarMunicipios()
      .then((lista) => {
        if (vivo) setMunicipio(lista.find((m) => m.codigo_ibge === codigo) ?? null);
      })
      .catch(() => vivo && setMunicipio(null));
    return () => {
      vivo = false;
    };
  }, [codigo]);

  if (!codigo) return null;
  const rotulo = municipio ? `${municipio.nome} (${municipio.uf})` : codigo;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border)",
        background: "var(--surface-1)",
        fontSize: "var(--text-caption)",
        color: "var(--ink-secondary)",
      }}
    >
      <span style={{ color: "var(--ink-muted)" }}>em foco:</span>
      <button
        type="button"
        onClick={() => navigate(`/municipio/${codigo}`)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          color: "var(--ink-primary)",
          fontSize: "var(--text-caption)",
          fontWeight: "var(--weight-title)",
          cursor: "pointer",
        }}
      >
        {rotulo}
      </button>
      <button
        type="button"
        onClick={limpar}
        aria-label={`Limpar seleção de ${rotulo}`}
        style={{
          display: "inline-flex",
          background: "transparent",
          border: "none",
          padding: 0,
          color: "var(--ink-secondary)",
          cursor: "pointer",
        }}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
