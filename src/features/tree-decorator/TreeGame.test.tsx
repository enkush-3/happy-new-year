import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TreeGame from "./TreeGame";
import { decodeTreeFragment, DEFAULT_TREE_DESIGN } from "./model/tree-state";
import { downloadTreeGlb } from "./services/gltf-export";
import { downloadTreePng } from "./services/png-export";

const sceneHarness = vi.hoisted(() => ({ root: { name: "fake tree root", userData: {} }, markerVisibility: [] as boolean[], haloVisibility: [] as boolean[] }));

vi.mock("./services/png-export", () => ({ downloadTreePng: vi.fn(async () => undefined) }));
vi.mock("./services/gltf-export", () => ({ downloadTreeGlb: vi.fn(async () => undefined) }));
vi.mock("./components/Tree3DSceneSlots", async () => {
  const React = await import("react");
  return {
    default: (props: any) => {
      React.useEffect(() => {
        props.onExportRoot(sceneHarness.root);
        props.onExportControls({
          setMarkersVisible(visible: boolean) { sceneHarness.markerVisibility.push(visible); },
          setSelectionHaloVisible(visible: boolean) { sceneHarness.haloVisibility.push(visible); },
        });
        return () => { props.onExportRoot(null); props.onExportControls(null); };
      }, [props.onExportRoot, props.onExportControls]);
      return React.createElement("div", { role: "group", "aria-label": "3D гацуурыг чирж эргүүлэх; цэг дээр товшиж чимэглэх", "data-testid": "mock-tree-scene" },
        React.createElement("canvas", { className: "tree-3d-canvas" }),
        React.createElement("button", { type: "button", onClick: () => props.onSlotClick(props.selectedKind === "bauble-red" ? "slot-1" : "slot-0") }, "Модон дээр байрлуулах"),
        React.createElement("button", { type: "button", onClick: () => props.onSlotClick("slot-1") }, "Мөчрийн чимэглэлийг сонгох"),
        React.createElement("span", null, `${props.design.decorations.length} байршуулсан`),
      );
    },
  };
});

