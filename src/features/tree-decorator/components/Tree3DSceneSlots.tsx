import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OrnamentKind, TreeDecoration, TreeDesign, TreeTheme } from "../model/tree-state";
import { getDecorationSlotId, TREE_CONE_TIERS, TREE_SLOTS, TREE_THEMES } from "../model/tree-state";
import type { TreeCameraView, TreeExportControls, TreePlacement } from "./Tree3DScene";
import "../tree-3d.css";

type ThreeModule = typeof import("three");
type PointerPoint = { x: number; y: number };
type OrbitGesture = { pointers: Map<number, PointerPoint>; start: PointerPoint; center: PointerPoint; distance: number; time: number; dragged: boolean };

export interface SlotTree3DSceneProps {
  design: TreeDesign;
  selectedDecorationId: string | null;
  selectedKind: OrnamentKind | null;
  viewMode: "edit" | "orbit";
  cameraViewRef: MutableRefObject<TreeCameraView>;
  onExportRoot: (root: import("three").Object3D | null) => void;
  onExportControls: (controls: TreeExportControls | null) => void;
  showSlots: boolean;
  theme: TreeTheme;
  onSlotClick: (slotId: string) => void;
  onSelect: (id: string) => void;
  onPlace: (kind: OrnamentKind, point: TreePlacement) => void;
  onMove: (id: string, point: TreePlacement) => void;
  onMoveCommit: () => void;
  onRemove: (id: string) => void;
}

interface Runtime {
  THREE: ThreeModule;
  renderer: import("three").WebGLRenderer;
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  treeRoot: import("three").Group;
  foliage: import("three").Mesh[];
  ornaments: Map<string, import("three").Group>;
  markers: Map<string, { group: import("three").Group; indicator: import("three").Mesh; target: import("three").Mesh }>;
  lightStrand: import("three").Group;
  fairyLights: import("three").Mesh[];
  orbit: TreeCameraView;
  orbitVelocity: { azimuth: number; elevation: number };
  target: import("three").Vector3;
  raycaster: import("three").Raycaster;
  pointer: import("three").Vector2;
  hoveredSlot: string | null;
  showSlots: boolean;
  theme: TreeTheme;
  designSnapshot: TreeDesign;
}

const modelUrl = "/assets/tree/christmas-tree.glb";
const foliageY = -1.13;
const clickSlop = 5;
const defaultCamera: TreeCameraView = { azimuth: 0, elevation: 0.07, distance: 5.4 };

