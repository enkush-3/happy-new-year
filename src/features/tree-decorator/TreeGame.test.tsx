import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TreeGame from "./TreeGame";
import { decodeTreeFragment, DEFAULT_TREE_DESIGN } from "./model/tree-state";
import { downloadTreeGlb } from "./services/gltf-export";
import { downloadTreePng } from "./services/png-export";

const sceneHarness = vi.hoisted(() => ({ root: { name: "fake tree root", userData: {} } }));

vi.mock("./services/png-export", () => ({ downloadTreePng: vi.fn(async () => undefined) }));
vi.mock("./services/gltf-export", () => ({ downloadTreeGlb: vi.fn(async () => undefined) }));
vi.mock("./components/Tree3DScene", async () => {
  const React = await import("react");
  return {
    defaultTreeCameraView: { azimuth: 0, elevation: 0.07, distance: 5.4 },
    default: (props: any) => {
      React.useEffect(() => { props.onExportRoot(sceneHarness.root); return () => props.onExportRoot(null); }, [props.onExportRoot]);
      return React.createElement("div", { role: "group", "aria-label": props.viewMode === "orbit" ? "3D гацуурыг харах" : "3D гацуурыг засах", "data-testid": "mock-tree-scene" },
        React.createElement("canvas", { className: "tree-3d-canvas" }),
        React.createElement("button", { type: "button", onClick: () => props.selectedKind && props.onPlace(props.selectedKind, { x: 0.52, y: 0.46, angle: 0.37, radius: 0.58 }) }, "Модон дээр байрлуулах"),
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
  });

  it("shows only the interactive 3D tree editor", () => {
    render(<TreeGame />);

    expect(screen.getByTestId("mock-tree-scene")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2D зураг" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Өөрөө модоо зурах" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сойз" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3D GLB татах" })).toBeInTheDocument();
  });

  it("places an ornament on the selected raycast point and persists the anchor in v4 share data", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Улаан бөмбөлөг сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));

    expect(screen.getByText("Улаан бөмбөлөг 1")).toBeInTheDocument();
    const shared = decodeTreeFragment(window.location.hash);
    expect(shared.valid).toBe(true);
    expect(shared.design.version).toBe(4);
    expect(shared.design.decorations[0]).toMatchObject({ x: 0.52, y: 0.46, angle: 0.37, radius: 0.58 });
    expect(shared.design.lights).toEqual(DEFAULT_TREE_DESIGN.lights);
  });

  it("supports advanced edit controls, duplicate, undo, and delete", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Алтан од сонгох" }));
    await user.click(screen.getByRole("button", { name: "Модон дээр байрлуулах" }));
    await user.click(screen.getByRole("button", { name: "Томруулах" }));
    await user.click(screen.getByRole("button", { name: "Мөсөн цэнхэр өнгө" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations[0]).toMatchObject({ scale: 1.1, color: "#98d8f2" });
    await user.click(screen.getByRole("button", { name: "Хуулбарлах" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Буцаах" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Сонгосныг устгах" }));
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(0);
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
    const brightness = screen.getByRole("slider", { name: "Гэрлийн тод байдал" });
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
    await user.click(screen.getByRole("button", { name: "Хуваалцах" }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("#tree=") }));
    await user.click(screen.getByRole("button", { name: "Линк хуулах" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#tree="));
    expect(share).toHaveBeenCalledOnce();
  });

  it("shows a selectable share link when clipboard access is unavailable", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "Хуваалцах" }));
    const input = screen.getByLabelText("Модны share линк") as HTMLInputElement;
    expect(input.value).toContain(window.location.origin);
    expect(input.value).toContain("#tree=");
  });

  it("exports the current decorated tree to PNG and GLB", async () => {
    const user = userEvent.setup();
    render(<TreeGame />);
    await user.click(screen.getByRole("button", { name: "PNG зураг татах" }));
    await waitFor(() => expect(downloadTreePng).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "3D GLB татах" }));
    await waitFor(() => expect(downloadTreeGlb).toHaveBeenCalledWith(sceneHarness.root));
    expect(screen.getByRole("button", { name: "3D GLB татах" })).toBeEnabled();
  });

  it("migrates old drawn tree links by retaining ornaments and showing a notice", () => {
    const encoded = btoa(JSON.stringify({ v: 3, m: "c", d: [["old-star", "s", 500, 300, 500, 0, 100, "s"]], s: [["old-ink", "w", 1, "AAEAAQ"]] }))
      .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    window.history.replaceState(null, "", `/#tree=${encoded}`);
    render(<TreeGame />);

    expect(screen.getByText(/гараар зурсан хэсгийг хаслаа/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Модон дээрх Алтан од" })).toBeInTheDocument();
    expect(decodeTreeFragment(window.location.hash).design.decorations).toHaveLength(1);
  });

  it("rejects malformed tree links and recovers to a clean 3D design", () => {
    window.history.replaceState(null, "", "/#tree=not-valid!");
    render(<TreeGame />);
    expect(screen.getByText(/линк буруу байна/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Модон дээрх/ })).not.toBeInTheDocument();
  });
});