describe("3D tree workshop", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
    vi.clearAllMocks();
    sceneHarness.markerVisibility.length = 0;
    sceneHarness.haloVisibility.length = 0;
  });

  it("shows only the interactive 3D tree editor", () => {
    render(<TreeGame />);

    expect(screen.getByTestId("mock-tree-scene")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2D зураг" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Өөрөө модоо зурах" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сойз" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3D GLB татах/ })).toBeInTheDocument();
  });

  it("places an ornament on a fixed slot and persists only the slot mapping", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));

    expect(screen.getByText("✦ 1 / 37")).toBeInTheDocument();
    const shared = decodeTreeFragment(window.location.hash);
    expect(shared.valid).toBe(true);
    expect(shared.design.version).toBe(4);
    expect(shared.design.decorations[0]).toMatchObject({ slotId: "slot-1", kind: "bauble-red" });
    const encoded = window.location.hash.slice("#tree=".length).replaceAll("-", "+").replaceAll("_", "/");
    const compact = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    expect(compact).toMatchObject({ v: 6, d: { "slot-1": "r" } });
    expect(shared.design.lights).toEqual(DEFAULT_TREE_DESIGN.lights);
  });

  it("supports advanced style controls, slot replacement, undo, and erase", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Алтан од сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));
    await user.click(screen.getByRole("button", { name: "Томруулах" }));
    await user.click(screen.getByRole("button", { name: "Мөсөн цэнхэр өнгө" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ slotId: "slot-0", scale: 1.1, color: "#98d8f2" });
    await user.click(screen.getByRole("button", { name: /Буцаах/ }));
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ scale: 1.1, color: "#ffd978" });
    await user.click(screen.getByRole("button", { name: "Устгагч сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(0);
  });

  it("lets users switch back to selection mode and edit a placed ornament", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));
    await user.click(screen.getByRole("button", { name: /Сонгох ба нарийн засах/ }));
    await user.click(screen.getByRole("button", { name: "Мөчрийн чимэглэлийг сонгох" }));
    expect(screen.getByText("Чимэглэлийн өнцөг тааруулах")).toBeInTheDocument();
  });

  it("applies 1-degree rotation controls to the selected ornament and new placements", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);

    fireEvent.change(screen.getByRole("slider", { name: "Хөндлөн өнцөг" }), { target: { value: "41" } });
    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ rotX: 0, rotY: 41 });

    fireEvent.change(screen.getByRole("slider", { name: "Босоо өнцөг" }), { target: { value: "-17" } });
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ rotX: -17, rotY: 41 });
    await user.click(screen.getByRole("button", { name: "Хөндлөн өнцгийг 1°-аар нэмэх" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ rotX: -17, rotY: 42 });
    await user.click(screen.getByRole("button", { name: "↺ Тэглэх" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ rotX: 0, rotY: 0 });
  });

  it("toggles, recolors, dims, and shares the animated light settings", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    const toggle = screen.getByRole("checkbox", { name: "Гэрлийг асаах" });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(decodeTreeFragment(window.location.hash).design.lights.enabled).toBe(false);
    await user.click(screen.getByRole("checkbox", { name: "Гэрлийг асаах" }));
    await user.click(screen.getByRole("button", { name: "Мөсөн цэнхэр гэрэл" }));
    const brightness = screen.getByRole("slider", { name: /Гэрлийн тод байдал/ });
    fireEvent.change(brightness, { target: { value: "0.55" } });
    await user.click(screen.getByRole("checkbox", { name: "Зөөлөн анивчилт" }));
    expect(decodeTreeFragment(window.location.hash).design.lights).toEqual({ enabled: true, color: "#98d8f2", brightness: 0.55, twinkle: false });
  });

  it("keeps native share and clipboard actions separate with a manual fallback", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    const nativeNavigator = navigator;
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    const mockedNavigator = Object.create(nativeNavigator) as Navigator & { share: typeof share; clipboard: { writeText: typeof writeText } };
    Object.defineProperty(mockedNavigator, "share", { configurable: true, value: share });
    Object.defineProperty(mockedNavigator, "clipboard", { configurable: true, value: { writeText } });
    vi.stubGlobal("navigator", mockedNavigator);
    await user.click(screen.getByRole("button", { name: /Хуваалцах/ }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("#tree=") }));
    await user.click(screen.getByRole("button", { name: "Линк хуулах" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#tree="));
    expect(share).toHaveBeenCalledOnce();
  });

  it("shows a selectable share link when clipboard access is unavailable", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: /Хуваалцах/ }));
    const input = screen.getByLabelText("Модны share линк") as HTMLInputElement;
    expect(input.value).toContain(window.location.origin);
    expect(input.value).toContain("#tree=");
  });

  it("exports the current decorated tree to PNG and GLB", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: /PNG зураг татах/ }));
    await waitFor(() => expect(downloadTreePng).toHaveBeenCalledOnce());
    expect(sceneHarness.markerVisibility).toEqual([false, true]);
    expect(sceneHarness.haloVisibility).toEqual([false, true]);
    await user.click(screen.getByRole("button", { name: /3D GLB татах/ }));
    await waitFor(() => expect(downloadTreeGlb).toHaveBeenCalledWith(sceneHarness.root));
    expect(screen.getByRole("button", { name: /3D GLB татах/ })).toBeEnabled();
  });

  it("migrates old drawn tree links by retaining ornaments and showing a notice", () => {
    const encoded = btoa(JSON.stringify({ v: 3, m: "c", d: [["old-star", "s", 500, 300, 500, 0, 100, "s"]], s: [["old-ink", "w", 1, "AAEAAQ"]] }))
      .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    window.history.replaceState(null, "", `/#tree=${encoded}`);
    render(<TreeGame />);

    expect(screen.getByText(/гараар зурсан хэсгийг цэвэрлэлээ/i)).toBeInTheDocument();
    expect(screen.getByText("✦ 1 / 37")).toBeInTheDocument();
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(1);
  });

  it("rejects malformed tree links and recovers to a clean 3D design", () => {
    window.history.replaceState(null, "", "/#tree=not-valid!");
    render(<TreeGame />);
    expect(screen.getByText(/линк буруу байна/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Модон дээрх/ })).not.toBeInTheDocument();
  });
});