export default function Tree3DSceneSlots(props: SlotTree3DSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const propsRef = useRef(props);
  const gestureRef = useRef<OrbitGesture | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  propsRef.current = props;

  useEffect(() => {
    let mounted = true;
    let observer: ResizeObserver | null = null;
    let runtime: Runtime | null = null;
    let partialRenderer: import("three").WebGLRenderer | null = null;
    let partialScene: import("three").Scene | null = null;
    let lastFrame = 0;
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let reducedMotion = motionQuery?.matches ?? false;
    const host = hostRef.current;
    if (!host) return;
    host.addEventListener("wheel", onWheel, { passive: false });

    function render() {
      if (runtime) runtime.renderer.render(runtime.scene, runtime.camera);
    }

    function animate(time: number) {
      if (!mounted || !runtime || document.visibilityState === "hidden") return;
      if (lastFrame && time - lastFrame < 16) return;
      const delta = lastFrame ? Math.min((time - lastFrame) / 1000, 0.1) : 0;
      lastFrame = time;
      if (!reducedMotion) {
        if (!gestureRef.current && (Math.abs(runtime.orbitVelocity.azimuth) > 0.000002 || Math.abs(runtime.orbitVelocity.elevation) > 0.000002)) {
          const damping = Math.exp(-5.5 * delta);
          runtime.orbit.azimuth += runtime.orbitVelocity.azimuth * delta * 1000;
          runtime.orbit.elevation = clamp(runtime.orbit.elevation + runtime.orbitVelocity.elevation * delta * 1000, -0.5, 0.92);
          runtime.orbitVelocity.azimuth *= damping;
          runtime.orbitVelocity.elevation *= damping;
          propsRef.current.cameraViewRef.current = { ...runtime.orbit };
          updateCamera(runtime);
        }
        runtime.ornaments.forEach((hanger) => {
          hanger.rotation.z = Math.sin(time * 0.00135 + Number(hanger.userData.phase ?? 0)) * 0.026;
        });
        updateLights(runtime, propsRef.current.design, time);
      }
      runtime.renderer.render(runtime.scene, runtime.camera);
    }

    function onMotionChange(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      if (!runtime) return;
      runtime.renderer.setAnimationLoop(reducedMotion || document.visibilityState === "hidden" ? null : animate);
      render();
    }

    async function mount() {
      try {
        if (typeof window.WebGLRenderingContext === "undefined") throw new Error("WebGL is unavailable");
        const THREE = await import("three");
        if (!mounted || !host) return;
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
        partialRenderer = renderer;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = "tree-3d-canvas";
        renderer.domElement.setAttribute("aria-hidden", "true");
        host.append(renderer.domElement);

        const scene = new THREE.Scene();
        partialScene = scene;
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
        scene.add(new THREE.AmbientLight(0xffffff, 0.25));
        scene.add(new THREE.HemisphereLight(0xe7f2ff, 0x253b2b, 0.35));
        const keyLight = new THREE.DirectionalLight(0xffedc5, 0.65);
        keyLight.position.set(-3.4, 4.1, 4.8);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xb7d5ff, 0.15);
        fillLight.position.set(3.5, 1.6, -3.4);
        scene.add(fillLight);

        const treeRoot = new THREE.Group();
        treeRoot.name = "Happy New Year Tree";
        scene.add(treeRoot);
        runtime = {
          THREE, renderer, scene, camera, treeRoot, foliage: [], ornaments: new Map(), markers: new Map(),
          lightStrand: new THREE.Group(), fairyLights: [], orbit: { ...propsRef.current.cameraViewRef.current },
          orbitVelocity: { azimuth: 0, elevation: 0 }, target: new THREE.Vector3(0, -0.04, 0),
          raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), hoveredSlot: null,
          showSlots: propsRef.current.showSlots, theme: propsRef.current.theme, designSnapshot: propsRef.current.design,
        };
        runtimeRef.current = runtime;
        partialScene = null;
        partialRenderer = null;

        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(modelUrl);
        if (!mounted || !runtime) {
          disposeObject(gltf.scene);
          return;
        }
        const model = gltf.scene;
        model.name = "Source Christmas Tree";
        model.scale.setScalar(0.227);
        model.position.set(0, foliageY + 0.014, -0.014);
        model.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const isFoliage = /^circle(?:\.\d+)?$/iu.test(mesh.name) || materials.some((material) => material.name === "Tree");
          mesh.visible = isFoliage;
          if (!isFoliage) return;
          // The source model has very thin, light-facing faces. An unlit material keeps
          // the chosen evergreen color stable across GPUs and avoids washing the foliage out.
          mesh.geometry = withFacetColor(THREE, mesh.geometry);
          const material = new THREE.MeshBasicMaterial({ color: themeColor(propsRef.current.theme), vertexColors: true, side: THREE.DoubleSide, depthWrite: true });
          material.name = "Interactive Evergreen";
          mesh.material = material;
          mesh.userData.isTreeFoliage = true;
          runtime!.foliage.push(mesh);
        });

        // The bundled foliage has extremely thin faces. These low-poly boughs keep its crown full and green on every GPU.
        buildFallbackFoliage(runtime, propsRef.current.theme);
        treeRoot.add(model);
        addTrunkAndSnowBase(runtime);
        runtime.lightStrand = createLightStrand(runtime);
        treeRoot.add(runtime.lightStrand);
        createSlotTargets(runtime);
        syncDecorations(runtime, propsRef.current.design, propsRef.current.selectedDecorationId);
        syncMarkers(runtime, propsRef.current.design, propsRef.current.showSlots);
        updateLights(runtime, propsRef.current.design, performance.now());
        resize(renderer, camera, host);
        observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { if (runtime) { resize(renderer, camera, host); render(); } });
        observer?.observe(host);
        if (!observer) window.addEventListener("resize", onResize);

        propsRef.current.onExportRoot(treeRoot);
        propsRef.current.onExportControls({
          setMarkersVisible(visible) {
            if (!runtime) return;
            runtime.markers.forEach(({ indicator }) => { indicator.visible = visible && runtime!.showSlots && !isSlotOccupied(propsRef.current.design, String(indicator.userData.slotId)); });
            render();
          },
          setSelectionHaloVisible(visible) {
            if (!runtime) return;
            runtime.ornaments.forEach((hanger) => hanger.traverse((object) => {
              if (object.userData.selectionHalo === true) object.visible = visible;
            }));
            render();
          },
        });
        updateCamera(runtime);
        setStatus("ready");
        renderer.setAnimationLoop(reducedMotion ? null : animate);
        render();
        document.addEventListener("visibilitychange", onVisibilityChange);
        motionQuery?.addEventListener("change", onMotionChange);
      } catch {
        observer?.disconnect();
        window.removeEventListener("resize", onResize);
        if (runtime) {
          runtime.renderer.setAnimationLoop(null);
          disposeObject(runtime.treeRoot);
          runtime.renderer.dispose();
          runtime.renderer.domElement.remove();
          if (runtimeRef.current === runtime) runtimeRef.current = null;
          runtime = null;
        } else {
          if (partialScene) disposeObject(partialScene);
          if (partialRenderer) { partialRenderer.setAnimationLoop(null); partialRenderer.dispose(); partialRenderer.domElement.remove(); }
        }
        propsRef.current.onExportRoot(null);
        propsRef.current.onExportControls(null);
        if (mounted) setStatus("fallback");
      }
    }

    function onResize() {
      if (!runtime || !host) return;
      resize(runtime.renderer, runtime.camera, host);
      render();
    }

    function onVisibilityChange() {
      if (!runtime) return;
      if (document.visibilityState === "hidden") runtime.renderer.setAnimationLoop(null);
      else if (!reducedMotion) runtime.renderer.setAnimationLoop(animate);
      else render();
    }

    function onWheel(event: WheelEvent) {
      if (!runtime) return;
      event.preventDefault();
      const trackpad = event.deltaX !== 0 || Math.abs(event.deltaY) < 42 || event.deltaMode !== 0;
      if (event.shiftKey) rotateCamera(0, clamp(-event.deltaY * 0.0024, -0.18, 0.18));
      else if (trackpad) rotateCamera(-clamp(event.deltaX * 0.0022, -0.18, 0.18), clamp(event.deltaY * 0.0016, -0.12, 0.12));
      else zoomCamera(clamp(event.deltaY * 0.0018, -0.42, 0.42));
    }

    void mount();
    return () => {
      mounted = false;
      host.removeEventListener("wheel", onWheel);
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery?.removeEventListener("change", onMotionChange);
      const activeRuntime = runtimeRef.current;
      if (activeRuntime) {
        activeRuntime.renderer.setAnimationLoop(null);
        disposeObject(activeRuntime.treeRoot);
        activeRuntime.renderer.dispose();
        activeRuntime.renderer.domElement.remove();
      }
      runtimeRef.current = null;
      propsRef.current.onExportRoot(null);
      propsRef.current.onExportControls(null);
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.showSlots = props.showSlots;
    runtime.theme = props.theme;
    runtime.designSnapshot = props.design;
    runtime.foliage.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const basic = material as import("three").MeshBasicMaterial;
        basic.color.set(themeColor(props.theme));
        basic.color.multiplyScalar(Number(mesh.userData.themeTint ?? 1));
        basic.side = runtime.THREE.DoubleSide;
        basic.needsUpdate = true;
      });
    });
    syncDecorations(runtime, props.design, props.selectedDecorationId);
    syncMarkers(runtime, props.design, props.showSlots);
    updateLights(runtime, props.design, performance.now());
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [props.design, props.selectedDecorationId, props.showSlots, props.theme]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    if (!runtime || event.button !== 0) return;
    const gesture = gestureRef.current ?? { pointers: new Map<number, PointerPoint>(), start: { x: event.clientX, y: event.clientY }, center: { x: event.clientX, y: event.clientY }, distance: 0, time: event.timeStamp, dragged: false };
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const metrics = gestureMetrics(gesture.pointers);
    gesture.start = { x: event.clientX, y: event.clientY };
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
    gesture.time = event.timeStamp;
    gesture.dragged = gesture.pointers.size > 1;
    gestureRef.current = gesture;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const gesture = gestureRef.current;
    if (!gesture) {
      updateHoveredSlot(runtime, event.clientX, event.clientY, event.currentTarget.querySelector("canvas"), renderNow);
      return;
    }
    if (!gesture.pointers.has(event.pointerId)) return;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const metrics = gestureMetrics(gesture.pointers);
    const deltaX = metrics.center.x - gesture.center.x;
    const deltaY = metrics.center.y - gesture.center.y;
    if (Math.hypot(metrics.center.x - gesture.start.x, metrics.center.y - gesture.start.y) > clickSlop || gesture.pointers.size > 1) gesture.dragged = true;
    if (!gesture.dragged) return;
    const timeDelta = Math.max(8, event.timeStamp - gesture.time);
    const azimuthDelta = -deltaX * 0.008;
    const elevationDelta = deltaY * 0.006;
    runtime.orbit.azimuth += azimuthDelta;
    runtime.orbit.elevation = clamp(runtime.orbit.elevation + elevationDelta, -0.5, 0.92);
    runtime.orbitVelocity = { azimuth: clamp(azimuthDelta / timeDelta * 0.48, -0.006, 0.006), elevation: clamp(elevationDelta / timeDelta * 0.48, -0.004, 0.004) };
    if (gesture.pointers.size > 1 && gesture.distance > 0 && metrics.distance > 0) {
      runtime.orbit.distance = clamp(runtime.orbit.distance + clamp((gesture.distance - metrics.distance) * 0.012, -0.42, 0.42), 3.7, 7.4);
    }
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
    gesture.time = event.timeStamp;
    propsRef.current.cameraViewRef.current = { ...runtime.orbit };
    updateCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const gesture = gestureRef.current;
    if (!runtime || !gesture) return;
    const point = gesture.pointers.get(event.pointerId);
    const distance = point ? Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) : Infinity;
    const shouldClick = gesture.pointers.size === 1 && !gesture.dragged && distance <= clickSlop;
    if (shouldClick) {
      const slotId = raycastSlot(runtime, event.clientX, event.clientY, event.currentTarget.querySelector("canvas"));
      if (slotId) propsRef.current.onSlotClick(slotId);
    }
    gesture.pointers.delete(event.pointerId);
    if (gesture.pointers.size === 0) gestureRef.current = null;
    else {
      const metrics = gestureMetrics(gesture.pointers);
      gesture.center = metrics.center;
      gesture.distance = metrics.distance;
      gesture.time = event.timeStamp;
      gesture.dragged = true;
    }
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    gesture?.pointers.delete(event.pointerId);
    if (!gesture || gesture.pointers.size === 0) gestureRef.current = null;
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    if (!runtime || event.target !== event.currentTarget) return;
    const step: Record<string, [number, number]> = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] };
    if (step[event.key]) {
      event.preventDefault();
      rotateCamera(step[event.key][0], step[event.key][1]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault(); zoomCamera(-0.35);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault(); zoomCamera(0.35);
    } else if (event.key === "Home") {
      event.preventDefault(); resetCamera();
    } else if ((event.key === "Enter" || event.key === " ") && runtime.hoveredSlot) {
      event.preventDefault(); propsRef.current.onSlotClick(runtime.hoveredSlot);
    }
  }

  function rotateCamera(azimuth: number, elevation: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    runtime.orbit.azimuth += azimuth;
    runtime.orbit.elevation = clamp(runtime.orbit.elevation + elevation, -0.5, 0.92);
    propsRef.current.cameraViewRef.current = { ...runtime.orbit };
    updateCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function zoomCamera(delta: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    runtime.orbit.distance = clamp(runtime.orbit.distance + delta, 3.7, 7.4);
    propsRef.current.cameraViewRef.current = { ...runtime.orbit };
    updateCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function resetCamera() {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orbit = { ...defaultCamera };
    runtime.orbitVelocity = { azimuth: 0, elevation: 0 };
    propsRef.current.cameraViewRef.current = { ...runtime.orbit };
    updateCamera(runtime);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  function renderNow() {
    const runtime = runtimeRef.current;
    if (runtime) runtime.renderer.render(runtime.scene, runtime.camera);
  }

  return (
    <div ref={hostRef} className="tree-3d-shell is-orbiting" role="group" aria-label="3D гацуурыг чирж эргүүлэх; цэг дээр товшиж чимэглэх" tabIndex={0} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
      {status === "loading" && <p className="tree-3d-status" role="status">3D модыг бэлдэж байна…</p>}
      {status === "fallback" && <p className="tree-3d-status" role="status">3D дүрслэл ачаалж чадсангүй. Хуудсыг дахин ачаална уу.</p>}
      {status === "ready" && <span className="tree-3d-instructions" aria-live="polite">Чирж модыг эргүүл · Мөчрийн цэгийг товшиж чимэглэ · Touchpad-аар эргүүлж, хулганын дугуйгаар ойртуул</span>}
    </div>
  );
}

function buildFallbackFoliage(runtime: Runtime, theme: TreeTheme) {
  const { THREE, treeRoot } = runtime;
  const tiers = TREE_CONE_TIERS;
  tiers.forEach((tier, index) => {
    const material = new THREE.MeshBasicMaterial({ color: themeColor(theme), vertexColors: true, side: THREE.DoubleSide });
    material.color.multiplyScalar(tier.tint);
    const coneGeometry = withFacetColor(THREE, new THREE.ConeGeometry(tier.radius, tier.top - tier.bottom, 12, 1, false));
    const cone = new THREE.Mesh(coneGeometry, material);
    cone.position.y = (tier.top + tier.bottom) / 2;
    cone.name = "Evergreen branch tier " + (index + 1);
    cone.userData.isTreeFoliage = true;
    cone.userData.themeTint = tier.tint;
    runtime.foliage.push(cone);
    treeRoot.add(cone);

    const branchLength = Math.hypot(tier.branchRadius - 0.06, tier.branchTipY - tier.branchY);
    const shades = [0.77, 0.91, 1.04];
    const branchMaterials = shades.map((shade) => {
      const branchMaterial = new THREE.MeshBasicMaterial({ color: themeColor(theme), vertexColors: true, side: THREE.DoubleSide });
      branchMaterial.color.multiplyScalar(tier.tint * shade);
      return branchMaterial;
    });
    const branchGeometry = withFacetColor(THREE, new THREE.ConeGeometry(tier.branchWidth, branchLength, 7, 1, false));
    for (let branchIndex = 0; branchIndex < tier.branchCount; branchIndex += 1) {
      const angle = (branchIndex / tier.branchCount) * Math.PI * 2 + index * 0.22;
      const start = new THREE.Vector3(Math.cos(angle) * 0.06, tier.branchY, Math.sin(angle) * 0.06);
      const end = new THREE.Vector3(Math.cos(angle) * tier.branchRadius, tier.branchTipY, Math.sin(angle) * tier.branchRadius);
      const direction = end.clone().sub(start).normalize();
      const shadeIndex = branchIndex % shades.length;
      const branch = new THREE.Mesh(branchGeometry, branchMaterials[shadeIndex]);
      branch.position.copy(start).add(end).multiplyScalar(0.5);
      branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      branch.name = `Evergreen bough ${index + 1}-${branchIndex + 1}`;
      branch.userData.isTreeFoliage = true;
      branch.userData.themeTint = tier.tint * shades[shadeIndex];
      runtime.foliage.push(branch);
      treeRoot.add(branch);
    }
  });
}

function withFacetColor(THREE: ThreeModule, source: import("three").BufferGeometry) {
  const geometry = source.toNonIndexed();
  if (geometry !== source) source.dispose();
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const light = new THREE.Vector3(-0.48, 0.78, 0.42).normalize();
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const shade = 0.58 + Math.max(0, normal.getX(index) * light.x + normal.getY(index) * light.y + normal.getZ(index) * light.z) * 0.42;
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function addTrunkAndSnowBase(runtime: Runtime) {
  const { THREE, treeRoot } = runtime;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.155, 0.46, 12), new THREE.MeshStandardMaterial({ color: 0x75451f, roughness: 0.88 }));
  trunk.position.y = -1.18;
  trunk.name = "Warm wooden trunk";
  treeRoot.add(trunk);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0xd7e8f7, roughness: 0.8, metalness: 0.02 }));
  base.position.y = -1.39;
  base.name = "Snow display base";
  treeRoot.add(base);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.04, 48), new THREE.MeshStandardMaterial({ color: 0xb8d2e8, roughness: 1, transparent: true, opacity: 0.12, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -1.45;
  glow.name = "Tree ground glow";
  treeRoot.add(glow);
}

function createLightStrand(runtime: Runtime) {
  const group = new runtime.THREE.Group();
  const { THREE } = runtime;
  const bulbGeometry = new THREE.SphereGeometry(0.024, 10, 8);
  const points: import("three").Vector3[] = [];
  for (let index = 0; index < 36; index += 1) {
    const progress = index / 35;
    const angle = index * 1.49;
    const radius = 0.13 + progress * 0.68;
    points.push(new THREE.Vector3(Math.sin(angle) * radius, 1.04 - progress * 2.12, Math.cos(angle) * radius));
  }
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 180, 0.007, 5, false),
    new THREE.MeshBasicMaterial({ color: 0xa77b35, transparent: true, opacity: 0.82 }),
  );
  wire.name = "Warm fairy-light wire";
  group.add(wire);
  for (let index = 0; index < points.length; index += 1) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffd978 });
    const bulb = new THREE.Mesh(bulbGeometry, material);
    bulb.position.copy(points[index]);
    bulb.userData.twinklePhase = index * 0.61;
    group.add(bulb);
    runtime.fairyLights.push(bulb);
  }
  return group;
}

