import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { App } from "./App";
// Self-hosted variable font (no external request): renders identically on any
// machine, unlike the OS system stack. Weights 100-900 from one file.
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/global.css";

// Code splitting per screen: each route loads only its own JS, and the heavy
// deps (MapLibre on the map, Observable Plot on the fiscal screen) ride along
// with the chunk that needs them.
const Mapa = lazy(() => import("./routes/mapa"));
const Municipio = lazy(() => import("./routes/municipio"));
const Fiscal = lazy(() => import("./routes/fiscal"));
const Cenarios = lazy(() => import("./routes/cenarios"));
const Ranking = lazy(() => import("./routes/ranking"));
const Metodologia = lazy(() => import("./routes/metodologia"));
const Rede = lazy(() => import("./routes/rede"));

// The profile route accepts a codigo_ibge param; the global selector navigates
// here from any screen.
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Mapa /> },
      { path: "municipio", element: <Municipio /> },
      { path: "municipio/:codigoIbge", element: <Municipio /> },
      { path: "fiscal", element: <Fiscal /> },
      { path: "cenarios", element: <Cenarios /> },
      { path: "ranking", element: <Ranking /> },
      { path: "rede", element: <Rede /> },
      { path: "rede/:codigoIbge", element: <Rede /> },
      { path: "metodologia", element: <Metodologia /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

const container = document.getElementById("root");
if (!container) {
  throw new Error("Elemento raiz #root nao encontrado");
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
