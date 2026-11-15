import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TreeGame from "./TreeGame";
import { decodeTreeFragment, DEFAULT_TREE_DESIGN, encodeTreeFragment } from "./model/tree-state";
import type { TreeDesign } from "./model/tree-state";
import { downloadTreePng } from "./services/png-export";

vi.mock("./services/png-export", () => ({ downloadTreePng: vi.fn(async () => undefined) }));

describe("Happy New Year tree builder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("lets a player choose an ornament and place it on the tree", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);

    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    await user.click(screen.getByRole("group", { name: "Чимэглэх гацуур" }));

    expect(screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" })).toBeInTheDocument();
    expect(screen.getByText(/1 чимэглэл/)).toBeInTheDocument();
  });

  it("places an ornament when it is dragged from the palette onto the tree", () => {
    render(<TreeGame />);
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
    render(<TreeGame />);

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
    render(<TreeGame />);
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

  it("commits an SVG ornament drag to share, reload, and undo state", async () => {
    const user = userEvent.setup();
    const view = render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "2D зураг" }));
    const tree = screen.getByRole("group", { name: "Чимэглэх гацуур" });
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 560, width: 400, height: 560,
      toJSON: () => ({}),
    } as DOMRect);

    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    fireEvent.click(tree, { clientX: 200, clientY: 280 });
    const ball = screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" });
    const originalTransform = ball.getAttribute("transform");
    const before = decodeTreeFragment(window.location.hash).design.decorations[0];
    fireEvent.pointerDown(ball, { pointerId: 41, button: 0, clientX: 200, clientY: 280 });
    fireEvent.pointerMove(tree, { pointerId: 41, clientX: 280, clientY: 360 });
    fireEvent.pointerUp(ball, { pointerId: 41, clientX: 280, clientY: 360 });

    const shared = decodeTreeFragment(window.location.hash);
    expect(shared.valid).toBe(true);
    expect(shared.design.decorations[0].x).toBeGreaterThan(before.x);
    expect(decodeTreeFragment(window.localStorage.getItem("happy-new-year:last-tree:v3") ?? "").design)
      .toEqual(shared.design);

    await user.click(screen.getByRole("button", { name: "Буцаах" }));
    const undone = decodeTreeFragment(window.location.hash);
    expect(undone.design.decorations[0].x).toBe(before.x);
    expect(undone.design.decorations[0].y).toBe(before.y);
    await user.click(screen.getByRole("button", { name: "Дахин хийх" }));
    const movedTransform = screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" }).getAttribute("transform");

    view.unmount();
    render(<TreeGame />);
    expect(screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" }).getAttribute("transform"))
      .not.toBe(originalTransform);
    expect(movedTransform).not.toBe(originalTransform);
  });

  it("edits, duplicates, and undoes a selected ornament", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    const tree = screen.getByRole("group", { name: "Чимэглэх гацуур" });

    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    fireEvent.click(tree, { clientX: 200, clientY: 280 });
    await user.click(screen.getByRole("button", { name: "Томруулах" }));
    await user.click(screen.getByRole("button", { name: "Мөсөн цэнхэр өнгө" }));

    let design = decodeTreeFragment(window.location.hash).design;
    expect(design.decorations[0]).toMatchObject({ scale: 1.1, color: "#98d8f2" });

    await user.click(screen.getByRole("button", { name: "Хуулбарлах" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Буцаах" }));
    design = decodeTreeFragment(window.location.hash).design;
    expect(design.decorations).toHaveLength(1);
    expect(design.decorations[0]).toMatchObject({ scale: 1.1, color: "#98d8f2" });
    await user.click(screen.getByRole("button", { name: "Дахин хийх" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(2);
  });

  it("keeps the editable 2D tree available when WebGL is unavailable", async () => {
    render(<TreeGame />);

    expect(screen.getByRole("group", { name: "Чимэглэх гацуур" })).toBeInTheDocument();
    expect(await screen.findByText(/3D дүрслэл боломжгүй/i)).toBeInTheDocument();
  });

  it("does not place another ornament when tapping a placed ornament", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    const tree = screen.getByRole("group", { name: "Чимэглэх гацуур" });

    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    fireEvent.click(tree, { clientX: 200, clientY: 280 });
    const ornament = screen.getByRole("button", { name: "Модон дээрх Улаан бөмбөлөг" });
    fireEvent.pointerDown(ornament, { pointerId: 29, button: 0, clientX: 200, clientY: 280 });
    fireEvent.pointerUp(tree, { pointerId: 29, clientX: 200, clientY: 280 });
    fireEvent.click(tree, { clientX: 200, clientY: 280 });

    expect(screen.getAllByTestId("placed-decoration")).toHaveLength(1);
  });

  it("lets the player draw, share, and undo a custom tree stroke", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);

    await user.click(screen.getByRole("button", { name: "Өөрөө модоо зурах" }));
    const tree = screen.getByRole("group", { name: "Өөрөө зурж бүтээх мод" });
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 560, width: 400, height: 560,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(tree, { pointerId: 7, button: 0, clientX: 120, clientY: 180 });
    fireEvent.pointerMove(tree, { pointerId: 7, clientX: 170, clientY: 240 });
    fireEvent.pointerUp(tree, { pointerId: 7, clientX: 210, clientY: 300 });

    expect(screen.getByTestId("tree-stroke")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Линк хуулах" }));
    const shareInput = screen.getByLabelText("Модны share линк") as HTMLInputElement;
    const sharedDesign = decodeTreeFragment(new URL(shareInput.value).hash);
    expect(sharedDesign.design.treeMode).toBe("custom");
    expect(sharedDesign.design.strokes).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Баллуур" }));
    fireEvent.pointerDown(tree, { pointerId: 8, button: 0, clientX: 170, clientY: 240 });
    fireEvent.pointerUp(tree, { pointerId: 8, clientX: 170, clientY: 240 });
    expect(screen.queryByTestId("tree-stroke")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сүүлчийн зурсан зураасыг буцаах" }));
    expect(screen.getByTestId("tree-stroke")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сүүлчийн зурсан зураасыг буцаах" }));
    expect(screen.queryByTestId("tree-stroke")).not.toBeInTheDocument();
  });

  it("keeps the middle of a long custom stroke when saving it", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Өөрөө модоо зурах" }));
    const tree = screen.getByRole("group", { name: "Өөрөө зурж бүтээх мод" });
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 560, width: 400, height: 560,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(tree, { pointerId: 17, button: 0, clientX: 60, clientY: 120 });
    for (let index = 0; index < 120; index += 1) {
      fireEvent.pointerMove(tree, {
        pointerId: 17,
        clientX: 60 + (index % 10) * 25,
        clientY: 120 + Math.floor(index / 10) * 22,
      });
    }
    fireEvent.pointerUp(tree, { pointerId: 17, clientX: 285, clientY: 362 });

    expect(screen.getByTestId("tree-stroke").getAttribute("d")).toContain("60 340");

    await user.click(screen.getByRole("button", { name: "Бэлэн гацуур" }));
    expect(screen.queryByTestId("tree-stroke")).not.toBeInTheDocument();
    expect(screen.getByTestId("classic-tree")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Өөрөө модоо зурах" }));
    expect(screen.getByTestId("tree-stroke")).toBeInTheDocument();
  });

  it("lets drawing start over a placed ornament", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Өөрөө модоо зурах" }));
    const tree = screen.getByRole("group", { name: "Өөрөө зурж бүтээх мод" });
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 560, width: 400, height: 560,
      toJSON: () => ({}),
    } as DOMRect);
    await user.click(screen.getByRole("button", { name: "Алтан од сонгох" }));
    fireEvent.click(tree, { clientX: 200, clientY: 280 });
    const star = screen.getByRole("button", { name: "Модон дээрх Алтан од" });
    await user.click(screen.getByRole("button", { name: "Сойз" }));

    fireEvent.pointerDown(star, { pointerId: 23, button: 0, clientX: 200, clientY: 280 });
    fireEvent.pointerMove(tree, { pointerId: 23, clientX: 250, clientY: 330 });
    fireEvent.pointerUp(tree, { pointerId: 23, clientX: 250, clientY: 330 });

    expect(screen.getByTestId("tree-stroke")).toBeInTheDocument();
  });

  it("supports keyboard drawing and erasing on a custom tree", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Өөрөө модоо зурах" }));
    const tree = screen.getByRole("group", { name: "Өөрөө зурж бүтээх мод" });
    tree.focus();
    fireEvent.keyDown(tree, { key: "Enter" });
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    fireEvent.keyDown(tree, { key: "Enter" });

    expect(screen.getByTestId("tree-stroke")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Баллуур" }));
    tree.focus();
    fireEvent.keyDown(tree, { key: "Delete" });
    expect(screen.queryByTestId("tree-stroke")).not.toBeInTheDocument();
  });

  it("keeps tree-light colors in the SVG so PNG export retains them", () => {
    render(<TreeGame />);
    const svg = screen.getByRole("group", { name: "Чимэглэх гацуур" });
    const lights = svg.querySelectorAll(".tree-light");

    expect(lights.length).toBeGreaterThan(0);
    expect(lights[0]).toHaveAttribute("fill", "#ffe3a1");
    expect(lights[3]).toHaveAttribute("fill", "#c1e6ef");
  });

  it("restores a shared tree from the URL fragment", () => {
    const design: TreeDesign = {
      ...DEFAULT_TREE_DESIGN,
      decorations: [{
        id: "shared-star", kind: "star", x: 0.5, y: 0.3,
        angle: 0.5, rotation: 0, scale: 1, color: "#ffd978",
      }],
    };
    window.history.replaceState(null, "", `/${encodeTreeFragment(design)}`);
    render(<TreeGame />);

    expect(screen.getByRole("button", { name: "Модон дээрх Алтан од" })).toBeInTheDocument();
  });

  it("restores a custom hand-drawn tree from the URL fragment", () => {
    const design: TreeDesign = {
      ...DEFAULT_TREE_DESIGN,
      treeMode: "custom",
      strokes: [{
        id: "shared-stroke",
        color: "ice",
        width: 8,
        points: [{ x: 0.5, y: 0.1 }, { x: 0.25, y: 0.8 }, { x: 0.75, y: 0.8 }],
      }],
    };
    window.history.replaceState(null, "", `/${encodeTreeFragment(design)}`);
    render(<TreeGame />);

    expect(screen.getByRole("group", { name: "Өөрөө зурж бүтээх мод" })).toBeInTheDocument();
    expect(screen.getByTestId("tree-stroke")).toHaveAttribute("stroke", "#98d8f2");
    expect(screen.getByRole("button", { name: "Баллуур" })).toBeInTheDocument();
  });

  it("shows a manual-copy fallback when clipboard access is unavailable", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);

    await user.click(screen.getByRole("button", { name: "Хуваалцах" }));

    const link = screen.getByLabelText("Модны share линк") as HTMLInputElement;
    expect(link.value).toContain("#tree=");
    expect(link.value).toContain(window.location.origin);
  });

  it("keeps native sharing and direct link copying as separate actions", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
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
    render(<TreeGame />);

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
    render(<TreeGame />);

    await user.click(screen.getByRole("button", { name: "PNG зураг татах" }));

    await waitFor(() => expect(downloadTreePng).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/зураг бэлэн/)).toBeInTheDocument();
  });

  it("shows a clear message when the shared URL is malformed", () => {
    window.history.replaceState(null, "", "/#tree=not-valid!");
    render(<TreeGame />);

    expect(screen.getByText(/линк буруу байна/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Модон дээрх/ })).not.toBeInTheDocument();
  });
});