function createSlotTargets(runtime: Runtime) {
  const { THREE, treeRoot } = runtime;
  const markerGeometry = new THREE.SphereGeometry(0.032, 14, 10);
  const hitGeometry = new THREE.SphereGeometry(0.16, 10, 8);
  TREE_SLOTS.forEach((slot) => {
    const group = new THREE.Group();
    group.name = "Tree decoration slot " + slot.id;
    group.position.set(slot.position[0] + slot.normal[0] * 0.035, slot.position[1] + slot.normal[1] * 0.035, slot.position[2] + slot.normal[2] * 0.035);
    group.userData.emptySlotMarker = true;
    const indicator = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0xffc342, transparent: true, opacity: 0.7, depthWrite: false }));
    indicator.name = "Empty slot marker " + slot.id;
    indicator.userData.slotId = slot.id;
    const target = new THREE.Mesh(hitGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    target.name = "Touch target " + slot.id;
    target.userData.slotId = slot.id;
    group.add(target);
    group.add(indicator);
    treeRoot.add(group);
    runtime.markers.set(slot.id, { group, indicator, target });
  });
}

function syncDecorations(runtime: Runtime, design: TreeDesign, selectedId: string | null) {
  const nextIds = new Set(design.decorations.map((decoration) => decoration.id));
  runtime.ornaments.forEach((group, id) => {
    if (nextIds.has(id)) return;
    runtime.treeRoot.remove(group);
    disposeObject(group);
    runtime.ornaments.delete(id);
  });
  design.decorations.forEach((decoration) => {
    const slotId = getDecorationSlotId(decoration);
    const slot = TREE_SLOTS.find((item) => item.id === slotId);
    if (!slot) return;
    const selected = decoration.id === selectedId;
    const existing = runtime.ornaments.get(decoration.id);
    if (existing && existing.userData.selected === selected && sameDecorationExceptRotation(existing.userData.decoration as TreeDecoration | undefined, decoration)) {
      const previous = existing.userData.decoration as TreeDecoration;
      if ((previous.rotX ?? 0) !== (decoration.rotX ?? 0) || (previous.rotY ?? 0) !== (decoration.rotY ?? 0) || previous.rotation !== decoration.rotation) {
        if (!updateOrnamentRotation(existing, decoration, runtime.THREE)) {
          runtime.treeRoot.remove(existing);
          disposeObject(existing);
          runtime.ornaments.delete(decoration.id);
        } else {
          existing.userData.decoration = { ...decoration };
          return;
        }
      } else {
        existing.userData.decoration = { ...decoration };
        return;
      }
    }
    if (existing && runtime.ornaments.has(decoration.id)) {
      runtime.treeRoot.remove(existing);
      disposeObject(existing);
      runtime.ornaments.delete(decoration.id);
    }
    const hanger = createHanger(decoration, runtime.THREE, slotId === "slot-0", slot.normal, decoration.id === selectedId);
    hanger.position.set(...slot.position);
    hanger.userData.phase = Math.atan2(slot.position[0], slot.position[2]);
    hanger.userData.slotId = slotId;
    hanger.userData.selected = selected;
    hanger.userData.decoration = { ...decoration };
    runtime.treeRoot.add(hanger);
    runtime.ornaments.set(decoration.id, hanger);
  });
}

