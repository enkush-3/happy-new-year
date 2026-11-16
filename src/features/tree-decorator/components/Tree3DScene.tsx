import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OrnamentKind, TreeDecoration, TreeDesign } from "../model/tree-state";
import "../tree-3d.css";

type ThreeModule = typeof import("three");
export type TreeCameraView = { azimuth: number; elevation: number; distance: number };
export type TreePlacement = { x: number; y: number; angle: number; radius: number };
export interface TreeExportControls { setMarkersVisible: (visible: boolean) => void }
type OrnamentDrag = { id: string; point: TreePlacement; startX: number; startY: number; moved: boolean };
type OrbitPointer = { x: number; y: number };
type OrbitGesture = { pointers: Map<number, OrbitPointer>; center: OrbitPointer; distance: number; time: number };

export const defaultTreeCameraView: TreeCameraView = { azimuth: 0, elevation: 0.07, distance: 5.4 };
const twoPi = Math.PI * 2;
const ornamentDragThreshold = 6;
const treeModelUrl = "/assets/tree/christmas-tree.glb";
const treeMinimumY = -1.22;
const treeHeight = 2.4;
const treeMaximumRadius = 0.63;

interface Runtime {
  THREE: ThreeModule;
  renderer: import("three").WebGLRenderer;
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  treeRoot: import("three").Group;
  treeSurfaces: import("three").Mesh[];
  ornaments: Map<string, import("three").Group>;
  fairyLights: import("three").Mesh[];
  lightStrand: import("three").Group;
  ghost: import("three").Mesh | null;
  ghostKind: OrnamentKind | null;
  orbit: TreeCameraView;
  orbitVelocity: { azimuth: number; elevation: number };
  target: import("three").Vector3;
  raycaster: import("three").Raycaster;
  pointer: import("three").Vector2;
}

