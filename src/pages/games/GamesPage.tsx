import GameCard from "../../components/ui/GameCard";
import { gameCatalog } from "../../features/games/gameCatalog";

export default function GamesPage() {
  return (
    <section className="games-page" aria-labelledby="games-title">
      <div className="page-heading">
        <p className="eyebrow">❄ БАЯРЫН БАГАХАН ЗАВСАРЛАГА ❄</p>
        <h1 id="games-title">Тоглоомууд</h1>
        <p className="hero-copy">Дуртайгаа сонгоод тоглоорой. Бүтээл, оноогоо share линкээр хуваалцаж болно.</p>
      </div>
      <div className="games-grid">
        {gameCatalog.map((game, index) => <GameCard key={game.id} game={game} index={index} />)}
      </div>
    </section>
  );
}