function sameDecorationExceptRotation(previous: TreeDecoration | undefined, next: TreeDecoration): boolean {
  return Boolean(previous && previous.id === next.id && previous.kind === next.kind && previous.slotId === next.slotId &&
    previous.x === next.x && previous.y === next.y && previous.angle === next.angle && previous.radius === next.radius &&
    previous.scale === next.scale && previous.color === next.color);
}

function updateOrnamentRotation(group: import("three").Group, decoration: TreeDecoration, THREE: ThreeModule): boolean {
  const display = group.children.find((child) => child.userData.decorationDisplay === true);
  const visual = display?.children.find((child) => child.userData.ornamentVisual === true);
  if (!visual) return false;
  visual.rotation.set(
    THREE.MathUtils.degToRad(decoration.rotX ?? 0),
    THREE.MathUtils.degToRad(decoration.rotY ?? 0),
    THREE.MathUtils.degToRad(decoration.rotation),
    "YXZ",
  );
  return true;
}

function createHanger(decoration: TreeDecoration, THREE: ThreeModule, topper: boolean, normal: readonly [number, number, number], selected: boolean) {
  const group = new THREE.Group();
  group.userData.decorationId = decoration.id;
  const ornamentRadius = ornamentRadiusFor(decoration);
  if (!topper) {
    const gold = new THREE.MeshBasicMaterial({ color: 0xe9bd55 });
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 14), gold);
    loop.name = "Gold ornament hanging loop";
    loop.rotation.x = Math.PI / 2;
    loop.position.set(normal[0] * 0.012, -0.006, normal[2] * 0.012);
    group.add(loop);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, ornamentRadius * 0.72, 6), gold);
    wire.name = "Gold ornament hanging wire";
    wire.position.set(normal[0] * 0.026, -ornamentRadius * 0.36, normal[2] * 0.026);
    group.add(wire);
  }
  const ornament = createOrnamentMesh(decoration, THREE);
  ornament.userData.ornamentVisual = true;
  ornament.userData.decorationId = decoration.id;
  if (selected) {
    ornament.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
        (material as import("three").MeshBasicMaterial).color.multiplyScalar(1.08);
      });
    });
  }
  const display = new THREE.Group();
  display.userData.decorationDisplay = true;
  display.position.y = topper ? 0 : -ornamentRadius;
  if (!topper && (decoration.kind === "snowflake" || decoration.kind === "candy-cane")) {
    // Blend the slot's radial normal toward the default camera so flat details
    // remain recognizable at side slots instead of collapsing into thin slivers.
    const facing = new THREE.Vector3(normal[0], normal[1], normal[2] + 0.65).normalize();
    display.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);
  }
  display.add(ornament);
  if (selected) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(ornamentRadius * 1.52, Math.max(0.004, ornamentRadius * 0.035), 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xffcf62, transparent: true, opacity: 0.76, depthWrite: false, side: THREE.DoubleSide }),
    );
    halo.name = "Selected ornament soft glow";
    halo.userData.editorOnly = true;
    halo.userData.selectionHalo = true;
    halo.position.z = decoration.kind === "snowflake" || decoration.kind === "candy-cane" ? 0.018 : 0;
    display.add(halo);
  }
  group.add(display);
  if (decoration.kind === "bell") {
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.025, 9, 7), new THREE.MeshBasicMaterial({ color: 0xffd978 }));
    clapper.position.y = -0.09 * decoration.scale;
    clapper.scale.setScalar(decoration.scale);
    display.add(clapper);
  }
  return group;
}