interface Tree3DSceneProps {
  design: TreeDesign;
  selectedDecorationId: string | null;
  selectedKind: OrnamentKind | null;
  viewMode: "edit" | "orbit";
  cameraViewRef: MutableRefObject<TreeCameraView>;
  onExportRoot: (root: import("three").Object3D | null) => void;
  onPlace: (kind: OrnamentKind, point: TreePlacement) => void;
  onMove: (id: string, point: TreePlacement) => void;
  onMoveCommit: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function Tree3DScene({
  design,
  selectedDecorationId,
  selectedKind,
  viewMode,
  cameraViewRef,
  onExportRoot,
  onPlace,
  onMove,
  onMoveCommit,
  onSelect,
  onRemove,
}: Tree3DSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const propsRef = useRef({ design, selectedDecorationId, selectedKind, viewMode, onPlace, onMove, onMoveCommit, onSelect, onRemove });
  const dragRef = useRef<OrnamentDrag | null>(null);
  const orbitRef = useRef<OrbitGesture | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  propsRef.current = { design, selectedDecorationId, selectedKind, viewMode, onPlace, onMove, onMoveCommit, onSelect, onRemove };

  useEffect(() => {
    if (viewMode !== "orbit") {
      orbitRef.current = null;
      const runtime = runtimeRef.current;
      if (runtime) runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    }
  }, [viewMode]);

  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let runtime: Runtime | null = null;
    let partialRenderer: import("three").WebGLRenderer | null = null;
    let partialScene: import("three").Scene | null = null;
    let lastFrame = 0;
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let prefersReducedMotion = motionQuery?.matches ?? false;
    const host = hostRef.current;
    if (!host) return;
    host.addEventListener("wheel", onOrbitWheel, { passive: false });

    function animateFrame(time: number) {
      if (!mounted || !runtime || document.visibilityState === "hidden") return;
      if (lastFrame && time - lastFrame < 16) return;
      const deltaSeconds = lastFrame ? Math.min((time - lastFrame) / 1_000, 0.1) : 0;
      lastFrame = time;
      if (!prefersReducedMotion) {
        if (propsRef.current.viewMode === "orbit" && !orbitRef.current) {
          const damping = Math.exp(-5.2 * deltaSeconds);
          if (Math.abs(runtime.orbitVelocity.azimuth) > 0.000002 || Math.abs(runtime.orbitVelocity.elevation) > 0.000002) {
            runtime.orbit.azimuth += runtime.orbitVelocity.azimuth * deltaSeconds * 1_000;
            runtime.orbit.elevation = clamp(runtime.orbit.elevation + runtime.orbitVelocity.elevation * deltaSeconds * 1_000, -0.36, 0.82);
            runtime.orbitVelocity.azimuth *= damping;
            runtime.orbitVelocity.elevation *= damping;
            cameraViewRef.current = { ...runtime.orbit };
            updateOrbitCamera(runtime);
          } else {
            runtime.orbitVelocity.azimuth = 0;
            runtime.orbitVelocity.elevation = 0;
          }
        }
        runtime.ornaments.forEach((hanger) => {
          const phase = Number(hanger.userData.hangPhase ?? 0);
          hanger.rotation.z = Math.sin(time * 0.0015 + phase) * 0.035;
        });
        updateLightMaterials(runtime, propsRef.current.design, time);
      }
      runtime.renderer.render(runtime.scene, runtime.camera);
    }

    function onMotionPreferenceChange(event: MediaQueryListEvent) {
      prefersReducedMotion = event.matches;
      if (!runtime) return;
      runtime.renderer.setAnimationLoop(prefersReducedMotion || document.visibilityState === "hidden" ? null : animateFrame);
      runtime.renderer.render(runtime.scene, runtime.camera);
    }

    async function mountScene() {
      try {
        if (typeof window.WebGLRenderingContext === "undefined") {
          setStatus("fallback");
          return;
        }
        const THREE = await import("three");
        if (!mounted || !host) return;
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
        partialRenderer = renderer;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.className = "tree-3d-canvas";
        host.append(renderer.domElement);

        const scene = new THREE.Scene();
        partialScene = scene;
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
        scene.add(new THREE.HemisphereLight(0xd8e9ff, 0x142417, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffe4b2, 3.1);
        keyLight.position.set(-3, 4, 5);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0x9edbff, 8, 8);
        rimLight.position.set(2, 1, -2);
        scene.add(rimLight);

        const treeRoot = new THREE.Group();
        scene.add(treeRoot);
        const lightStrand = createLightStrand(THREE);
        treeRoot.add(lightStrand);
        const raycaster = new THREE.Raycaster();
        runtime = {
          THREE, renderer, scene, camera, treeRoot, treeSurfaces: [], ornaments: new Map(),
          fairyLights: lightStrand.children.filter((child) => (child as import("three").Mesh).isMesh) as import("three").Mesh[],
          lightStrand, ghost: null, ghostKind: null,
          orbit: { ...cameraViewRef.current }, orbitVelocity: { azimuth: 0, elevation: 0 },
          target: new THREE.Vector3(0, 0.02, 0), raycaster, pointer: new THREE.Vector2(),
        };
        runtimeRef.current = runtime;
        partialRenderer = null;
        partialScene = null;

        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(treeModelUrl);
        if (!mounted || !runtime) {
          disposeObject(gltf.scene);
          return;
        }
        const model = gltf.scene;
        model.scale.setScalar(0.227);
        model.position.set(0, treeMinimumY + 0.014, -0.014);
        model.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          if (/light|bulb|wire/i.test(mesh.name)) mesh.visible = false;
          mesh.userData.treeSurface = /^(circle)(\.|$)/iu.test(mesh.name);
          if (mesh.userData.treeSurface) runtime!.treeSurfaces.push(mesh);
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            if ("roughness" in material) (material as import("three").MeshStandardMaterial).roughness = Math.max(0.48, (material as import("three").MeshStandardMaterial).roughness || 0.7);
          });
        });
        if (runtime.treeSurfaces.length === 0) {
          model.traverse((object) => {
            const mesh = object as import("three").Mesh;
            if (mesh.isMesh) { mesh.userData.treeSurface = true; runtime!.treeSurfaces.push(mesh); }
          });
        }
        treeRoot.add(model);
        addGroundAccents(treeRoot, THREE);
        runtimeRef.current = runtime;
        syncDecorations(runtime, propsRef.current.design, propsRef.current.selectedDecorationId);
        syncGhost(runtime, propsRef.current.selectedKind);
        updateLightMaterials(runtime, propsRef.current.design, performance.now());
        resizeRenderer(renderer, camera, host);
        resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resizeRenderer(renderer, camera, host)) : null;
        resizeObserver?.observe(host);
        if (!resizeObserver) window.addEventListener("resize", onResize);
        onExportRoot(treeRoot);
        setStatus("ready");
        updateOrbitCamera(runtime);
        renderer.setAnimationLoop(prefersReducedMotion ? null : animateFrame);
        renderer.render(scene, camera);
        document.addEventListener("visibilitychange", onVisibilityChange);
        motionQuery?.addEventListener("change", onMotionPreferenceChange);
      } catch {
        resizeObserver?.disconnect();
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        motionQuery?.removeEventListener("change", onMotionPreferenceChange);
        if (runtime) {
          runtime.renderer.setAnimationLoop(null);
          disposeRuntime(runtime);
          runtime.renderer.dispose();
          runtime.renderer.domElement.remove();
          if (runtimeRef.current === runtime) runtimeRef.current = null;
          runtime = null;
        } else {
          if (partialScene) disposeScene(partialScene);
          if (partialRenderer) { partialRenderer.setAnimationLoop(null); partialRenderer.dispose(); partialRenderer.domElement.remove(); }
        }
        partialScene = null;
        partialRenderer = null;
        onExportRoot(null);
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
      if (document.visibilityState === "hidden") runtime.renderer.setAnimationLoop(null);
      else if (!prefersReducedMotion) runtime.renderer.setAnimationLoop(animateFrame);
      else runtime.renderer.render(runtime.scene, runtime.camera);
    }

    void mountScene();
    return () => {
      mounted = false;
      host.removeEventListener("wheel", onOrbitWheel);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery?.removeEventListener("change", onMotionPreferenceChange);
      const activeRuntime = runtimeRef.current;
      if (activeRuntime) {
        activeRuntime.renderer.setAnimationLoop(null);
        disposeRuntime(activeRuntime);
        activeRuntime.renderer.dispose();
        activeRuntime.renderer.domElement.remove();
      }
      runtimeRef.current = null;
      onExportRoot(null);
    };
  }, [cameraViewRef, onExportRoot]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    syncDecorations(runtime, design, selectedDecorationId);
    syncGhost(runtime, selectedKind);
    updateLightMaterials(runtime, design, performance.now());
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [design, selectedDecorationId, selectedKind]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    if (!runtime || !canvas || event.button !== 0) return;
    if (propsRef.current.viewMode === "orbit") {
      runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
      const gesture = orbitRef.current ?? { pointers: new Map<number, OrbitPointer>(), center: { x: event.clientX, y: event.clientY }, distance: 0, time: event.timeStamp };
      gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const metrics = orbitMetrics(gesture.pointers);
      gesture.center = metrics.center;
      gesture.distance = metrics.distance;
      gesture.time = event.timeStamp;
      orbitRef.current = gesture;
      canvas.setPointerCapture?.(event.pointerId);
      return;
    }

    const intersections = intersectAt(event.clientX, event.clientY, runtime, canvas);
    const ornamentHit = intersections.find((hit) => typeof hit.object.userData.decorationId === "string");
    if (ornamentHit) {
      const id = ornamentHit.object.userData.decorationId as string;
      propsRef.current.onSelect(id);
      dragRef.current = { id, point: pointOnTree(intersections, runtime) ?? pointFromDecoration(propsRef.current.design.decorations.find((item) => item.id === id)!), startX: event.clientX, startY: event.clientY, moved: false };
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
      const gesture = orbitRef.current;
      if (!gesture.pointers.has(event.pointerId)) return;
      gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const metrics = orbitMetrics(gesture.pointers);
      const deltaX = metrics.center.x - gesture.center.x;
      const deltaY = metrics.center.y - gesture.center.y;
      const deltaTime = Math.max(8, event.timeStamp - gesture.time);
      const azimuthDelta = -deltaX * 0.008;
      const elevationDelta = deltaY * 0.006;
      runtime.orbit.azimuth += azimuthDelta;
      runtime.orbit.elevation = clamp(runtime.orbit.elevation + elevationDelta, -0.36, 0.82);
      runtime.orbitVelocity = { azimuth: clamp((azimuthDelta / deltaTime) * 0.52, -0.006, 0.006), elevation: clamp((elevationDelta / deltaTime) * 0.52, -0.004, 0.004) };
      if (gesture.pointers.size > 1 && gesture.distance > 0 && metrics.distance > 0) {
        runtime.orbit.distance = clamp(runtime.orbit.distance + clamp((gesture.distance - metrics.distance) * 0.012, -0.45, 0.45), 4, 7.4);
      }
      gesture.center = metrics.center;
      gesture.distance = metrics.distance;
      gesture.time = event.timeStamp;
      cameraViewRef.current = { ...runtime.orbit };
      updateOrbitCamera(runtime);
      runtime.renderer.render(runtime.scene, runtime.camera);
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < ornamentDragThreshold) return;
      const point = pointOnTree(intersectAt(event.clientX, event.clientY, runtime, canvas), runtime);
      if (!point) return;
      drag.moved = true;
      drag.point = point;
      const hanger = runtime.ornaments.get(drag.id);
      if (hanger) hanger.position.copy(positionForDecoration(point, runtime.THREE));
      runtime.renderer.render(runtime.scene, runtime.camera);
      return;
    }

    if (propsRef.current.selectedKind) {
      const point = pointOnTree(intersectAt(event.clientX, event.clientY, runtime, canvas), runtime);
      if (runtime.ghost) runtime.ghost.visible = Boolean(point);
      if (runtime.ghost && point) runtime.ghost.position.copy(positionForDecoration(point, runtime.THREE));
      runtime.renderer.render(runtime.scene, runtime.camera);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    if (propsRef.current.viewMode === "orbit") {
      const gesture = orbitRef.current;
      const pointer = gesture?.pointers.get(event.pointerId);
      if (pointer && (pointer.x !== event.clientX || pointer.y !== event.clientY)) onPointerMove(event);
      if (gesture) {
        gesture.pointers.delete(event.pointerId);
        if (gesture.pointers.size === 0) orbitRef.current = null;
        else {
          const metrics = orbitMetrics(gesture.pointers);
          gesture.center = metrics.center;
          gesture.distance = metrics.distance;
          gesture.time = event.timeStamp;
          if (runtime) runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
        }
      }
      return;
    }
    const drag = dragRef.current;
    if (runtime && canvas && drag && !drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= ornamentDragThreshold) onPointerMove(event);
    if (dragRef.current?.moved) {
      propsRef.current.onMove(dragRef.current.id, dragRef.current.point);
      propsRef.current.onMoveCommit();
    }
    dragRef.current = null;
    orbitRef.current = null;
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (propsRef.current.viewMode === "orbit") {
      const gesture = orbitRef.current;
      gesture?.pointers.delete(event.pointerId);
      if (!gesture || gesture.pointers.size === 0) orbitRef.current = null;
      else {
        const metrics = orbitMetrics(gesture.pointers);
        gesture.center = metrics.center;
        gesture.distance = metrics.distance;
        gesture.time = event.timeStamp;
      }
      if (runtimeRef.current) runtimeRef.current.orbitVelocity = { azimuth: 0, elevation: 0 };
      return;
    }
    if (dragRef.current?.moved && runtimeRef.current) {
      syncDecorations(runtimeRef.current, propsRef.current.design, propsRef.current.selectedDecorationId);
      runtimeRef.current.renderer.render(runtimeRef.current.scene, runtimeRef.current.camera);
    }
    dragRef.current = null;
    orbitRef.current = null;
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    if (!runtime || event.target !== event.currentTarget) return;
    if (propsRef.current.viewMode === "orbit") {
      const orbitSteps: Record<string, [number, number]> = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] };
      const step = orbitSteps[event.key];
      if (step) { event.preventDefault(); runtime.orbitVelocity = { azimuth: 0, elevation: 0 }; runtime.orbit.azimuth += step[0]; runtime.orbit.elevation = clamp(runtime.orbit.elevation + step[1], -0.36, 0.82); cameraViewRef.current = { ...runtime.orbit }; updateOrbitCamera(runtime); runtime.renderer.render(runtime.scene, runtime.camera); }
      else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomCamera(-0.35); }
      else if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomCamera(0.35); }
      else if (event.key === "Home") { event.preventDefault(); resetCamera(); }
      return;
    }

    const selectedId = propsRef.current.selectedDecorationId;
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!selectedId) return;
      event.preventDefault();
      propsRef.current.onRemove(selectedId);
      return;
    }
    if (!selectedId) return;
    const current = propsRef.current.design.decorations.find((item) => item.id === selectedId);
    if (!current) return;
    const nudge = 0.025;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowLeft" || event.key === "ArrowRight"
      ? { ...current, angle: current.angle + (event.key === "ArrowLeft" ? -nudge : nudge) }
      : { ...current, y: clamp(current.y + (event.key === "ArrowUp" ? -nudge : nudge), 0.16, 0.82) };
    const point = { x: next.x, y: next.y, angle: next.angle, radius: next.radius };
    propsRef.current.onMove(selectedId, point);
    propsRef.current.onMoveCommit();
  }

  function zoomCamera(distanceDelta: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    runtime.orbit.distance = clamp(runtime.orbit.distance + distanceDelta, 4, 7.4);
    cameraViewRef.current = { ...runtime.orbit };
    updateOrbitCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function resetCamera() {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    runtime.orbit = { ...defaultTreeCameraView };
    cameraViewRef.current = { ...defaultTreeCameraView };
    updateOrbitCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function rotateCamera(azimuthDelta: number, elevationDelta: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    runtime.orbit.azimuth += azimuthDelta;
    runtime.orbit.elevation = clamp(runtime.orbit.elevation + elevationDelta, -0.36, 0.82);
    cameraViewRef.current = { ...runtime.orbit };
    updateOrbitCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function onOrbitWheel(event: WheelEvent) {
    if (propsRef.current.viewMode !== "orbit" || (event.deltaX === 0 && event.deltaY === 0)) return;
    event.preventDefault();
    if (event.shiftKey) { rotateCamera(0, clamp(-event.deltaY * 0.002, -0.12, 0.12)); return; }
    if (event.deltaX !== 0) { rotateCamera(-clamp(event.deltaX * 0.003, -0.16, 0.16), clamp(event.deltaY * 0.002, -0.12, 0.12)); return; }
    zoomCamera(clamp(event.deltaY * 0.002, -0.45, 0.45));
  }

  return (
    <div ref={hostRef} className={`tree-3d-shell${viewMode === "orbit" ? " is-orbiting" : ""}`} role="group" aria-label={viewMode === "orbit" ? "3D гацуурыг харах" : "3D гацуурыг засах"} tabIndex={0} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
      {status === "loading" && <p className="tree-3d-status" role="status">3D модыг бэлдэж байна…</p>}
      {status === "fallback" && <p className="tree-3d-status" role="status">3D мод ачаалж чадсангүй. Хуудсыг дахин ачаална уу.</p>}
      {status === "ready" && <span className="tree-3d-instructions" aria-live="polite">{viewMode === "orbit" ? "Нэг хуруугаар чирж эргүүлнэ · Хоёр хуруугаар чимхэж ойртуулна · Touchpad-аа гүйлгэж томруулж эсвэл эргүүлнэ · Home анхны өнцөг" : "Чимэглэл сонгоод модон дээр товшиж байрлуулна · Байрлуулсны дараа чирж хөдөлгөнө."}</span>}
    </div>
  );
}

function createLightStrand(THREE: ThreeModule): import("three").Group {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.034, 10, 8);
  for (let index = 0; index < 28; index += 1) {
    const progress = index / 27;
    const angle = index * 1.37;
    const radius = treeMaximumRadius * (1 - progress) * 0.91;
    const material = new THREE.MeshStandardMaterial({ color: 0xffd978, emissive: 0xffd978, emissiveIntensity: 0.82, roughness: 0.28, metalness: 0.08 });
    const bulb = new THREE.Mesh(geometry, material);
    bulb.position.set(Math.sin(angle) * radius, treeMinimumY + treeHeight * (1 - progress), Math.cos(angle) * radius);
    bulb.userData.twinklePhase = index * 0.61;
    group.add(bulb);
  }
  return group;
}

function addGroundAccents(root: import("three").Group, THREE: ThreeModule) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.18, 48), new THREE.MeshStandardMaterial({ color: 0xb8d2e8, roughness: 1, transparent: true, opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.34;
  ground.name = "Tree ground glow";
  root.add(ground);
}

function syncDecorations(runtime: Runtime, design: TreeDesign, selectedId: string | null) {
  for (const group of runtime.ornaments.values()) {
    runtime.treeRoot.remove(group);
    disposeObject(group);
  }
  runtime.ornaments.clear();
  for (const decoration of design.decorations) {
    const hanger = createHanger(decoration, runtime.THREE);
    hanger.position.copy(positionForDecoration(decoration, runtime.THREE));
    hanger.userData.hangPhase = decoration.angle * twoPi;
    const ornament = hanger.children.find((child) => typeof child.userData.decorationId === "string") as import("three").Mesh | undefined;
    if (decoration.id === selectedId && ornament?.material instanceof runtime.THREE.MeshStandardMaterial) {
      ornament.material.emissive.set(0x5a3d13);
      ornament.material.emissiveIntensity = 0.42;
    }
    runtime.treeRoot.add(hanger);
    runtime.ornaments.set(decoration.id, hanger);
  }
}

function createHanger(decoration: TreeDecoration, THREE: ThreeModule): import("three").Group {
  const hanger = new THREE.Group();
  hanger.userData.decorationId = decoration.id;
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0xe8d8aa, metalness: 0.65, roughness: 0.3 }));
  hook.position.y = -0.04;
  hanger.add(hook);
  const mesh = createOrnamentMesh(decoration, THREE);
  mesh.position.y = -0.145;
  mesh.userData.decorationId = decoration.id;
  hanger.add(mesh);
  return hanger;
}

