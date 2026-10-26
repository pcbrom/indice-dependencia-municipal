import { useEffect, useState } from "react";
import { carregarInterpretacoes, type Interpretacao } from "./data";

// Reads the automatic interpretation for one municipality. Loads the shared
// artifact once (memoized in data.ts) and looks up by codigo_ibge. Returns null
// while loading, when there is no code, or when the artifact is unavailable.
export function useInterpretacao(codigo: string | null | undefined): Interpretacao | null {
  const [interpretacao, setInterpretacao] = useState<Interpretacao | null>(null);
  useEffect(() => {
    if (!codigo) {
      setInterpretacao(null);
      return;
    }
    let vivo = true;
    carregarInterpretacoes()
      .then((mapa) => {
        if (vivo) setInterpretacao(mapa.get(codigo) ?? null);
      })
      .catch(() => {
        if (vivo) setInterpretacao(null);
      });
    return () => {
      vivo = false;
    };
  }, [codigo]);
  return interpretacao;
}