function ornamentRadiusFor(decoration: TreeDecoration): number {
  const baseRadius = decoration.kind === "bell" ? 0.08 : decoration.kind.startsWith("bauble-") ? 0.105 : 0.12;
  return baseRadius * decoration.scale;
}

function createOrnamentMesh(decoration: TreeDecoration, THREE: ThreeModule) {
  const rotation = [
    THREE.MathUtils.degToRad(decoration.rotX ?? 0),
    THREE.MathUtils.degToRad(decoration.rotY ?? 0),
    THREE.MathUtils.degToRad(decoration.rotation),
  ] as const;
  if (decoration.kind === "candy-cane") {
    const cane = createCandyCane(THREE);
    cane.scale.setScalar(decoration.scale);
    cane.rotation.set(...rotation, "YXZ");
    return cane;
  }
  let geometry: import("three").BufferGeometry;
  switch (decoration.kind) {
    case "star": geometry = createStarGeometry(THREE); break;
    case "snowflake": geometry = createSnowflakeGeometry(THREE); break;
    case "bell": geometry = new THREE.CylinderGeometry(0.05, 0.11, 0.14, 16, 1, false); break;
    default: geometry = new THREE.SphereGeometry(0.105, 18, 13); break;
  }
  const material = new THREE.MeshBasicMaterial({ color: decoration.color, vertexColors: true, side: THREE.DoubleSide });
  geometry = withFacetColor(THREE, geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(decoration.scale);
  mesh.rotation.set(...rotation, "YXZ");
  if (decoration.kind === "bell") mesh.scale.set(0.85 * decoration.scale, 1.12 * decoration.scale, 0.85 * decoration.scale);
  return mesh;
}

function createCandyCane(THREE: ThreeModule) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.035, -0.12, 0),
    new THREE.Vector3(-0.008, -0.085, 0),
    new THREE.Vector3(0, -0.025, 0),
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(0.012, 0.085, 0),
    new THREE.Vector3(0.043, 0.112, 0),
    new THREE.Vector3(0.075, 0.096, 0),
    new THREE.Vector3(0.075, 0.065, 0),
  ]);
  const base = new THREE.Mesh(
    withFacetColor(THREE, new THREE.TubeGeometry(curve, 64, 0.022, 8, false)),
    new THREE.MeshBasicMaterial({ color: "#f4e7ce", vertexColors: true }),
  );
  base.name = "Cream candy cane";
  group.add(base);

  const frameCount = 96;
  const frames = curve.computeFrenetFrames(frameCount, false);
  const stripePoints: import("three").Vector3[] = [];
  for (let index = 0; index <= frameCount; index += 1) {
    const progress = index / frameCount;
    const angle = progress * Math.PI * 2 * 5;
    const center = curve.getPointAt(progress);
    const frame = frames.normals[index].clone().multiplyScalar(Math.cos(angle))
      .addScaledVector(frames.binormals[index], Math.sin(angle));
    stripePoints.push(center.addScaledVector(frame, 0.021));
  }
  const stripeCurve = new THREE.CatmullRomCurve3(stripePoints);
  const stripe = new THREE.Mesh(
    withFacetColor(THREE, new THREE.TubeGeometry(stripeCurve, frameCount, 0.0055, 5, false)),
    new THREE.MeshBasicMaterial({ color: "#c84e49", vertexColors: true }),
  );
  stripe.name = "Candy cane red spiral";
  group.add(stripe);
  return group;
}

