import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// One tour step: navigate to `rota`, spotlight the element carrying
// data-tour="<alvo>" (or center the card when alvo is null), and show the copy.
// Kept declarative so the sequence reads as content, not control flow.
export interface PassoTour {
  rota: string;
  alvo: string | null;
  titulo: string;
  corpo: string;
}

// The guided demonstration: opens on the first visit, replayable from the nav.
// The opening steps answer the reader's first questions (o que e, depende de
// quem, para que serve); the rest walk each region of the panel.
export const PASSOS: PassoTour[] = [
  {
    rota: "/",
    alvo: null,
    titulo: "O que é o Brasil em Órbita",
    corpo:
      "Um índice que lê a dependência de cada município: o quanto depende de outra cidade para hospital, faculdade e banco, o quanto do orçamento vem do repasse da União, e onde ele orbita na rede urbana. IDM aqui é Índice de Dependência Municipal, não de Desenvolvimento: mede dependência estrutural, não desempenho de gestão. Serve para enxergar a geografia real dos serviços e apoiar a decisão pública. Este tour mostra cada parte em menos de um minuto.",
  },
  {
    rota: "/",
    alvo: "nav-mapa",
    titulo: "Mapa de órbitas",
    corpo:
      "O mapa colore cada município pelo IDM: azul menos dependente, vermelho mais dependente. Ao escolher uma cidade, as setas mostram para onde a vida vai, isto é, de quem ela depende. A cor é o único canal do índice; a tipologia entra por filtro, não por cor.",
  },
  {
    rota: "/municipio",
    alvo: "nav-municipio",
    titulo: "Meu município",
    corpo:
      "O perfil de uma cidade: os três eixos do IDM, o porte, e a rede de dependência, o polo de quem ela depende para os serviços que não tem em casa. É a resposta concreta ao depende de quem.",
  },
  {
    rota: "/fiscal",
    alvo: "nav-fiscal",
    titulo: "Eixo fiscal",
    corpo:
      "A dependência do dinheiro: participação do FPM na receita contra a receita sobre o PIB, comparada sempre por porte, nunca pela média nacional. Ao final, a leitura da concavidade do FPM mostra por que a regra do repasse recompensa a fragmentação.",
  },
  {
    rota: "/ranking",
    alvo: "nav-ranking",
    titulo: "Ranking",
    corpo:
      "A lista por grau de dependência estrutural, em faixas percentílicas, sem pódio. Agrupável por tipologia ou porte e exportável, para comparar municípios semelhantes com honestidade.",
  },
  {
    rota: "/cenarios",
    alvo: "nav-cenarios",
    titulo: "Brasil em Cenários",
    corpo:
      "A análise de agregação por região funcional, um polo e os municípios que orbitam nele. Mostra o custo da máquina hoje, o efeito do FPM ao fundir (redistribuído no estado, não economizado pela União) e se a estrutura de serviço se mantém. É simulação descritiva, não recomendação.",
  },
  {
    rota: "/metodologia",
    alvo: "nav-metodologia",
    titulo: "Metodologia e fontes",
    corpo:
      "Como o índice é calculado, os pesos, as fontes datadas (REGIC do IBGE, FINBRA do Tesouro, CNES, INEP) e as validações. Cada número do painel é rastreável a um dado e a um script.",
  },
  {
    rota: "/",
    alvo: null,
    titulo: "Pronto para explorar",
    corpo:
      "É isso. O tour reaparece a cada novo acesso; feche no x quando quiser e use o botão Tour na barra de navegação para revê-lo a qualquer momento. Comece buscando o seu município no mapa.",
  },
];

interface TourCtx {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
}

const Ctx = createContext<TourCtx>({ aberto: false, abrir: () => {}, fechar: () => {} });

export function useTour(): TourCtx {
  return useContext(Ctx);
}

// localStorage key marking that the guided tour was already seen, so it opens
// only on the first visit and never nags a returning reader.
const CHAVE_TOUR_VISTO = "idm.tour.visto";

export function TourProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE_TOUR_VISTO, "1");
    } catch {
      // Storage unavailable (private mode): the tour simply reopens next visit.
    }
  }, []);

  // Open only on the first visit; a returning reader is not interrupted. The
  // Tour button in the nav reopens it at any time.
  useEffect(() => {
    let visto = false;
    try {
      visto = localStorage.getItem(CHAVE_TOUR_VISTO) === "1";
    } catch {
      visto = false;
    }
    if (!visto) setAberto(true);
  }, []);

  const valor = useMemo(() => ({ aberto, abrir, fechar }), [aberto, abrir, fechar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
