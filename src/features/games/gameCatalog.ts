import type { GameId } from "./shared/types";

export interface GameDefinition {
  id: GameId;
  title: string;
  description: string;
  icon: string;
  category: string;
  badge: string;
  filterGroup: "action" | "creative-knowledge";
  tone: "amber" | "cyan" | "emerald";
}

export const gameCatalog: GameDefinition[] = [
  { id: "gift-catcher", title: "Бэлэг баригч", description: "Унаж ирэх бэлгийг тосож, нүүрс ба цасан бөмбөгөөс бултаарай.", icon: "🎁", category: "30 сек", badge: "⚡ Авхаалж", filterGroup: "action", tone: "amber" },
  { id: "snowflake-clicker", title: "Цасан ширхэг дарагч", description: "Гялсхийх цас, чимэглэлийг хугацаа дуусахаас өмнө дар.", icon: "❄️", category: "30 сек", badge: "⚡ Авхаалж", filterGroup: "action", tone: "cyan" },
  { id: "countdown-stopper", title: "Яг цагт нь зогсоо", description: "Тоглолт бүрт санамсаргүй сонгогдох 5–10 секундын зорилтыг онож зогсоогоорой.", icon: "⏱️", category: "5–10 сек", badge: "⚡ Реакц", filterGroup: "action", tone: "emerald" },
  { id: "sleigh-runner", title: "Чарганы уралдаан", description: "Саадыг харайж, бэлэг цуглуулан аль болох хол яваарай.", icon: "🛷", category: "Чөлөөт", badge: "⚡ Авхаалж", filterGroup: "action", tone: "cyan" },
  { id: "tree-decorator", title: "Гацуураа чимэглэ", description: "Бэлэн мод чимэглэх эсвэл өөрийн гацуурыг зурж хуваалцаарай.", icon: "🎄", category: "Чөлөөт", badge: "🎨 Бүтээлч", filterGroup: "creative-knowledge", tone: "emerald" },
  { id: "trivia", title: "Шинэ жилийн Trivia", description: "Өвөл, шинэ жилийн тухай санамсаргүй 10–20 асуултад хариулаарай.", icon: "✨", category: "10–20 асуулт", badge: "🧠 Танин мэдэхүй", filterGroup: "creative-knowledge", tone: "amber" },
];

export function findGame(gameId: string | undefined): GameDefinition | undefined {
  return gameCatalog.find((game) => game.id === gameId);
}
