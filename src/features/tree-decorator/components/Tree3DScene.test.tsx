import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tree3DScene from "./Tree3DScene";
import { DEFAULT_TREE_DESIGN, moveDecoration, type TreeDesign } from "../model/tree-state";

const threeHarness = vi.hoisted(() => ({ intersections: [] as any[], camera: null as any, meshCount: 0, meshes: [] as any[], failSceneAdd: false, rendererDisposals: 0 }));

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
  class Material {
    emissive = { set() {} };
    emissiveIntensity = 0;
    constructor(public options: Record<string, unknown> = {}) {}
    dispose() {}
  }
  class Group {
    children: any[] = [];
    rotation = { x: 0, y: 0, z: 0 };
    position = new Vector3();
    userData: Record<string, unknown> = {};
    add(child: any) {
      if (threeHarness.failSceneAdd) throw new Error("Scene initialization failed");
      this.children.push(child);
    }
    remove(child: any) { this.children = this.children.filter((item) => item !== child); }
    worldToLocal(point: any) { return point; }
    traverse(callback: (object: any) => void) {
      callback(this);
      this.children.forEach((child) => child.traverse ? child.traverse(callback) : callback(child));
    }
  }
  class Mesh extends Group {
    isMesh = true;
    scale = { setScalar() {} };
    constructor(public geometry: Geometry, public material: Material) {
      super();
      threeHarness.meshCount += 1;
      threeHarness.meshes.push(this);
    }
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
    setAnimationLoop() {}
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

const testDesign: TreeDesign = {
  ...DEFAULT_TREE_DESIGN,
  decorations: [{
    id: "test-ball", kind: "bauble-red", x: 0.5, y: 0.5, angle: 0.5,
    rotation: 0, scale: 1, color: "#d96b5e",
  }],
};

function renderEditor(viewMode: "edit" | "orbit" = "edit") {
  let design = testDesign;
  let pending: TreeDesign | null = null;
  const history: TreeDesign[] = [];
  const move = vi.fn((id: string, point: { x: number; y: number; angle: number }) => {
    pending ??= design;
    design = moveDecoration(design, id, point.x, point.y, point.angle);
  });
  const commit = vi.fn(() => {
    if (!pending) return;
    history.push(pending);
    pending = null;
  });
  const select = vi.fn();
  const view = render(
    <Tree3DScene
      design={testDesign}
      selectedDecorationId="test-ball"
      selectedKind={null}
      viewMode={viewMode}
      cameraViewRef={{ current: { azimuth: 0, elevation: 0.07, distance: 5.6 } }}
      fallback={<div>fallback</div>}
      onPlace={vi.fn()}
      onMove={move}
      onMoveCommit={commit}
      onSelect={select}
      onCanvas={(canvas) => {
        if (canvas) {
          vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
            x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 560, width: 400, height: 560,
            toJSON: () => ({}),
          } as DOMRect);
        }
      }}
    />,
  );
  return { ...view, move, commit, select, getDesign: () => design, history };
}

