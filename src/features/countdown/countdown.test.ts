import { describe, expect, it } from "vitest";
import { calculateCountdown } from "./countdown";

describe("2027 local countdown", () => {
  it("shows one second immediately before the visitor's local new year", () => {
    const now = new Date(2026, 11, 31, 23, 59, 59, 0);

    expect(calculateCountdown(now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
      totalMilliseconds: 1000,
      hasArrived: false,
    });
  });

  it("switches to the arrived state at local midnight", () => {
    const now = new Date(2027, 0, 1, 0, 0, 0, 0);

    expect(calculateCountdown(now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMilliseconds: 0,
      hasArrived: true,
    });
  });

  it("does not show negative time after 2027 has arrived", () => {
    const now = new Date(2027, 0, 1, 0, 0, 5, 500);

    expect(calculateCountdown(now).totalMilliseconds).toBe(0);
    expect(calculateCountdown(now).hasArrived).toBe(true);
  });
});
