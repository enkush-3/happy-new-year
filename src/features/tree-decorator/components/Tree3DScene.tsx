import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OrnamentKind, TreeDecoration, TreeDesign } from "../model/tree-state";
import "../tree-3d.css";

type ThreeModule = typeof import("three");
type Placement = { x: number; y: number; angle: number };
type OrnamentDrag = { id: string; point: Placement; startX: number; startY: number; moved: boolean };
const ornamentDragThreshold = 6;

interface Runtime {
  THREE: ThreeModule;
  renderer: import("three").WebGLRenderer;
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  treeRoot: import("three").Group;
  treeSurfaces: import("three").Mesh[];
  ornaments: Map<string, import("three").Mesh>;
  raycaster: import("three").Raycaster;
  pointer: import("three").Vector2;
}

interface Tree3DSceneProps {
  design: TreeDesign;
  selectedDecorationId: string | null;
  selectedKind: OrnamentKind | null;
  viewMode: "edit" | "orbit";
  fallback: ReactNode;
  onPlace: (kind: OrnamentKind, point: Placement) => void;
  onMove: (id: string, point: Placement) => void;
  onMoveCommit: () => void;
  onSelect: (id: string) => void;
  onCanvas: (canvas: HTMLCanvasElement | null) => void;
}

const twoPi = Math.PI * 2;

