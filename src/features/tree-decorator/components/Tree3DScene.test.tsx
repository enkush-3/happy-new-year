import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tree3DScene from "./Tree3DScene";
import { DEFAULT_TREE_DESIGN, type TreeDesign } from "../model/tree-state";

const threeHarness = vi.hoisted(() => ({
  intersections: [] as any[],
  camera: null as any,
  meshes: [] as any[],
  loop: null as ((time: number) => void) | null,
  reduceMotion: false,
  rendererDisposals: 0,
  loadError: false,
}));

vi.mock("three", () => {
  class Vector3 {
    constructor(public x = 0, public y = 0, public z = 0) {}
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    copy(point: Vector3) { return this.set(point.x, point.y, point.z); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    multiplyScalar(value: number) { this.x *= value; this.y *= value; this.z *= value; return this; }
  }
  class Vector2 { set() { return this; } }
  class Geometry { dispose() {} }
  class Color { set() { return this; } }
  class Material {
    emissive = new Color();
    color = new Color();
    emissiveIntensity = 0;
    roughness = 0.5;
    transparent = false;
    opacity = 1;
    depthWrite = true;
    constructor(public options: Record<string, any> = {}) { this.roughness = options.roughness ?? 0.5; }
    dispose() {}
  }
  class Group {
    children: any[] = [];
    rotation = { x: 0, y: 0, z: 0 };
    position = new Vector3();
    scale = { setScalar() {} };
    userData: Record<string, unknown> = {};
    visible = true;
    name = "";
    add(child: any) { this.children.push(child); child.parent = this; }
    remove(child: any) { this.children = this.children.filter((item) => item !== child); child.parent = null; }
    worldToLocal(point: any) { return point; }
    traverse(callback: (object: any) => void) { callback(this); this.children.forEach((child) => child.traverse ? child.traverse(callback) : callback(child)); }
  }
  class Mesh extends Group {
    isMesh = true;
    constructor(public geometry: Geometry, public material: Material) { super(); threeHarness.meshes.push(this); }
  }
  class PerspectiveCamera extends Group {
    aspect = 1;
    constructor() { super(); threeHarness.camera = this; }
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class Light extends Group {}
  class WebGLRenderer {
    domElement = document.createElement("canvas");
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    setAnimationLoop(callback: ((time: number) => void) | null) { threeHarness.loop = callback; }
    render() {}
    dispose() { threeHarness.rendererDisposals += 1; }
  }
  class Raycaster {
    setFromCamera() {}
    intersectObjects() { return threeHarness.intersections; }
  }
  return {
    WebGLRenderer, Scene: Group, Group, Mesh, PerspectiveCamera,
    HemisphereLight: Light, DirectionalLight: Light, PointLight: Light,
    MeshStandardMaterial: Material, ConeGeometry: Geometry, CylinderGeometry: Geometry,
    OctahedronGeometry: Geometry, TorusGeometry: Geometry, CircleGeometry: Geometry,
    SphereGeometry: Geometry, Raycaster, Vector2, Vector3,
  };
});

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    setDRACOLoader() { return this; }
    async loadAsync() {
      if (threeHarness.loadError) throw new Error("Tree model unavailable");
      const geometry = { dispose: vi.fn() };
      const material = { roughness: 0.8, dispose: vi.fn() };
      const surface = { isMesh: true, name: "Circle", userData: {}, geometry, material, traverse(callback: (object: any) => void) { callback(this); } };
      const model = {
        name: "Christmas Tree",
        children: [surface],
        scale: { setScalar: vi.fn() },
        position: { set: vi.fn() },
        traverse(callback: (object: any) => void) { callback(this); this.children.forEach(callback); },
      };
      return { scene: model };
    }
  },
}));

vi.mock("three/addons/loaders/DRACOLoader.js", () => ({
  DRACOLoader: class { setDecoderPath() { return this; } dispose() {} },
}));

const testDesign: TreeDesign = {
  ...DEFAULT_TREE_DESIGN,
  decorations: [{ id: "test-ball", kind: "bauble-red", x: 0.5, y: 0.5, angle: 0.5, radius: 0.5, rotation: 0, scale: 1, color: "#d96b5e" }],
};

