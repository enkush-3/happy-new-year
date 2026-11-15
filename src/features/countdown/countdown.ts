export interface CountdownValue {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
  hasArrived: boolean;
}

export function calculateCountdown(_now: Date): CountdownValue {
  const target = new Date(2027, 0, 1, 0, 0, 0, 0).getTime();
  const totalMilliseconds = Math.max(0, target - _now.getTime());
  const totalSeconds = Math.ceil(totalMilliseconds / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMilliseconds,
    hasArrived: totalMilliseconds === 0,
  };
}
