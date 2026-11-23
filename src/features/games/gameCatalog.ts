import type { UiIconName } from "../../components/ui/UiIcon";
import type { GameId } from "./shared/types";

export interface GameDefinition {
  id: GameId;
  title: string;
  description: string;
  icon: UiIconName;
  category: string;
  badge: string;
  filterGroup: "action" | "creative";
  tone: "amber" | "cyan" | "emerald";
}

export const gameCatalog: GameDefinition[] = [
  { id: "gift-catcher", title: "Бэлэг баригч", description: "Унаж ирэх бэлгийг тосож, нүүрс ба цасан бөмбөгөөс бултаарай.", icon: "gift", category: "Хязгааргүй", badge: "Авхаалж", filterGroup: "action", tone: "amber" },
  { id: "snowflake-clicker", title: "Цасан ширхэг дарагч", description: "Гялсхийх цас, чимэглэлийг хугацаа дуусахаас өмнө дар.", icon: "snowflake", category: "30 сек", badge: "Авхаалж", filterGroup: "action", tone: "cyan" },
  { id: "countdown-stopper", title: "Яг цагт нь зогсоо", description: "Тоглолт бүрт санамсаргүй сонгогдох 5–10 секундын зорилтыг онож зогсоогоорой.", icon: "timer", category: "5–10 сек", badge: "Реакц", filterGroup: "action", tone: "emerald" },
  { id: "sleigh-runner", title: "Чарганы уралдаан", description: "Гацуурыг давж, аль болох хол яваарай.", icon: "sleigh", category: "Чөлөөт", badge: "Авхаалж", filterGroup: "action", tone: "cyan" },
  { id: "tree-decorator", title: "Гацуураа чимэглэ", description: "Модоо чимэглээд холбоос, зураг эсвэл GLB файлаар хуваалцаарай.", icon: "tree", category: "3D", badge: "Бүтээлч урлан", filterGroup: "creative", tone: "emerald" },
];

export function findGame(gameId: string | undefined): GameDefinition | undefined {
  return gameCatalog.find((game) => game.id === gameId);
}