function treeHit(x = 0.38, y = 0.12, z = 0.34) {
  return { object: { userData: { treeSurface: true } }, point: { x, y, z, clone() { return { x: this.x, y: this.y, z: this.z }; } } };
}

function renderEditor(viewMode: "edit" | "orbit" = "edit", selectedKind: "star" | null = null) {
  const move = vi.fn();
  const commit = vi.fn();
  const select = vi.fn();
  const place = vi.fn();
  const remove = vi.fn();
  let exportRoot: any = null;
  const view = render(<Tree3DScene
    design={testDesign}
    selectedDecorationId="test-ball"
    selectedKind={selectedKind}
    viewMode={viewMode}
    cameraViewRef={{ current: { azimuth: 0, elevation: 0.07, distance: 5.4 } }}
    onExportRoot={(root) => { exportRoot = root; }}
    onPlace={place}
    onMove={move}
    onMoveCommit={commit}
    onSelect={select}
    onRemove={remove}
  />);
  return { ...view, move, commit, select, place, remove, getExportRoot: () => exportRoot };
}

describe("Tree3DScene", () => {
  beforeEach(() => {
    threeHarness.camera = null;
    threeHarness.meshes = [];
    threeHarness.loop = null;
    threeHarness.reduceMotion = false;
    threeHarness.rendererDisposals = 0;
    threeHarness.loadError = false;
    threeHarness.intersections = [
      { object: { userData: { decorationId: "test-ball" } }, point: { x: 0, y: 0, z: 0 } },
      treeHit(),
    ];
    Object.defineProperty(window, "WebGLRenderingContext", { configurable: true, value: class {} });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: threeHarness.reduceMotion, addEventListener() {}, removeEventListener() {} })));
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "WebGLRenderingContext");
    vi.unstubAllGlobals();
  });

  it("loads the local tree model and exposes it for a full-scene GLB export", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(screen.getByText("Чимэглэл сонгоод модон дээр товшиж байрлуулна · Байрлуулсны дараа чирж хөдөлгөнө.")).toBeInTheDocument());

    expect(editor.getExportRoot()).not.toBeNull();
    expect(editor.getExportRoot().children.some((child: any) => child.name === "Christmas Tree")).toBe(true);
  });

  it("previews an ornament at the raycast surface and places it on exact click coordinates", async () => {
    const editor = renderEditor("edit", "star");
    await waitFor(() => expect(editor.getExportRoot()).not.toBeNull());
    threeHarness.intersections = [treeHit(0.4, 0.3, 0.35)];
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });

    fireEvent.pointerMove(host, { pointerId: 4, clientX: 170, clientY: 190 });
    const ghost = threeHarness.meshes.find((mesh) => mesh.userData.isPlacementPreview);
    expect(ghost).toBeDefined();
    expect(ghost.visible).toBe(true);

    fireEvent.pointerDown(host, { pointerId: 4, button: 0, clientX: 170, clientY: 190 });
    expect(editor.place).toHaveBeenCalledWith("star", expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), angle: expect.any(Number), radius: expect.any(Number) }));
    expect(editor.place.mock.calls[0][1].radius).toBeCloseTo(Math.hypot(0.4, 0.35) / 0.63);
  });

  it("selects a placed ornament without changing the design", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(editor.getExportRoot()).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });
    fireEvent.pointerDown(host, { pointerId: 5, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(host, { pointerId: 5, clientX: 100, clientY: 100 });
    expect(editor.select).toHaveBeenCalledWith("test-ball");
    expect(editor.move).not.toHaveBeenCalled();
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it("commits one 3D surface drag and records the normalized surface radius", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(editor.getExportRoot()).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });
    fireEvent.pointerDown(host, { pointerId: 6, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(host, { pointerId: 6, clientX: 150, clientY: 145 });
    fireEvent.pointerUp(host, { pointerId: 6, clientX: 150, clientY: 145 });
    expect(editor.move).toHaveBeenCalledWith("test-ball", expect.objectContaining({ radius: expect.any(Number) }));
    expect(editor.commit).toHaveBeenCalledOnce();
  });

  it("uses touchpad scrolling and keyboard shortcuts for orbit controls", async () => {
    renderEditor("orbit");
    await waitFor(() => expect(document.querySelector(".tree-3d-canvas")).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг харах" });
    const frontZ = threeHarness.camera.position.z;
    const verticalWheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -80 });
    host.dispatchEvent(verticalWheel);
    expect(verticalWheel.defaultPrevented).toBe(true);
    expect(threeHarness.camera.position.z).toBeLessThan(frontZ);
    fireEvent.wheel(host, { deltaX: 80, deltaY: 0 });
    expect(threeHarness.camera.position.x).not.toBeCloseTo(0);
    host.focus();
    fireEvent.keyDown(host, { key: "Home" });
    expect(threeHarness.camera.position.x).toBeCloseTo(0);
    expect(threeHarness.camera.position.z).toBeCloseTo(frontZ);
  });

  it("supports pinch zoom with two touch pointers in orbit mode", async () => {
    renderEditor("orbit");
    await waitFor(() => expect(document.querySelector(".tree-3d-canvas")).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг харах" });
    const frontZ = threeHarness.camera.position.z;
    fireEvent.pointerDown(host, { pointerId: 11, pointerType: "touch", button: 0, clientX: 100, clientY: 140 });
    fireEvent.pointerDown(host, { pointerId: 12, pointerType: "touch", button: 0, clientX: 200, clientY: 140 });
    fireEvent.pointerMove(host, { pointerId: 11, pointerType: "touch", clientX: 70, clientY: 140 });
    fireEvent.pointerMove(host, { pointerId: 12, pointerType: "touch", clientX: 230, clientY: 140 });
    expect(threeHarness.camera.position.z).toBeLessThan(frontZ);
    fireEvent.pointerUp(host, { pointerId: 11, pointerType: "touch", clientX: 70, clientY: 140 });
    fireEvent.pointerUp(host, { pointerId: 12, pointerType: "touch", clientX: 230, clientY: 140 });
  });

  it("restores a dragged ornament when the browser cancels its pointer", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(editor.getExportRoot()).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });
    const originalOrnament = threeHarness.meshes.filter((mesh) => mesh.userData.decorationId === "test-ball").at(-1);
    const initialPosition = { ...originalOrnament.parent.position };
    fireEvent.pointerDown(host, { pointerId: 13, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(host, { pointerId: 13, clientX: 150, clientY: 145 });
    fireEvent.pointerCancel(host, { pointerId: 13 });
    const restoredOrnament = threeHarness.meshes.filter((mesh) => mesh.userData.decorationId === "test-ball").at(-1);
    expect(restoredOrnament.parent.position).toEqual(initialPosition);
    expect(editor.move).not.toHaveBeenCalled();
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it("keeps manual placement available when reduced motion disables the animation loop", async () => {
    threeHarness.reduceMotion = true;
    const editor = renderEditor("edit", "star");
    await waitFor(() => expect(editor.getExportRoot()).not.toBeNull());
    expect(threeHarness.loop).toBeNull();
    threeHarness.intersections = [treeHit()];
    fireEvent.pointerDown(screen.getByRole("group", { name: "3D гацуурыг засах" }), { pointerId: 9, button: 0, clientX: 120, clientY: 120 });
    expect(editor.place).toHaveBeenCalledOnce();
  });

  it("creates an individual soft animated bulb mesh for every light point", async () => {
    renderEditor();
    await waitFor(() => expect(document.querySelector(".tree-3d-canvas")).not.toBeNull());
    const bulbs = threeHarness.meshes.filter((mesh) => typeof mesh.userData.twinklePhase === "number");
    expect(bulbs).toHaveLength(28);
    expect(new Set(bulbs.map((bulb) => bulb.material)).size).toBe(28);
  });

  it("deletes the selected decoration with the keyboard", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(editor.getExportRoot()).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });
    host.focus();
    fireEvent.keyDown(host, { key: "Delete" });
    expect(editor.remove).toHaveBeenCalledWith("test-ball");
  });

  it("shows a 3D load error and disposes the renderer after loader failure", async () => {
    threeHarness.loadError = true;
    renderEditor();
    await waitFor(() => expect(screen.getByText("3D мод ачаалж чадсангүй. Хуудсыг дахин ачаална уу.")).toBeInTheDocument());
    expect(threeHarness.rendererDisposals).toBe(1);
  });
});