function createSnowflakeGeometry(THREE: ThreeModule) {
  const positions: number[] = [];
  const halfDepth = 0.009;
  const addTriangle = (a: readonly number[], b: readonly number[], c: readonly number[]) => {
    positions.push(...a, ...b, ...c);
  };
  const addSegment = (startX: number, startY: number, endX: number, endY: number, width: number) => {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy) || 1;
    const offsetX = (-dy / length) * width / 2;
    const offsetY = (dx / length) * width / 2;
    const front = [
      [startX + offsetX, startY + offsetY, halfDepth],
      [endX + offsetX, endY + offsetY, halfDepth],
      [endX - offsetX, endY - offsetY, halfDepth],
      [startX - offsetX, startY - offsetY, halfDepth],
    ];
    const back = front.map(([x, y]) => [x, y, -halfDepth]);
    const [a, b, c, d] = front;
    const [backA, backB, backC, backD] = back;
    addTriangle(a, c, b); addTriangle(a, d, c);
    addTriangle(backA, backB, backC); addTriangle(backA, backC, backD);
    addTriangle(a, b, backB); addTriangle(a, backB, backA);
    addTriangle(b, c, backC); addTriangle(b, backC, backB);
    addTriangle(c, d, backD); addTriangle(c, backD, backC);
    addTriangle(d, a, backA); addTriangle(d, backA, backD);
  };
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = arm * Math.PI / 3 - Math.PI / 2;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    addSegment(0, 0, ux * 0.12, uy * 0.12, 0.014);
    const branchStart = 0.067;
    const branchEnd = 0.108;
    for (const side of [-1, 1]) {
      const branchAngle = angle + side * 0.78;
      addSegment(ux * branchStart, uy * branchStart, Math.cos(branchAngle) * branchEnd, Math.sin(branchAngle) * branchEnd, 0.011);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createStarGeometry(THREE: ThreeModule): import("three").BufferGeometry {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? 0.12 : 0.054;
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.032, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.005, bevelThickness: 0.005 });
}

