import type { GameId } from "./shared/types";

export interface GameDefinition {
  id: GameId;
  title: string;
  description: string;
  icon: string;
  category: string;
}

export const gameCatalog: GameDefinition[] = [
  { id: "gift-catcher", title: "Бэлэг баригч", description: "Унаж ирэх бэлгийг тосож, нүүрс ба цасан бөмбөгөөс бултаарай.", icon: "🎁", category: "30 секунд" },
  { id: "snowflake-clicker", title: "Цасан ширхэг дарагч", description: "Гялсхийх цас, чимэглэлийг хугацаа дуусахаас өмнө дар.", icon: "❄️", category: "30 секунд" },
  { id: "countdown-stopper", title: "Яг цагт нь зогсоо", description: "5.000–10.000 секундын санамсаргүй зорилтод аль болох ойр зогсоогоорой.", icon: "⏱️", category: "Реакц" },
  { id: "sleigh-runner", title: "Чарганы уралдаан", description: "Саадыг харайж, бэлэг цуглуулан аль болох хол яваарай.", icon: "🛷", category: "Хязгааргүй" },
  { id: "tree-decorator", title: "Гацуураа чимэглэ", description: "Бэлэн мод чимэглэх эсвэл өөрийн гацуурыг зурж хуваалцаарай.", icon: "🎄", category: "Бүтээлч" },
  { id: "trivia", title: "Шинэ жилийн Trivia", description: "Өвөл, шинэ жилийн тухай санамсаргүй 10–20 асуултад хариулаарай.", icon: "✨", category: "10–20 асуулт" },
];

export function findGame(gameId: string | undefined): GameDefinition | undefined {
  return gameCatalog.find((game) => game.id === gameId);
}
