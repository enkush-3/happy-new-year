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
  { id: "countdown-stopper", title: "Яг цагт нь зогсоо", description: "Арван секундийн тооллыг яг тэг дээр зогсоож чадах уу?", icon: "⏱️", category: "Реакц" },
  { id: "sleigh-runner", title: "Чарганы уралдаан", description: "Саадыг харайж, бэлэг цуглуулан аль болох хол яваарай.", icon: "🛷", category: "Хязгааргүй" },
  { id: "fortune-cookie", title: "Ирэх жилийн ерөөл", description: "Бэлгээ нээгээд ирэх жилийн гурван сайхан ерөөлийг сонирхоорой.", icon: "🥠", category: "Санамсаргүй" },
  { id: "tree-decorator", title: "Гацуураа чимэглэ", description: "Бэлэн мод чимэглэх эсвэл өөрийн гацуурыг зурж хуваалцаарай.", icon: "🎄", category: "Бүтээлч" },
  { id: "trivia", title: "Шинэ жилийн Trivia", description: "Арван асуултад хариулаад ямар баярлагч болохоо мэдээрэй.", icon: "✨", category: "10 асуулт" },
];

export function findGame(gameId: string | undefined): GameDefinition | undefined {
  return gameCatalog.find((game) => game.id === gameId);
}