function syncMarkers(runtime: Runtime, design: TreeDesign, showSlots: boolean) {
  runtime.markers.forEach(({ group, indicator }, slotId) => {
    const occupied = isSlotOccupied(design, slotId);
    group.visible = true;
    indicator.visible = showSlots && !occupied;
    const highlighted = slotId === runtime.hoveredSlot;
    indicator.scale.setScalar(highlighted ? 1.4 : 1);
    const material = indicator.material as import("three").MeshBasicMaterial;
    material.opacity = highlighted ? 0.98 : 0.7;
  });
}

function isSlotOccupied(design: TreeDesign, slotId: string) {
  return design.decorations.some((decoration) => getDecorationSlotId(decoration) === slotId);
}

function updateLights(runtime: Runtime, design: TreeDesign, time: number) {
  runtime.lightStrand.visible = design.lights.enabled;
  runtime.fairyLights.forEach((light) => {
    const material = light.material as import("three").MeshBasicMaterial;
    const phase = Number(light.userData.twinklePhase ?? 0);
    const pulse = design.lights.twinkle ? 0.68 + (Math.sin(time * 0.0018 + phase) + 1) * 0.16 : 1;
    material.color.set(design.lights.color).multiplyScalar(design.lights.brightness * pulse);
  });
}

function updateHoveredSlot(runtime: Runtime, x: number, y: number, canvas: HTMLCanvasElement | null, render: () => void) {
  if (!canvas) return;
  const next = raycastSlot(runtime, x, y, canvas);
  if (next === runtime.hoveredSlot) return;
  runtime.hoveredSlot = next;
  syncMarkers(runtime, propsDesign(runtime), runtime.showSlots);
  render();
}

