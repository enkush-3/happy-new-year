import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { encodeTreeFragment } from "./lib/tree-state";
import type { TreeDesign } from "./lib/tree-state";
import { downloadTreePng } from "./lib/png-export";

vi.mock("./lib/png-export", () => ({ downloadTreePng: vi.fn(async () => undefined) }));

describe("Happy New Year tree builder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
    vi.clearAllMocks();
  });

  it("lets a player choose an ornament and place it on the tree", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    await user.click(screen.getByRole("group", { name: "Чимэглэх гацуур" }));

    expect(screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" })).toBeInTheDocument();
    expect(screen.getByText(/1 чимэглэл/)).toBeInTheDocument();
  });

  it("places an ornament when it is dragged from the palette onto the tree", () => {
    render(<App />);
    const tree = screen.getByRole("group", { name: "Чимэглэх гацуур" });
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 560, width: 600, height: 560,
      toJSON: () => ({}),
    } as DOMRect);
    const paletteItem = screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" });

    fireEvent.pointerDown(paletteItem, { pointerId: 3, button: 0, clientX: 30, clientY: 30 });
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 140, clientY: 160 });
    fireEvent.pointerUp(tree, { pointerId: 3, clientX: 300, clientY: 280 });

    expect(screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" })).toBeInTheDocument();
  });

  it("supports keyboard placement and deleting the focused ornament", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Алтан од сонгох" }));
    const tree = screen.getByRole("group", { name: "Чимэглэх гацуур" });
    tree.focus();
    fireEvent.keyDown(tree, { key: "Enter" });

    const star = screen.getByRole("button", { name: "Модон дээрх Алтан од" });
    const originalPosition = star.getAttribute("transform");
    star.focus();
    fireEvent.keyDown(star, { key: "ArrowRight" });
    expect(star.getAttribute("transform")).not.toBe(originalPosition);
    fireEvent.keyDown(star, { key: "Delete" });
    expect(screen.queryByRole("button", { name: "Модон дээрх Алтан од" })).not.toBeInTheDocument();
  });

  it("lets the player drag a placed ornament to another tree branch", async () => {
    const user = userEvent.setup();
    render(<App />);
    const tree = screen.getByRole("group", { name: "Чимэглэх гацуур" });
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 560, width: 400, height: 560,
      toJSON: () => ({}),
    } as DOMRect);

    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    fireEvent.click(tree, { clientX: 200, clientY: 280 });
    const ball = screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" });
    const originalPosition = ball.getAttribute("transform");

    fireEvent.pointerDown(ball, { pointerId: 1, button: 0, clientX: 200, clientY: 280 });
    fireEvent.pointerMove(tree, { pointerId: 1, clientX: 280, clientY: 360 });
    fireEvent.pointerUp(tree, { pointerId: 1, clientX: 280, clientY: 360 });

    expect(ball.getAttribute("transform")).not.toBe(originalPosition);
  });

  it("restores a shared tree from the URL fragment", () => {
    const design: TreeDesign = {
      version: 1,
      decorations: [{ id: "shared-star", kind: "star", x: 0.5, y: 0.3 }],
    };
    window.history.replaceState(null, "", `/${encodeTreeFragment(design)}`);
    render(<App />);

    expect(screen.getByRole("button", { name: "Модон дээрх Алтан од" })).toBeInTheDocument();
  });

  it("shows a manual-copy fallback when clipboard access is unavailable", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Хуваалцах" }));

    const link = screen.getByLabelText("Модны share линк") as HTMLInputElement;
    expect(link.value).toContain("#tree=");
    expect(link.value).toContain(window.location.origin);
  });

  it("keeps native sharing and direct link copying as separate actions", async () => {
    const user = userEvent.setup();
    render(<App />);
    const nativeNavigator = navigator;
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    const mockedNavigator = Object.create(nativeNavigator) as Navigator & {
      share: typeof share;
      clipboard: { writeText: typeof writeText };
    };
    Object.defineProperty(mockedNavigator, "share", { configurable: true, value: share });
    Object.defineProperty(mockedNavigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal("navigator", mockedNavigator);

    await user.click(screen.getByRole("button", { name: "Хуваалцах" }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("#tree=") }));

    await user.click(screen.getByRole("button", { name: "Линк хуулах" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#tree="));
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("does not include arbitrary page query parameters in shared links", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?access_token=private-value");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Линк хуулах" }));

    const link = screen.getByLabelText("Модны share линк") as HTMLInputElement;
    expect(link.value).toContain("#tree=");
    expect(link.value).not.toContain("access_token");
    expect(link.value).not.toContain("private-value");
    expect(new URL(link.value).search).toBe("");
    expect(window.location.search).toBe("");
  });

  it("exports the rendered tree as a PNG", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "PNG зураг татах" }));

    await waitFor(() => expect(downloadTreePng).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/зураг бэлэн/)).toBeInTheDocument();
  });

  it("shows a clear message when the shared URL is malformed", () => {
    window.history.replaceState(null, "", "/#tree=not-valid!");
    render(<App />);

    expect(screen.getByText(/линк буруу байна/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Модон дээрх/ })).not.toBeInTheDocument();
  });
});
