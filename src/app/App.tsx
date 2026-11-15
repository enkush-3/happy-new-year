import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import "../styles/index.css";
import AppShell from "../components/layout/AppShell";
import CountdownPage from "../pages/countdown/CountdownPage";
import GamePage from "../pages/game/GamePage";
import GamesPage from "../pages/games/GamesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeRoute />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="games/:gameId" element={<GamePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function HomeRoute() {
  const location = useLocation();
  if (location.hash.startsWith("#tree=")) {
    return <Navigate to={{ pathname: "/games/tree-decorator", search: location.search, hash: location.hash }} replace />;
  }
  return <CountdownPage />;
}

function NotFoundPage() {
  const location = useLocation();
  const isUnknownGame = location.pathname.startsWith("/games/");
  return (
    <section className="message-page">
      <p className="eyebrow">❄ ӨВЛИЙН УРЛАН</p>
      <h1>{isUnknownGame ? "Тоглоом олдсонгүй" : "Хуудас олдсонгүй"}</h1>
      <p>Хаягаа шалгаад дахин оролдоорой.</p>
      <Link className="button button--primary" to="/games">Тоглоомууд руу буцах</Link>
    </section>
  );
}
