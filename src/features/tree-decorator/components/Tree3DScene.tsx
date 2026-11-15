import { useEffect, useRef, useState, type MutableRefObject, type ReactNode, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OrnamentKind, TreeDecoration, TreeDesign } from "../model/tree-state";
import "../tree-3d.css";

type ThreeModule = typeof import("three");
type Placement = { x: number; y: number; angle: number };
type OrnamentDrag = { id: string; point: Placement; startX: number; startY: number; moved: boolean };
export type TreeCameraView = { azimuth: number; elevation: number; distance: number };
const ornamentDragThreshold = 6;
export const defaultTreeCameraView: TreeCameraView = { azimuth: 0, elevation: 0.07, distance: 5.6 };

interface Runtime {
  THREE: ThreeModule;
  renderer: import("three").WebGLRenderer;
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  treeRoot: import("three").Group;
  treeSurfaces: import("three").Mesh[];
  ornaments: Map<string, import("three").Mesh>;
  fairyLights: import("three").Mesh[];
  topper: import("three").Mesh;
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
  cameraViewRef,
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
  const orbitRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  propsRef.current = { design, selectedDecorationId, selectedKind, viewMode, onPlace, onMove, onMoveCommit, onSelect };

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
        } else if (propsRef.current.viewMode !== "orbit" && !dragRef.current && !orbitRef.current) {
          runtime.treeRoot.rotation.y += deltaSeconds * 0.04;
        }
        runtime.fairyLights.forEach((light) => {
          const material = light.material as import("three").MeshStandardMaterial;
          const phase = Number(light.userData.twinklePhase ?? 0);
          material.emissiveIntensity = 0.48 + ((Math.sin(time * 0.0024 + phase) + 1) / 2) * 0.48;
        });
        const topperMaterial = runtime.topper.material as import("three").MeshStandardMaterial;
        topperMaterial.emissiveIntensity = 0.58 + ((Math.sin(time * 0.0017) + 1) / 2) * 0.26;
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
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
          preserveDrawingBuffer: true,
        });
        partialRenderer = renderer;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.className = "tree-3d-canvas";
        host.append(renderer.domElement);

        const scene = new THREE.Scene();
        partialScene = scene;
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
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
        const tierMaterials = [
          new THREE.MeshStandardMaterial({ color: 0x2d7951, roughness: 0.82, flatShading: true }),
          new THREE.MeshStandardMaterial({ color: 0x286847, roughness: 0.82, flatShading: true }),
          new THREE.MeshStandardMaterial({ color: 0x215c40, roughness: 0.86, flatShading: true }),
          new THREE.MeshStandardMaterial({ color: 0x174732, roughness: 0.94, flatShading: true }),
        ];
        const tiers = [
          { radius: 0.45, height: 0.8, y: 0.29 },
          { radius: 0.64, height: 0.93, y: 0.02 },
          { radius: 0.83, height: 1.05, y: -0.3 },
          { radius: 1.02, height: 1.14, y: -0.63 },
        ];
        tiers.forEach((tier, index) => {
          const mesh = new THREE.Mesh(
            new THREE.ConeGeometry(tier.radius, tier.height, 18, 1),
            tierMaterials[index],
          );
          mesh.position.y = tier.y;
          mesh.userData.treeSurface = true;
          treeRoot.add(mesh);
          treeSurfaces.push(mesh);
        });

        const boughMaterials = [
          new THREE.MeshStandardMaterial({ color: 0x39845a, roughness: 0.88, flatShading: true }),
          new THREE.MeshStandardMaterial({ color: 0x2d704d, roughness: 0.88, flatShading: true }),
          new THREE.MeshStandardMaterial({ color: 0x225c40, roughness: 0.92, flatShading: true }),
        ];
        const boughGeometry = new THREE.ConeGeometry(0.16, 0.48, 7, 1);
        for (let row = 0; row < 5; row += 1) {
          const branchesInRow = row % 2 === 0 ? 7 : 6;
          const radialPosition = 0.28 + row * 0.105;
          const branchY = 0.45 - row * 0.355;
          for (let branchIndex = 0; branchIndex < branchesInRow; branchIndex += 1) {
            const angle = (branchIndex / branchesInRow) * twoPi + row * 0.28;
            const branch = new THREE.Mesh(boughGeometry, boughMaterials[(row + branchIndex) % boughMaterials.length]);
            branch.position.set(Math.sin(angle) * radialPosition, branchY, Math.cos(angle) * radialPosition);
            branch.rotation.y = angle;
            branch.rotation.z = 2.05 + (branchIndex % 3) * 0.08;
            branch.scale.setScalar(0.88 + (branchIndex % 2) * 0.08);
            treeRoot.add(branch);
          }
        }

        const snowCapMaterial = new THREE.MeshStandardMaterial({ color: 0xe7f0f6, roughness: 0.92, flatShading: true });
        tiers.forEach((tier) => {
          const cap = new THREE.Mesh(
            new THREE.ConeGeometry(tier.radius * 0.64, tier.height * 0.15, 18, 1),
            snowCapMaterial,
          );
          cap.position.y = tier.y + tier.height * 0.4;
          treeRoot.add(cap);
        });

        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.19, 0.57, 9),
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

        const topperHalo = new THREE.Mesh(
          new THREE.TorusGeometry(0.24, 0.018, 5, 18),
          new THREE.MeshStandardMaterial({ color: 0xffe4a0, emissive: 0x9d6b18, emissiveIntensity: 0.72, roughness: 0.34 }),
        );
        topperHalo.position.copy(topper.position);
        topperHalo.rotation.x = Math.PI / 2.8;
        treeRoot.add(topperHalo);

        for (let row = 0; row < 3; row += 1) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.42 + row * 0.24, 0.014, 4, 32),
            new THREE.MeshStandardMaterial({ color: 0xe3bd67, emissive: 0x5c3d0d, emissiveIntensity: 0.28, roughness: 0.4 }),
          );
          ring.rotation.x = Math.PI / 2;
          ring.scale.x = 0.8;
          ring.position.y = 0.22 - row * 0.48;
          treeRoot.add(ring);
        }

        const lightColors = [
          { color: 0xffc84d, emissive: 0xe88417 },
          { color: 0xf18d9b, emissive: 0x9a263c },
          { color: 0x9be2ff, emissive: 0x197cad },
        ];
        const lightGeometry = new THREE.SphereGeometry(0.034, 7, 6);
        const fairyLights: import("three").Mesh[] = [];
        for (let index = 0; index < 24; index += 1) {
          const progress = index / 23;
          const angle = index * 1.43;
          const radius = 0.12 + progress * 0.78;
          const tone = lightColors[index % lightColors.length];
          const bulbMaterial = new THREE.MeshStandardMaterial({
            color: tone.color,
            emissive: tone.emissive,
            emissiveIntensity: 0.78,
            roughness: 0.3,
          });
          const bulb = new THREE.Mesh(lightGeometry, bulbMaterial);
          bulb.position.set(Math.sin(angle) * radius, 0.58 - progress * 1.82, Math.cos(angle) * radius);
          bulb.userData.twinklePhase = index * 0.63;
          treeRoot.add(bulb);
          fairyLights.push(bulb);
        }
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(1.18, 24),
          new THREE.MeshStandardMaterial({ color: 0xb8d2e8, roughness: 1, transparent: true, opacity: 0.17 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1.36;
        treeRoot.add(ground);

        const raycaster = new THREE.Raycaster();
        runtime = {
          THREE, renderer, scene, camera, treeRoot, treeSurfaces, ornaments: new Map(), fairyLights, topper,
          orbit: { ...cameraViewRef.current }, orbitVelocity: { azimuth: 0, elevation: 0 },
          target: new THREE.Vector3(0, 0.25, 0), raycaster, pointer: new THREE.Vector2(),
        };
        runtimeRef.current = runtime;
        partialRenderer = null;
        partialScene = null;
        updateOrbitCamera(runtime);
        syncDecorations(runtime, propsRef.current.design, propsRef.current.selectedDecorationId);
        resizeRenderer(renderer, camera, host);
        resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resizeRenderer(renderer, camera, host)) : null;
        resizeObserver?.observe(host);
        if (!resizeObserver) window.addEventListener("resize", onResize);
        onCanvas(renderer.domElement);
        setStatus("ready");

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
          if (partialRenderer) {
            partialRenderer.setAnimationLoop(null);
            partialRenderer.dispose();
            partialRenderer.domElement.remove();
          }
        }
        partialScene = null;
        partialRenderer = null;
        onCanvas(null);
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
      } else if (!prefersReducedMotion) {
        runtime.renderer.setAnimationLoop(animateFrame);
      } else {
        runtime.renderer.render(runtime.scene, runtime.camera);
      }
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
    if (!runtime || !canvas || event.button !== 0) return;
    if (propsRef.current.viewMode === "orbit") {
      runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
      orbitRef.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
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
      const deltaTime = Math.max(8, event.timeStamp - orbitRef.current.time);
      const azimuthDelta = -deltaX * 0.008;
      const elevationDelta = deltaY * 0.006;
      orbitRef.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      runtime.orbit.azimuth += azimuthDelta;
      runtime.orbit.elevation = clamp(runtime.orbit.elevation + elevationDelta, -0.36, 0.82);
      runtime.orbitVelocity = {
        azimuth: clamp((azimuthDelta / deltaTime) * 0.52, -0.006, 0.006),
        elevation: clamp((elevationDelta / deltaTime) * 0.52, -0.004, 0.004),
      };
      cameraViewRef.current = { ...runtime.orbit };
      updateOrbitCamera(runtime);
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
    const orbit = orbitRef.current;
    if (runtime && orbit && Math.hypot(event.clientX - orbit.x, event.clientY - orbit.y) > 0) {
      onPointerMove(event);
    }
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

  function onPointerCancel() {
    dragRef.current = null;
    orbitRef.current = null;
    const runtime = runtimeRef.current;
    if (runtime) runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!runtimeRef.current || event.target !== event.currentTarget) return;
    const runtime = runtimeRef.current;
    if (propsRef.current.viewMode === "orbit") {
      const orbitSteps: Record<string, [number, number]> = {
        ArrowLeft: [-0.12, 0],
        ArrowRight: [0.12, 0],
        ArrowUp: [0, 0.08],
        ArrowDown: [0, -0.08],
      };
      const step = orbitSteps[event.key];
      if (step) {
        event.preventDefault();
        runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
        runtime.orbit.azimuth += step[0];
        runtime.orbit.elevation = clamp(runtime.orbit.elevation + step[1], -0.36, 0.82);
        cameraViewRef.current = { ...runtime.orbit };
        updateOrbitCamera(runtime);
        runtime.renderer.render(runtime.scene, runtime.camera);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomCamera(-0.35);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomCamera(0.35);
      } else if (event.key === "Home") {
        event.preventDefault();
        resetCamera();
      }
      return;
    }
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

  function zoomCamera(distanceDelta: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    runtime.orbit.distance = clamp(runtime.orbit.distance + distanceDelta, 4.2, 7.4);
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
    if (propsRef.current.viewMode !== "orbit") return;
    if (event.deltaX === 0 && event.deltaY === 0) return;
    event.preventDefault();
    if (event.shiftKey) {
      rotateCamera(0, clamp(-event.deltaY * 0.002, -0.12, 0.12));
      return;
    }
    if (event.deltaX !== 0) {
      rotateCamera(
        -clamp(event.deltaX * 0.003, -0.16, 0.16),
        clamp(event.deltaY * 0.002, -0.12, 0.12),
      );
      return;
    }
    zoomCamera(clamp(event.deltaY * 0.002, -0.45, 0.45));
  }

  return (
    <div
      ref={hostRef}
      className={`tree-3d-shell${viewMode === "orbit" ? " is-orbiting" : ""}`}
      role="group"
      aria-label={viewMode === "orbit" ? "3D гацуурыг харах" : "3D гацуурыг засах"}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      {status !== "ready" && <div className="tree-3d-fallback">{fallback}</div>}
      {status === "loading" && <p className="tree-3d-status" role="status">3D модыг бэлдэж байна…</p>}
      {status === "fallback" && <p className="tree-3d-status" role="status">Энэ төхөөрөмжид 3D дүрслэл боломжгүй байна. 2D урланг үргэлжлүүлэн ашиглаарай.</p>}
      {status === "ready" && (
        <span className="tree-3d-instructions" aria-live="polite">
          {viewMode === "orbit"
            ? "Чирж эсвэл touchpad-аа хажуу тийш гүйлгэж эргүүлнэ · Дугуй, touchpad эсвэл чимхэлтээр ойртуулна · Shift + гүйлгэхээр өндрөө солино · Home анхны өнцөг"
            : "Модон дээр товшиж чимэглэл нэмэх эсвэл чимэглэлээ чирж байрлуулна."}
        </span>
      )}
    </div>
  );
}

function updateOrbitCamera(runtime: Runtime) {
  const { azimuth, elevation, distance } = runtime.orbit;
  const horizontalDistance = Math.cos(elevation) * distance;
  runtime.camera.position.set(
    runtime.target.x + Math.sin(azimuth) * horizontalDistance,
    runtime.target.y + Math.sin(elevation) * distance,
    runtime.target.z + Math.cos(azimuth) * horizontalDistance,
  );
  runtime.camera.lookAt(runtime.target);
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
  disposeScene(runtime.scene);
}

function disposeScene(scene: import("three").Scene) {
  const geometries = new Set<import("three").BufferGeometry>();
  const uniqueMaterials = new Set<import("three").Material>();
  scene.traverse((object) => {
    const mesh = object as import("three").Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materialList.forEach((material) => uniqueMaterials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  uniqueMaterials.forEach((material) => material.dispose());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
