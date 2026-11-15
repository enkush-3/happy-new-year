export const MIN_TRIVIA_QUESTIONS = 10;
export const MAX_TRIVIA_QUESTIONS = 20;

export interface TriviaQuestion {
  prompt: string;
  answers: [string, string, string, string];
  correctIndex: number;
}

export function createTriviaRun(pool: TriviaQuestion[], random: () => number = Math.random): TriviaQuestion[] {
  if (pool.length < MIN_TRIVIA_QUESTIONS) return [...pool];

  const raw = random();
  const sizeRoll = Number.isFinite(raw) ? Math.min(1 - Number.EPSILON, Math.max(0, raw)) : 0.5;
  const runSize = MIN_TRIVIA_QUESTIONS + Math.floor(sizeRoll * (MAX_TRIVIA_QUESTIONS - MIN_TRIVIA_QUESTIONS + 1));
  const shuffled = [...pool];

  for (let index = 0; index < runSize; index += 1) {
    const roll = random();
    const safeRoll = Number.isFinite(roll) ? Math.min(1 - Number.EPSILON, Math.max(0, roll)) : 0.5;
    const swapIndex = index + Math.floor(safeRoll * (shuffled.length - index));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, runSize);
}
