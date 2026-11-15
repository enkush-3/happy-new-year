import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TREE_DESIGN, type TreeDesign } from "./tree-state";
import { loadLastTreeDesign, saveLastTreeDesign } from "./tree-storage";

const makeStorage = (initial: string | null = null): Storage => {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
    removeItem: vi.fn(() => { value = null; }),
    clear: vi.fn(() => { value = null; }),
    key: vi.fn(() => null),
    get length() { return value === null ? 0 : 1; },
  } as unknown as Storage;
};

describe("last tree storage", () => {
  it("saves and restores the most recent tree design", () => {
    const storage = makeStorage();
    const design: TreeDesign = { ...DEFAULT_TREE_DESIGN, lights: { ...DEFAULT_TREE_DESIGN.lights, twinkle: false } };

    saveLastTreeDesign(design, storage);

    expect(loadLastTreeDesign(storage)).toEqual(design);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it("returns no saved tree for malformed data and tolerates unavailable storage", () => {
    expect(loadLastTreeDesign(makeStorage("#tree=bad!"))).toBeNull();
    expect(loadLastTreeDesign({ getItem: () => { throw new Error("blocked"); } } as unknown as Storage)).toBeNull();
    expect(() => saveLastTreeDesign(DEFAULT_TREE_DESIGN, { setItem: () => { throw new Error("blocked"); } } as unknown as Storage)).not.toThrow();
  });
});