export default function Tree3DScene({
  design,
  selectedDecorationId,
  selectedKind,
  viewMode,
  fallback,
  onPlace,
  onMove,
  onMoveCommit,
  onSelect,
  onCanvas,
}: Tree3DSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const propsRef = useRef({ design, selectedDecorationId, selectedKind, viewMode, onPlace, onMove, onMoveCommit, onSelect });
  const dragRef = useRef<OrnamentDrag | null>(null);
  const orbitRef = useRef<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  propsRef.current = { design, selectedDecorationId, selectedKind, viewMode, onPlace, onMove, onMoveCommit, onSelect };

  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let runtime: Runtime | null = null;
    let lastFrame = 0;
    const host = hostRef.current;
    if (!host) return;

    async function mountScene() {
      try {
        if (typeof window.WebGLRenderingContext === "undefined") {
          setStatus("fallback");
          return;
        }
        const THREE = await import("three");
        if (!mounted || !host) return;
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
          preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.className = "tree-3d-canvas";
        host.append(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
        camera.position.set(0, 0.65, 5.6);
        camera.lookAt(0, 0.25, 0);
        scene.add(new THREE.HemisphereLight(0xd8e9ff, 0x142417, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffe4b2, 3.1);
        keyLight.position.set(-3, 4, 5);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0x9edbff, 8, 8);
        rimLight.position.set(2, 1, -2);
        scene.add(rimLight);

        const treeRoot = new THREE.Group();
        scene.add(treeRoot);
        const treeSurfaces: import("three").Mesh[] = [];
        const tierMaterial = new THREE.MeshStandardMaterial({ color: 0x286847, roughness: 0.82, flatShading: true });
        const shadowMaterial = new THREE.MeshStandardMaterial({ color: 0x174732, roughness: 0.94, flatShading: true });
        const tiers = [
          { radius: 0.53, height: 0.88, y: 0.25 },
          { radius: 0.76, height: 1.02, y: -0.16 },
          { radius: 0.98, height: 1.14, y: -0.57 },
        ];
        tiers.forEach((tier, index) => {
          const mesh = new THREE.Mesh(
            new THREE.ConeGeometry(tier.radius, tier.height, 9, 1),
            index === 1 ? tierMaterial : shadowMaterial,
          );
          mesh.position.y = tier.y;
          mesh.rotation.y = index * 0.18;
          mesh.userData.treeSurface = true;
          treeRoot.add(mesh);
          treeSurfaces.push(mesh);
        });
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.19, 0.57, 7),
          new THREE.MeshStandardMaterial({ color: 0x855b39, roughness: 0.95 }),
        );
        trunk.position.y = -1.05;
        treeRoot.add(trunk);
        const topper = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.19, 0),
          new THREE.MeshStandardMaterial({ color: 0xffd978, emissive: 0x8d5d15, emissiveIntensity: 0.7, metalness: 0.35, roughness: 0.28 }),
        );
        topper.position.set(0, 0.93, 0);
        topper.rotation.y = Math.PI / 4;
        treeRoot.add(topper);

        for (let row = 0; row < 3; row += 1) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.46 + row * 0.22, 0.018, 4, 24),
            new THREE.MeshStandardMaterial({ color: 0xe3bd67, emissive: 0x5c3d0d, emissiveIntensity: 0.32, roughness: 0.4 }),
          );
          ring.rotation.x = Math.PI / 2;
          ring.scale.x = 0.8;
          ring.position.y = 0.22 - row * 0.48;
          treeRoot.add(ring);
        }
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(1.18, 24),
          new THREE.MeshStandardMaterial({ color: 0xb8d2e8, roughness: 1, transparent: true, opacity: 0.17 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1.36;
        treeRoot.add(ground);

        const raycaster = new THREE.Raycaster();
        runtime = { THREE, renderer, scene, camera, treeRoot, treeSurfaces, ornaments: new Map(), raycaster, pointer: new THREE.Vector2() };
        runtimeRef.current = runtime;
        syncDecorations(runtime, propsRef.current.design, propsRef.current.selectedDecorationId);
        resizeRenderer(renderer, camera, host);
        resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resizeRenderer(renderer, camera, host)) : null;
        resizeObserver?.observe(host);
        if (!resizeObserver) window.addEventListener("resize", onResize);
        onCanvas(renderer.domElement);
        setStatus("ready");

        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const animate = (time: number) => {
          if (!mounted || document.visibilityState === "hidden") return;
          if (time - lastFrame < 33) return;
          lastFrame = time;
          if (!reducedMotion && !dragRef.current && !orbitRef.current) treeRoot.rotation.y += 0.0015;
          renderer.render(scene, camera);
        };
        renderer.setAnimationLoop(reducedMotion ? null : animate);
        if (reducedMotion) renderer.render(scene, camera);
        document.addEventListener("visibilitychange", onVisibilityChange);
      } catch {
        if (mounted) setStatus("fallback");
      }
    }

    function onResize() {
      if (!runtime || !host) return;
      resizeRenderer(runtime.renderer, runtime.camera, host);
      runtime.renderer.render(runtime.scene, runtime.camera);
    }

    function onVisibilityChange() {
      if (!runtime) return;
      if (document.visibilityState === "hidden") {
        runtime.renderer.setAnimationLoop(null);
      } else if (!(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)) {
        runtime.renderer.setAnimationLoop((time) => {
          if (time - lastFrame < 33) return;
          lastFrame = time;
          if (!dragRef.current && !orbitRef.current) runtime?.treeRoot && (runtime.treeRoot.rotation.y += 0.0015);
          runtime?.renderer.render(runtime.scene, runtime.camera);
        });
      } else {
        runtime.renderer.render(runtime.scene, runtime.camera);
      }
    }

    void mountScene();
    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const activeRuntime = runtimeRef.current;
      if (activeRuntime) {
        activeRuntime.renderer.setAnimationLoop(null);
        disposeRuntime(activeRuntime);
        activeRuntime.renderer.dispose();
        activeRuntime.renderer.domElement.remove();
      }
      runtimeRef.current = null;
      onCanvas(null);
    };
  }, [onCanvas]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    syncDecorations(runtime, design, selectedDecorationId);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [design, selectedDecorationId]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    if (!runtime || !canvas) return;
    if (propsRef.current.viewMode === "orbit") {
      orbitRef.current = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
      return;
    }

    const intersections = intersectAt(event.clientX, event.clientY, runtime, canvas);
    const ornamentHit = intersections.find((hit) => typeof hit.object.userData.decorationId === "string");
    if (ornamentHit) {
      const id = ornamentHit.object.userData.decorationId as string;
      propsRef.current.onSelect(id);
      dragRef.current = {
        id,
        point: pointOnTree(intersections, runtime) ?? { x: 0.5, y: 0.5, angle: 0.5 },
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      canvas.setPointerCapture?.(event.pointerId);
      return;
    }

    const point = pointOnTree(intersections, runtime);
    if (point && propsRef.current.selectedKind) propsRef.current.onPlace(propsRef.current.selectedKind, point);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    if (!runtime || !canvas) return;
    if (orbitRef.current) {
      const deltaX = event.clientX - orbitRef.current.x;
      const deltaY = event.clientY - orbitRef.current.y;
      orbitRef.current = { x: event.clientX, y: event.clientY };
      runtime.treeRoot.rotation.y += deltaX * 0.008;
      runtime.treeRoot.rotation.x = clamp(runtime.treeRoot.rotation.x + deltaY * 0.004, -0.28, 0.32);
      runtime.renderer.render(runtime.scene, runtime.camera);
      return;
    }
    const drag = dragRef.current;
    if (!drag || (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < ornamentDragThreshold)) return;
    const point = pointOnTree(intersectAt(event.clientX, event.clientY, runtime, canvas), runtime);
    if (!point) return;
    drag.moved = true;
    drag.point = point;
    const ornament = runtime.ornaments.get(drag.id);
    if (ornament) ornament.position.copy(positionForDecoration(point, runtime.THREE, 1));
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    const drag = dragRef.current;
    if (runtime && canvas && drag && !drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= ornamentDragThreshold) {
      onPointerMove(event);
    }
    const finishedDrag = dragRef.current;
    if (finishedDrag?.moved) {
      propsRef.current.onMove(finishedDrag.id, finishedDrag.point);
      propsRef.current.onMoveCommit();
    }
    dragRef.current = null;
    orbitRef.current = null;
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!runtimeRef.current) return;
    const selectedId = propsRef.current.selectedDecorationId;
    if (!selectedId) return;
    const current = propsRef.current.design.decorations.find((item) => item.id === selectedId);
    if (!current) return;
    const nudge = 0.025;
    const angles: Record<string, number> = { ArrowLeft: -nudge, ArrowRight: nudge };
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const point = event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? { x: current.x, y: current.y, angle: current.angle + angles[event.key] }
        : { x: current.x, y: clamp(current.y + (event.key === "ArrowUp" ? -nudge : nudge), 0.16, 0.82), angle: current.angle };
      propsRef.current.onMove(selectedId, point);
      propsRef.current.onMoveCommit();
    }
  }

  return (
    <div
      ref={hostRef}
      className={`tree-3d-shell${viewMode === "orbit" ? " is-orbiting" : ""}`}
      role="group"
      aria-label="3D гацуурыг засах"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {status !== "ready" && <div className="tree-3d-fallback">{fallback}</div>}
      {status === "loading" && <p className="tree-3d-status" role="status">3D модыг бэлдэж байна…</p>}
      {status === "fallback" && <p className="tree-3d-status" role="status">Энэ төхөөрөмжид 3D дүрслэл боломжгүй байна. 2D урланг үргэлжлүүлэн ашиглаарай.</p>}
      {status === "ready" && (
        <span className="tree-3d-instructions" aria-live="polite">
          {viewMode === "orbit" ? "Чирж модыг эргүүлж харна." : "Модон дээр товшиж чимэглэл нэмэх эсвэл чимэглэлээ чирж байрлуулна."}
        </span>
      )}
    </div>
  );
}

