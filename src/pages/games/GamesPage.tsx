import { useState } from "react";
import GameCard from "../../components/ui/GameCard";
import { gameCatalog } from "../../features/games/gameCatalog";
import "./games-page.css";

type GameFilter = "all" | "action" | "creative";

const filters: { id: GameFilter; label: string }[] = [
  { id: "all", label: "Бүх тоглоом" },
  { id: "action", label: "Хурд ба авхаалж" },
  { id: "creative", label: "Бүтээлч" },
];

export default function GamesPage() {
  const [activeFilter, setActiveFilter] = useState<GameFilter>("all");
  const visibleGames = activeFilter === "all"
    ? gameCatalog
    : gameCatalog.filter((game) => game.filterGroup === activeFilter);

  return (
    <section className="games-page" aria-labelledby="games-title">
      <div className="page-heading">
        <p className="eyebrow">❄ БАЯРЫН БАГАХАН ЗАВСАРЛАГА ❄</p>
        <h1 id="games-title">Тоглоомууд</h1>
        <p className="hero-copy">Дуртайгаа сонгоод тоглоорой. Бүтээл, оноогоо share линкээр хуваалцаж болно.</p>
      </div>
      <div className="games-page__filters" role="group" aria-label="Тоглоом шүүх">
        {filters.map((filter) => {
          const count = filter.id === "all"
            ? gameCatalog.length
            : gameCatalog.filter((game) => game.filterGroup === filter.id).length;

          return (
            <button
              key={filter.id}
              className={`games-page__filter${activeFilter === filter.id ? " is-active" : ""}`}
              type="button"
              aria-pressed={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label} ({count})
            </button>
          );
        })}
      </div>
      <p className="games-page__status" role="status" aria-live="polite">
        {visibleGames.length} тоглоом үзүүлж байна
      </p>
      <div className="games-page__grid">
        {visibleGames.map((game, index) => <GameCard key={game.id} game={game} index={index} />)}
      </div>
    </section>
  );
}
