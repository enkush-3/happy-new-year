import { decodeTreeFragment, encodeTreeFragment, type TreeDesign } from "./tree-state";

const storageKey = "happy-new-year:last-tree:v3";

export function loadLastTreeDesign(storage?: Storage): TreeDesign | null {
  try {
    const value = (storage ?? window.localStorage).getItem(storageKey);
    if (!value) return null;
    const decoded = decodeTreeFragment(value);
    return decoded.valid && value.startsWith("#tree=") ? decoded.design : null;
  } catch {
    return null;
  }
}

export function saveLastTreeDesign(design: TreeDesign, storage?: Storage): void {
  try {
    (storage ?? window.localStorage).setItem(storageKey, encodeTreeFragment(design));
  } catch {
    // Private browsing and storage quotas must not interrupt the editor.
  }
}