function createOrnamentMesh(decoration: TreeDecoration, THREE: ThreeModule): import("three").Mesh {
  let geometry: import("three").BufferGeometry;
  switch (decoration.kind) {
    case "star": geometry = new THREE.OctahedronGeometry(0.12, 1); break;
    case "candy-cane": geometry = new THREE.TorusGeometry(0.085, 0.032, 7, 18, Math.PI * 1.65); break;
    default: geometry = new THREE.SphereGeometry(0.105, 18, 14); break;
  }
  const material = new THREE.MeshStandardMaterial({ color: decoration.color, emissive: decoration.color, emissiveIntensity: 0.14, metalness: decoration.kind === "bauble-gold" || decoration.kind === "star" ? 0.5 : 0.14, roughness: 0.31 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(decoration.scale);
  mesh.rotation.z = decoration.rotation * Math.PI / 180;
  return mesh;
}

function syncGhost(runtime: Runtime, selectedKind: OrnamentKind | null) {
  if (!selectedKind) {
    if (runtime.ghost) runtime.ghost.visible = false;
    runtime.ghostKind = null;
    return;
  }
  if (runtime.ghostKind === selectedKind && runtime.ghost) return;
  if (runtime.ghost) { runtime.treeRoot.remove(runtime.ghost); disposeObject(runtime.ghost); }
  const exemplar: TreeDecoration = { id: "ghost", kind: selectedKind, x: 0.5, y: 0.5, angle: 0.5, radius: 0.5, rotation: 0, scale: 1, color: selectedKind === "bauble-red" ? "#d96b5e" : selectedKind === "bauble-green" ? "#a8c989" : selectedKind === "candy-cane" ? "#f4e7ce" : "#f2c96e" };
  const ghost = createOrnamentMesh(exemplar, runtime.THREE);
  const material = ghost.material as import("three").MeshStandardMaterial;
  material.transparent = true;
  material.opacity = 0.52;
  material.depthWrite = false;
  ghost.userData.isPlacementPreview = true;
  runtime.treeRoot.add(ghost);
  runtime.ghost = ghost;
  runtime.ghostKind = selectedKind;
}

function updateLightMaterials(runtime: Runtime, design: TreeDesign, time: number) {
  runtime.lightStrand.visible = design.lights.enabled;
  runtime.fairyLights.forEach((light) => {
    const material = light.material as import("three").MeshStandardMaterial;
    material.color.set(design.lights.color);
    material.emissive.set(design.lights.color);
    const phase = Number(light.userData.twinklePhase ?? 0);
    const twinkle = design.lights.twinkle ? 0.64 + ((Math.sin(time * 0.0021 + phase) + 1) / 2) * 0.36 : 1;
    material.emissiveIntensity = design.lights.brightness * twinkle;
  });
}

function positionForDecoration(point: Pick<TreeDecoration, "y" | "angle" | "radius">, THREE: ThreeModule) {
  const progress = clamp((point.y - 0.16) / 0.66, 0, 1);
  const angle = point.angle * twoPi;
  const radius = treeMaximumRadius * point.radius;
  const y = treeMinimumY + treeHeight * (1 - progress);
  return new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
}

function orbitMetrics(pointers: Map<number, OrbitPointer>): { center: OrbitPointer; distance: number } {
  const points = [...pointers.values()];
  if (points.length === 0) return { center: { x: 0, y: 0 }, distance: 0 };
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  return { center, distance };
}

function pointFromDecoration(decoration: TreeDecoration): TreePlacement {
  return { x: decoration.x, y: decoration.y, angle: decoration.angle, radius: decoration.radius };
}

function intersectAt(clientX: number, clientY: number, runtime: Runtime, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  runtime.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
  return runtime.raycaster.intersectObjects([...runtime.ornaments.values(), ...runtime.treeSurfaces], true);
}

function pointOnTree(intersections: import("three").Intersection[], runtime: Runtime): TreePlacement | null {
  const hit = intersections.find((intersection) => intersection.object.userData.treeSurface === true);
  if (!hit) return null;
  const local = runtime.treeRoot.worldToLocal(hit.point.clone());
  const angle = ((Math.atan2(local.x, local.z) / twoPi) + 1) % 1;
  const y = clamp(0.16 + ((treeMinimumY + treeHeight - local.y) / treeHeight) * 0.66, 0.16, 0.82);
  const radius = clamp(Math.hypot(local.x, local.z) / treeMaximumRadius, 0.02, 1);
  const x = clamp(0.5 + Math.sin(angle * twoPi) * 0.34, 0.16, 0.84);
  return { x, y, angle, radius };
}

function updateOrbitCamera(runtime: Runtime) {
  const { azimuth, elevation, distance } = runtime.orbit;
  const horizontalDistance = Math.cos(elevation) * distance;
  runtime.camera.position.set(runtime.target.x + Math.sin(azimuth) * horizontalDistance, runtime.target.y + Math.sin(elevation) * distance, runtime.target.z + Math.cos(azimuth) * horizontalDistance);
  runtime.camera.lookAt(runtime.target);
}

function resizeRenderer(renderer: import("three").WebGLRenderer, camera: import("three").PerspectiveCamera, host: HTMLElement) {
  const { width, height } = host.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function disposeRuntime(runtime: Runtime) { disposeScene(runtime.scene); }

function disposeObject(object: import("three").Object3D) {
  const geometries = new Set<import("three").BufferGeometry>();
  const materials = new Set<import("three").Material>();
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function disposeScene(scene: import("three").Scene) { disposeObject(scene); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