function propsDesign(runtime: Runtime) {
  return runtime.designSnapshot;
}

function raycastSlot(runtime: Runtime, x: number, y: number, canvas: HTMLCanvasElement | null): string | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  runtime.pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
  const hits = runtime.raycaster.intersectObjects([...runtime.markers.values()].map(({ target }) => target), false);
  return typeof hits[0]?.object.userData.slotId === "string" ? hits[0].object.userData.slotId : null;
}

function gestureMetrics(pointers: Map<number, PointerPoint>) {
  const points = [...pointers.values()];
  if (!points.length) return { center: { x: 0, y: 0 }, distance: 0 };
  const center = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }), { x: 0, y: 0 });
  const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  return { center, distance };
}

function updateCamera(runtime: Runtime) {
  const { azimuth, elevation, distance } = runtime.orbit;
  const horizontal = Math.cos(elevation) * distance;
  runtime.camera.position.set(runtime.target.x + Math.sin(azimuth) * horizontal, runtime.target.y + Math.sin(elevation) * distance, runtime.target.z + Math.cos(azimuth) * horizontal);
  runtime.camera.lookAt(runtime.target);
}

function resize(renderer: import("three").WebGLRenderer, camera: import("three").PerspectiveCamera, host: HTMLElement) {
  const { width, height } = host.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function themeColor(theme: TreeTheme) {
  return TREE_THEMES.find((item) => item.id === theme)?.color ?? "#15803d";
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