function resizeRenderer(renderer: import("three").WebGLRenderer, camera: import("three").PerspectiveCamera, host: HTMLElement) {
  const { width, height } = host.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function syncDecorations(runtime: Runtime, design: TreeDesign, selectedId: string | null) {
  for (const mesh of runtime.ornaments.values()) {
    runtime.treeRoot.remove(mesh);
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  }
  runtime.ornaments.clear();
  design.decorations.forEach((decoration) => {
    const mesh = createOrnamentMesh(decoration, runtime.THREE);
    mesh.position.copy(positionForDecoration(decoration, runtime.THREE));
    mesh.userData.decorationId = decoration.id;
    if (decoration.id === selectedId && mesh.material instanceof runtime.THREE.MeshStandardMaterial) {
      mesh.material.emissive.set(0x5a3d13);
      mesh.material.emissiveIntensity = 0.45;
    }
    runtime.treeRoot.add(mesh);
    runtime.ornaments.set(decoration.id, mesh);
  });
}

function createOrnamentMesh(decoration: TreeDecoration, THREE: ThreeModule): import("three").Mesh {
  let geometry: import("three").BufferGeometry;
  switch (decoration.kind) {
    case "star":
      geometry = new THREE.OctahedronGeometry(0.12, 0);
      break;
    case "candy-cane":
      geometry = new THREE.TorusGeometry(0.09, 0.035, 5, 12, Math.PI * 1.65);
      break;
    default:
      geometry = new THREE.SphereGeometry(0.105, 10, 8);
      break;
  }
  const material = new THREE.MeshStandardMaterial({
    color: decoration.color,
    emissive: decoration.color,
    emissiveIntensity: 0.1,
    metalness: decoration.kind === "bauble-gold" || decoration.kind === "star" ? 0.4 : 0.12,
    roughness: 0.34,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(decoration.scale);
  mesh.rotation.z = decoration.rotation * Math.PI / 180;
  return mesh;
}

function positionForDecoration(point: Placement | TreeDecoration, THREE: ThreeModule, scale = 1) {
  const yRatio = clamp((point.y - 0.16) / 0.66, 0, 1);
  const angle = point.angle * twoPi;
  const radius = 0.94 * yRatio + 0.035;
  return new THREE.Vector3(Math.sin(angle) * radius, 1.08 - yRatio * 2.36, Math.cos(angle) * radius).multiplyScalar(scale);
}

function intersectAt(clientX: number, clientY: number, runtime: Runtime, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  runtime.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
  return runtime.raycaster.intersectObjects([...runtime.ornaments.values(), ...runtime.treeSurfaces], false);
}

function pointOnTree(intersections: import("three").Intersection[], runtime: Runtime): Placement | null {
  const hit = intersections.find((intersection) => intersection.object.userData.treeSurface === true);
  if (!hit) return null;
  const local = runtime.treeRoot.worldToLocal(hit.point.clone());
  const angle = ((Math.atan2(local.x, local.z) / twoPi) + 1) % 1;
  const y = clamp(0.16 + ((1.08 - local.y) / 2.36) * 0.66, 0.16, 0.82);
  const x = clamp(0.5 + Math.sin(angle * twoPi) * 0.34, 0.16, 0.84);
  return { x, y, angle: Math.round(angle * 1000) / 1000 };
}

function disposeRuntime(runtime: Runtime) {
  runtime.scene.traverse((object) => {
    const mesh = object as import("three").Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