describe("Tree3DScene ornament gestures", () => {
  beforeEach(() => {
    threeHarness.camera = null;
    threeHarness.meshCount = 0;
    threeHarness.meshes = [];
    threeHarness.failSceneAdd = false;
    threeHarness.rendererDisposals = 0;
    threeHarness.intersections = [
      { object: { userData: { decorationId: "test-ball" } }, point: { x: 0, y: 0, z: 0 } },
      {
        object: { userData: { treeSurface: true } },
        point: { x: 0.4, y: 0, z: 0.4, clone() { return { x: this.x, y: this.y, z: this.z }; } },
      },
    ];
    Object.defineProperty(window, "WebGLRenderingContext", { configurable: true, value: class {} });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "WebGLRenderingContext");
  });

  it("selects a tap without changing the design or creating undo history", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(screen.getByText("Модон дээр товшиж чимэглэл нэмэх эсвэл чимэглэлээ чирж байрлуулна.")).toBeInTheDocument());
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });

    fireEvent.pointerDown(host, { pointerId: 5, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(host, { pointerId: 5, clientX: 100, clientY: 100 });

    expect(editor.select).toHaveBeenCalledWith("test-ball");
    expect(editor.move).not.toHaveBeenCalled();
    expect(editor.commit).not.toHaveBeenCalled();
    expect(editor.getDesign()).toEqual(testDesign);
    expect(editor.history).toHaveLength(0);
  });

  it("commits one undoable design change after a real ornament drag", async () => {
    const editor = renderEditor();
    await waitFor(() => expect(screen.getByText("Модон дээр товшиж чимэглэл нэмэх эсвэл чимэглэлээ чирж байрлуулна.")).toBeInTheDocument());
    const host = screen.getByRole("group", { name: "3D гацуурыг засах" });

    fireEvent.pointerDown(host, { pointerId: 6, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(host, { pointerId: 6, clientX: 150, clientY: 145 });
    fireEvent.pointerUp(host, { pointerId: 6, clientX: 150, clientY: 145 });

    expect(editor.move).toHaveBeenCalledTimes(1);
    expect(editor.commit).toHaveBeenCalledTimes(1);
    expect(editor.getDesign()).not.toEqual(testDesign);
    expect(editor.history).toEqual([testDesign]);
  });

  it("uses scroll gestures to orbit and zoom without an on-screen arrow pad", async () => {
    const editor = renderEditor("orbit");
    await waitFor(() => expect(editor.container.querySelector(".tree-3d-canvas")).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг харах" });
    const frontZ = threeHarness.camera.position.z;

    expect(screen.getByText(/touchpad-аа хажуу тийш гүйлгэж эргүүлнэ/i)).toBeInTheDocument();
    expect(editor.container.querySelector(".tree-3d-view-controls")).toBeNull();
    const verticalWheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -80 });
    host.dispatchEvent(verticalWheel);
    expect(verticalWheel.defaultPrevented).toBe(true);
    expect(threeHarness.camera.position.z).toBeLessThan(frontZ);

    fireEvent.wheel(host, { deltaX: 80, deltaY: 0 });
    expect(threeHarness.camera.position.x).not.toBeCloseTo(0);

    const previousHeight = threeHarness.camera.position.y;
    fireEvent.wheel(host, { deltaY: 80, shiftKey: true });
    expect(threeHarness.camera.position.y).not.toBeCloseTo(previousHeight);

    host.focus();
    fireEvent.keyDown(host, { key: "Home" });
    expect(threeHarness.camera.position.x).toBeCloseTo(0);
    expect(threeHarness.camera.position.z).toBeCloseTo(frontZ);
  });

  it("lets keyboard users change the 3D view without changing ornaments", async () => {
    const editor = renderEditor("orbit");
    await waitFor(() => expect(editor.container.querySelector(".tree-3d-canvas")).not.toBeNull());
    const host = screen.getByRole("group", { name: "3D гацуурыг харах" });
    const initialPosition = { ...threeHarness.camera.position };

    host.focus();
    fireEvent.keyDown(host, { key: "ArrowRight" });
    fireEvent.keyDown(host, { key: "ArrowUp" });

    expect(threeHarness.camera.position.x).not.toBeCloseTo(initialPosition.x);
    expect(threeHarness.camera.position.y).not.toBeCloseTo(initialPosition.y);
    expect(editor.move).not.toHaveBeenCalled();
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it("builds a visibly layered tree with branch and light details", async () => {
    renderEditor();
    await waitFor(() => expect(screen.getByText("Модон дээр товшиж чимэглэл нэмэх эсвэл чимэглэлээ чирж байрлуулна.")).toBeInTheDocument());

    expect(threeHarness.meshCount).toBeGreaterThan(40);
  });

  it("gives each light bulb its own material so their twinkles can differ", async () => {
    renderEditor();
    await waitFor(() => expect(screen.getByText("Модон дээр товшиж чимэглэл нэмэх эсвэл чимэглэлээ чирж байрлуулна.")).toBeInTheDocument());
    const bulbs = threeHarness.meshes.filter((mesh) => typeof mesh.userData.twinklePhase === "number");

    expect(bulbs).toHaveLength(24);
    expect(new Set(bulbs.map((bulb) => bulb.material)).size).toBe(24);
  });

  it("disposes a renderer when scene setup fails before runtime registration", async () => {
    threeHarness.failSceneAdd = true;
    const editor = renderEditor();

    await waitFor(() => expect(screen.getByText("fallback")).toBeInTheDocument());

    expect(editor.container.querySelector(".tree-3d-canvas")).toBeNull();
    expect(threeHarness.rendererDisposals).toBe(1);
  });
});
