import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Object3D } from "three";
import { DestructiveButton, GameShell, HudBadge, PrimaryButton, SecondaryButton } from "../../components/ui/game";
import Tree3DSceneSlots from "./components/Tree3DSceneSlots";
import type { TreeCameraView, TreeExportControls, TreePlacement } from "./components/Tree3DScene";
import TreeWorkshopTabs, { type WorkshopTab } from "./components/TreeWorkshopTabs";
import {
  decodeTreeFragment,
  decorationForSlot,
  DEFAULT_TREE_DESIGN,
  encodeTreeFragment,
  getDecorationSlotId,
  normalizeTreeForSlots,
  removeDecoration,
  setSlotDecoration,
  TREE_SLOTS,
  TREE_THEMES,
  transformDecoration,
  type OrnamentColor,
  type OrnamentKind,
  type TreeDecoration,
  type TreeDesign,
  type TreeLights,
  type TreeTheme,
} from "./model/tree-state";
import { loadLastTreeDesign, saveLastTreeDesign } from "./model/tree-storage";
import { downloadTreeGlb } from "./services/gltf-export";
import { downloadTreePng } from "./services/png-export";
import "./tree-workshop.css";

type DownloadStatus = "idle" | "png" | "glb";
type RotationAxis = "rotX" | "rotY";
type RotationPreset = Pick<TreeDecoration, RotationAxis>;

const decorations: { kind: OrnamentKind; label: string; icon: string; color: OrnamentColor }[] = [
  { kind: "bauble-red", label: "Улаан бөмбөлөг", icon: "●", color: "#d96b5e" },
  { kind: "bauble-gold", label: "Алтан бөмбөлөг", icon: "●", color: "#f2c96e" },
  { kind: "bauble-green", label: "Ногоон бөмбөлөг", icon: "●", color: "#a8c989" },
  { kind: "candy-cane", label: "Чихэрэн таяг", icon: "♧", color: "#f4e7ce" },
  { kind: "star", label: "Алтан од", icon: "✦", color: "#ffd978" },
  { kind: "snowflake", label: "Мөсөн ширхэг", icon: "❄", color: "#98d8f2" },
  { kind: "bell", label: "Алтан хонх", icon: "♟", color: "#f2c96e" },
];

const lightColors: { color: OrnamentColor; label: string }[] = [
  { color: "#ffd978", label: "Алтан" },
  { color: "#98d8f2", label: "Мөсөн цэнхэр" },
  { color: "#f4e7ce", label: "Цагаан" },
  { color: "#d96b5e", label: "Улаан" },
];
const ornamentColors: { color: OrnamentColor; label: string }[] = [
  { color: "#d96b5e", label: "Улаан" },
  { color: "#f2c96e", label: "Алтлаг" },
  { color: "#a8c989", label: "Ногоон" },
  { color: "#f4e7ce", label: "Цагаан" },
  { color: "#98d8f2", label: "Мөсөн цэнхэр" },
  { color: "#d58bea", label: "Нил ягаан" },
];

const autoKinds: OrnamentKind[] = ["bauble-red", "bauble-gold", "snowflake", "bell", "candy-cane", "bauble-green"];
const initialCamera: TreeCameraView = { azimuth: 0, elevation: 0.07, distance: 5.4 };

export default function TreeWorkshop() {
  const [initialShare] = useState(() => {
    const hash = window.location.hash;
    const shared = decodeTreeFragment(hash);
    if (hash.includes("tree=")) return { ...shared, design: normalizeTreeForSlots(shared.design) };
    return { ...shared, design: normalizeTreeForSlots(loadLastTreeDesign() ?? shared.design) };
  });
  const [design, setDesign] = useState<TreeDesign>(initialShare.design);
  const designRef = useRef(design);
  designRef.current = design;
  const [tool, setTool] = useState<OrnamentKind | null>(null);
  const [activeTab, setActiveTab] = useState<WorkshopTab>("ornaments");
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [rotationPreset, setRotationPreset] = useState<RotationPreset>({ rotX: 0, rotY: 0 });
  const [showSlots, setShowSlots] = useState(true);
  const [notice, setNotice] = useState(
    initialShare.discardedLegacyDrawing
      ? "Хуучин модны чимэглэлүүдийг 3D цэгүүдэд шилжүүлж, гараар зурсан хэсгийг цэвэрлэлээ."
      : initialShare.valid ? "" : "Хуваалцсан модны линк буруу байна. Шинэ модноос эхэллээ.",
  );
  const [shareLink, setShareLink] = useState("");
  const [showShareLink, setShowShareLink] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [history, setHistory] = useState<{ past: TreeDesign[]; future: TreeDesign[] }>({ past: [], future: [] });
  const historyRef = useRef(history);
  historyRef.current = history;
  const cameraViewRef = useRef<TreeCameraView>({ ...initialCamera });
  const exportRootRef = useRef<Object3D | null>(null);
  const exportControlsRef = useRef<TreeExportControls | null>(null);
  const editTabRef = useRef<HTMLButtonElement>(null);
  const savedFragmentRef = useRef<string | null>(null);
  const hintId = useId();

  useEffect(() => {
    const fragment = encodeTreeFragment(design);
    if (savedFragmentRef.current === fragment) return;
    savedFragmentRef.current = fragment;
    saveLastTreeDesign(design);
    window.history.replaceState(null, "", window.location.pathname + fragment);
  }, [design]);

  const setExportRoot = useCallback((root: Object3D | null) => {
    exportRootRef.current = root;
  }, []);
  const setExportControls = useCallback((controls: TreeExportControls | null) => {
    exportControlsRef.current = controls;
  }, []);

  const selectedDecoration = design.decorations.find((item) => item.id === selectedDecorationId) ?? null;
  const selectedPaletteItem = selectedDecoration ? decorations.find((item) => item.kind === selectedDecoration.kind) : null;
  const selectedSlotIndex = selectedDecoration ? TREE_SLOTS.findIndex((slot) => slot.id === getDecorationSlotId(selectedDecoration)) : -1;
  const goldColor = selectedDecoration?.kind === "star" ? "#ffd978" : "#f2c96e";
  const placementKind = activeTab === "ornaments" ? tool : null;

  function updateDesign(next: TreeDesign, message?: string) {
    const current = designRef.current;
    if (next === current) return false;
    const historyNow = historyRef.current;
    const nextHistory = { past: [...historyNow.past.slice(-39), current], future: [] as TreeDesign[] };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    designRef.current = next;
    setDesign(next);
    if (message) setNotice(message);
    return true;
  }

  function clickSlot(slotId: string, fromList = false) {
    const currentDesign = designRef.current;
    const current = currentDesign.decorations.find((item) => getDecorationSlotId(item) === slotId);
    if (current && (!fromList || !placementKind || current.kind === placementKind)) {
      selectDecoration(current.id, !fromList);
      return;
    }
    if (!placementKind) {
      setNotice(activeTab === "ornaments" ? "Эхлээд чимэглэл сонгоод цэг дээр товшино уу." : "Энэ цэгт чимэглэл байхгүй байна.");
      return;
    }
    const slot = TREE_SLOTS.find((item) => item.id === slotId);
    if (placementKind === "star" && slot?.tier !== "topper") {
      setNotice("Алтан одыг зөвхөн модны оройд байрлуулна.");
      return;
    }
    if (placementKind !== "star" && slot?.tier === "topper") {
      setNotice("Модны оройд зөвхөн алтан од байрлуулна.");
      return;
    }
    const next = setSlotDecoration(currentDesign, slotId, placementKind, rotationPreset);
    if (next === currentDesign) return;
    updateDesign(next, current ? "Сонгосон цэгийн чимэглэлийг сольлоо." : "Чимэглэлийг цэгт байрлууллаа.");
    setSelectedDecorationId("decor-" + slotId);
  }

  function onLegacyPlace(kind: OrnamentKind, point: TreePlacement) {
    const target = {
      id: "legacy-placement",
      kind,
      x: point.x,
      y: point.y,
      angle: point.angle,
      radius: point.radius,
      rotation: 0,
      scale: 1,
      color: decorations.find((item) => item.kind === kind)?.color ?? "#f2c96e" as OrnamentColor,
    };
    clickSlot(kind === "star" ? "slot-0" : getDecorationSlotId(target));
  }

  function updateLights(changes: Partial<TreeLights>, message: string) {
    updateDesign({ ...designRef.current, lights: { ...designRef.current.lights, ...changes } }, message);
  }

  function updateTheme(theme: TreeTheme) {
    updateDesign({ ...designRef.current, theme: theme === "classic-green" ? undefined : theme }, "Модны өнгийг шинэчиллээ.");
  }

  function autoDecorate() {
    const nextDecorations = TREE_SLOTS.map((slot) => {
      const kind = slot.tier === "topper" ? "star" : autoKinds[Math.floor(Math.random() * autoKinds.length)];
      const decoration = decorationForSlot(slot.id, kind);
      return decoration ? { ...decoration, ...rotationPreset } : null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    updateDesign({ ...designRef.current, decorations: nextDecorations }, "Гацуурыг автоматаар чимэглэлээ.");
    setSelectedDecorationId(null);
  }

  function clearDecorations() {
    if (!designRef.current.decorations.length) {
      setNotice("Мод аль хэдийн хоосон байна.");
      return;
    }
    updateDesign({ ...designRef.current, decorations: [] }, "Бүх чимэглэлийг цэвэрлэлээ.");
    setSelectedDecorationId(null);
  }

  function undo() {
    const current = historyRef.current;
    const previous = current.past.at(-1);
    if (!previous) return;
    const nextHistory = { past: current.past.slice(0, -1), future: [designRef.current, ...current.future] };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    designRef.current = previous;
    setDesign(previous);
    setSelectedDecorationId(null);
    setNotice("Сүүлчийн өөрчлөлтийг буцаалаа.");
  }

  function redo() {
    const current = historyRef.current;
    const nextDesign = current.future[0];
    if (!nextDesign) return;
    const nextHistory = { past: [...current.past, designRef.current].slice(-40), future: current.future.slice(1) };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    designRef.current = nextDesign;
    setDesign(nextDesign);
    setSelectedDecorationId(null);
    setNotice("Буцаасан өөрчлөлтийг сэргээлээ.");
  }

  function resetTree() {
    updateDesign(DEFAULT_TREE_DESIGN, "Модоо эхний төлөвт орууллаа.");
    setRotationPreset({ rotX: 0, rotY: 0 });
    setTool(null);
    setSelectedDecorationId(null);
    setShareLink("");
    setShowShareLink(false);
  }

  function createShareUrl() {
    const url = window.location.origin + window.location.pathname + encodeTreeFragment(designRef.current);
    setShareLink(url);
    setShowShareLink(true);
    return url;
  }

  function manualCopyFallback() {
    setNotice("Линкийг автоматаар хуулж чадсангүй. Доорх талбараас сонгоод хуулна уу.");
    window.setTimeout(() => {
      const input = document.getElementById("tree-share-link") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 0);
  }

  async function shareTree() {
    const url = createShareUrl();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Миний шинэ жилийн гацуур", text: "Миний 3D гацуурыг үзээрэй!", url });
        setNotice("Модоо хуваалцлаа.");
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Модны линкийг хууллаа.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      manualCopyFallback();
    }
  }

  async function copyShareLink() {
    try {
      const url = createShareUrl();
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Модны линкийг хууллаа.");
    } catch {
      manualCopyFallback();
    }
  }

  async function savePng() {
    const canvas = document.querySelector<HTMLCanvasElement>(".tree-3d-canvas");
    if (!canvas) {
      setNotice("3D мод бэлэн болмогц зураг татна.");
      return;
    }
    setDownloadStatus("png");
    exportControlsRef.current?.setMarkersVisible(false);
    exportControlsRef.current?.setSelectionHaloVisible(false);
    try {
      await downloadTreePng(canvas);
      setNotice("Цэгийн тэмдэглэгээгүй PNG зураг татагдлаа.");
    } catch {
      setNotice("Зураг татаж чадсангүй. Дахин оролдоно уу.");
    } finally {
      exportControlsRef.current?.setMarkersVisible(showSlots);
      exportControlsRef.current?.setSelectionHaloVisible(true);
      setDownloadStatus("idle");
    }
  }

  async function saveGlb() {
    const root = exportRootRef.current;
    if (!root) {
      setNotice("3D мод бэлэн болмогц GLB файл татна.");
      return;
    }
    setDownloadStatus("glb");
    try {
      await downloadTreeGlb(root);
      setNotice("Хоосон цэгийн тэмдэглэгээгүй GLB файл татагдлаа.");
    } catch {
      setNotice("3D файл үүсгэж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setDownloadStatus("idle");
    }
  }

  function removeSelected() {
    if (!selectedDecoration) return;
    updateDesign(removeDecoration(designRef.current, selectedDecoration.id), "Сонгосон чимэглэлийг устгалаа.");
    setSelectedDecorationId(null);
  }

  function changeSelected(changes: Parameters<typeof transformDecoration>[2], message: string) {
    if (!selectedDecorationId) return;
    updateDesign(transformDecoration(designRef.current, selectedDecorationId, changes), message);
  }

  function selectDecoration(id: string, focusTab = true) {
    const decoration = designRef.current.decorations.find((item) => item.id === id);
    if (!decoration) return;
    setRotationPreset({ rotX: decoration.rotX ?? 0, rotY: decoration.rotY ?? 0 });
    setSelectedDecorationId(id);
    setActiveTab("edit");
    if (focusTab || activeTab !== "edit") {
      editTabRef.current?.focus({ preventScroll: window.matchMedia?.("(min-width: 1024px)").matches });
    }
  }

  function changeRotation(axis: RotationAxis, value: number) {
    const angle = Math.max(-180, Math.min(180, Math.round(value)));
    const nextPreset = { ...rotationPreset, [axis]: angle };
    setRotationPreset(nextPreset);
    if (selectedDecorationId) {
      changeSelected({ [axis]: angle }, `${axis === "rotY" ? "Хөндлөн" : "Босоо"} өнцгийг ${angle}° болголоо.`);
    } else {
      setNotice(`Шинэ чимэглэлийн өнцгийг ${angle}° болгож таарууллаа.`);
    }
  }

  function resetRotation() {
    setRotationPreset({ rotX: 0, rotY: 0 });
    if (selectedDecorationId) changeSelected({ rotX: 0, rotY: 0 }, "Чимэглэлийн хоёр өнцгийг тэглэлээ.");
    else setNotice("Шинэ чимэглэлийн хоёр өнцгийг тэглэлээ.");
  }

  const angleValues = {
    rotX: selectedDecoration?.rotX ?? rotationPreset.rotX ?? 0,
    rotY: selectedDecoration?.rotY ?? rotationPreset.rotY ?? 0,
  };

  return (
    <GameShell
      className="tree-workshop"
      kicker="Гацуурын урлан · 3D"
      title="Өөрийн гацуураа чимэглэ"
      description="Модоо чимэглээд холбоос, зураг эсвэл 3D файлаар хуваалцаарай."
      hud={
        <HudBadge key={design.decorations.length} className="ui-pop-in">
          Чимэглэл <strong>{design.decorations.length} / {TREE_SLOTS.length}</strong>
        </HudBadge>
      }
    >
      <div className="tree-workshop__layout">
        <section className="tree-workshop__canvas-panel" aria-label="3D гацуурын ажлын талбар">
          <div className="tree-workshop__toolbar" role="group" aria-label="Гацуурын хэрэгсэл">
            <PrimaryButton onClick={autoDecorate}>Автоматаар чимэглэх</PrimaryButton>
            <SecondaryButton onClick={undo} disabled={!history.past.length}>Буцаах</SecondaryButton>
            <SecondaryButton onClick={redo} disabled={!history.future.length}>Дахин хийх</SecondaryButton>
            <SecondaryButton aria-pressed={showSlots} onClick={() => setShowSlots((visible) => !visible)}>
              {showSlots ? "Цэг нуух" : "Цэг харуулах"}
            </SecondaryButton>
            <SecondaryButton onClick={clearDecorations} disabled={!design.decorations.length}>Бүгдийг цэвэрлэх</SecondaryButton>
          </div>

          <div className="tree-workshop__stage">
            <div className="tree-workshop__glow" aria-hidden="true" />
            <div className="tree-workshop__ground" aria-hidden="true" />
            <Tree3DSceneSlots
              design={design}
              selectedDecorationId={selectedDecorationId}
              selectedKind={placementKind}
              describedBy={hintId}
              viewMode="orbit"
              cameraViewRef={cameraViewRef}
              onExportRoot={setExportRoot}
              onExportControls={setExportControls}
              showSlots={showSlots}
              theme={design.theme ?? "classic-green"}
              onSlotClick={clickSlot}
              onSelect={selectDecoration}
              onPlace={onLegacyPlace}
              onMove={() => undefined}
              onMoveCommit={() => undefined}
              onRemove={(id) => {
                updateDesign(removeDecoration(designRef.current, id), "Сонгосон чимэглэлийг устгалаа.");
                setSelectedDecorationId(null);
              }}
            />
            <div className="tree-workshop__snow" aria-hidden="true">
              {Array.from({ length: 32 }, (_, index) => (
                <i key={index} style={{
                  left: ((index * 37 + 11) % 100) + "%",
                  animationDuration: 6 + (index * 3) % 9 + "s",
                  animationDelay: -((index * 5) % 13) + "s",
                  opacity: 0.35 + (index % 4) * 0.13,
                }} />
              ))}
            </div>
          </div>

          <footer className="tree-workshop__scene-footer">
            <div className="tree-workshop__scene-meta">
              <p id={hintId}>Чирж эргүүлнэ · Дугуйгаар ойртуулна · Цэг товшиж чимэглэнэ</p>
              <p className="tree-workshop__credit">
                RoboHoloclone12 · CC BY 4.0 ·{" "}
                <a href="https://sketchfab.com/3d-models/christmas-tree-742b8a73f28c4749a51d756332809375" target="_blank" rel="noreferrer">Sketchfab</a>
              </p>
            </div>
            <p className="tree-workshop__notice" role="status">{notice}</p>
          </footer>
        </section>

        <aside className="tree-workshop__side" aria-label="Гацуурын тохиргоо">
          <TreeWorkshopTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            editTabRef={editTabRef}
            panels={{
              ornaments: (
                <>
                  <h2>Чимэглэл сонгох</h2>
                  <div className="tree-workshop__palette" role="group" aria-label="Чимэглэлийн төрөл">
                    {decorations.map((item) => (
                      <SecondaryButton
                        key={item.kind}
                        className="tree-workshop__ornament"
                        aria-label={item.label + " сонгох"}
                        aria-pressed={tool === item.kind}
                        onClick={() => {
                          setTool(item.kind);
                          setSelectedDecorationId(null);
                          setNotice(item.kind === "star" ? "Алтан одыг зөвхөн оройн цэгт байрлуулна." : item.label + " сонголоо. Модон дээр тохирох цэгээ товшино уу.");
                        }}
                      >
                        <span style={{ color: item.color }} aria-hidden="true">{item.icon}</span>
                        <span>{item.label}</span>
                      </SecondaryButton>
                    ))}
                  </div>
                  <TreeSlotList decorations={design.decorations} onSlotClick={(slotId) => clickSlot(slotId, true)} />
                </>
              ),
              edit: (
                <>
                  <h2>Чимэглэл засах</h2>
                  {selectedDecoration ? (
                    <div className="tree-workshop__selected" role="group" aria-label="Сонгосон чимэглэл">
                      <span style={{ color: selectedDecoration.color }} aria-hidden="true">{selectedPaletteItem?.icon ?? "✦"}</span>
                      <strong>{selectedPaletteItem?.label ?? "Чимэглэл"}</strong>
                      <span className="tree-workshop__position">{slotLabel(selectedSlotIndex)}</span>
                    </div>
                  ) : (
                    <p className="tree-workshop__help">Модон дээрх чимэглэлээ товшиж сонгоно уу.</p>
                  )}

                  <section className="tree-workshop__angle-panel" aria-label="Чимэглэлийн өнцөг тааруулах">
                    <div className="tree-workshop__angle-heading">
                      <h3>Чимэглэлийн өнцөг тааруулах</h3>
                      <SecondaryButton onClick={resetRotation}>↺ Тэглэх</SecondaryButton>
                    </div>
                    {([
                      ["rotY", "Хөндлөн"],
                      ["rotX", "Босоо"],
                    ] as const).map(([axis, label]) => (
                      <div className="tree-workshop__angle-row" key={axis}>
                        <label htmlFor={`tree-angle-${axis}`}>
                          <span>{label}</span>
                          <output className="tree-workshop__angle-value">{angleValues[axis]}°</output>
                        </label>
                        <div className="tree-workshop__angle-controls">
                          <SecondaryButton
                            aria-label={`${label} өнцгийг 1°-аар багасгах`}
                            disabled={angleValues[axis] <= -180}
                            onClick={() => changeRotation(axis, angleValues[axis] - 1)}
                          >−1°</SecondaryButton>
                          <input
                            id={`tree-angle-${axis}`}
                            aria-label={`${label} өнцөг`}
                            type="range"
                            min="-180"
                            max="180"
                            step="1"
                            value={angleValues[axis]}
                            onChange={(event) => changeRotation(axis, Number(event.currentTarget.value))}
                          />
                          <SecondaryButton
                            aria-label={`${label} өнцгийг 1°-аар нэмэх`}
                            disabled={angleValues[axis] >= 180}
                            onClick={() => changeRotation(axis, angleValues[axis] + 1)}
                          >+1°</SecondaryButton>
                        </div>
                      </div>
                    ))}
                  </section>

                  {selectedDecoration && (
                    <details className="tree-workshop__disclosure" open>
                      <summary>Өнгө ба хэмжээ</summary>
                      <div className="tree-workshop__size-controls">
                        <SecondaryButton
                          disabled={selectedDecoration.scale <= 0.6}
                          onClick={() => changeSelected({ scale: Math.max(0.6, selectedDecoration.scale - 0.1) }, "Чимэглэлийг жижгэрүүллээ.")}
                        >− Жижигрүүлэх</SecondaryButton>
                        <SecondaryButton
                          disabled={selectedDecoration.scale >= 1.6}
                          onClick={() => changeSelected({ scale: Math.min(1.6, selectedDecoration.scale + 0.1) }, "Чимэглэлийг томрууллаа.")}
                        >+ Томруулах</SecondaryButton>
                      </div>
                      <div className="tree-workshop__swatches tree-workshop__swatches--ornaments" role="group" aria-label="Чимэглэлийн өнгө">
                        {ornamentColors.map((item) => {
                          const color = item.color === "#f2c96e" ? goldColor : item.color;
                          return (
                            <SecondaryButton
                              key={item.color}
                              className="tree-workshop__swatch"
                              aria-label={item.label + " өнгө"}
                              aria-pressed={selectedDecoration.color === color}
                              onClick={() => changeSelected({ color }, item.label + " өнгөөр сольлоо.")}
                            ><span style={{ backgroundColor: color }} aria-hidden="true" /></SecondaryButton>
                          );
                        })}
                      </div>
                    </details>
                  )}
                  {design.decorations.length > 0 && (
                    <TreeSlotList
                      decorations={design.decorations}
                      onSlotClick={(slotId) => clickSlot(slotId, true)}
                      selectedId={selectedDecorationId}
                      filledOnly
                    />
                  )}
                  {selectedDecoration && (
                    <DestructiveButton
                      className="tree-workshop__remove"
                      aria-label="Сонгосон чимэглэлийг устгах"
                      onClick={(event) => {
                        removeSelected();
                        event.currentTarget.closest<HTMLElement>('[role="tabpanel"]')?.focus();
                      }}
                    >Устгах</DestructiveButton>
                  )}
                </>
              ),
              tree: (
                <>
                  <h2>Модны төрх</h2>
                  <h3>Модны өнгө</h3>
                  <div className="tree-workshop__themes" role="group" aria-label="Гацуурын өнгө">
                    {TREE_THEMES.map((theme) => (
                      <SecondaryButton
                        key={theme.id}
                        aria-pressed={(design.theme ?? "classic-green") === theme.id}
                        onClick={() => updateTheme(theme.id)}
                      >
                        <span className="tree-workshop__theme-dot" style={{ backgroundColor: theme.color }} aria-hidden="true" />
                        {theme.label}
                      </SecondaryButton>
                    ))}
                  </div>

                  <div className="tree-workshop__lights">
                    <h3>Гэрлэн чимэглэл</h3>
                    <label className="tree-workshop__toggle">
                      <input type="checkbox" checked={design.lights.enabled} onChange={(event) => updateLights({ enabled: event.currentTarget.checked }, event.currentTarget.checked ? "Гэрлэн чимэглэлийг асаалаа." : "Гэрлэн чимэглэлийг унтраалаа.")} />
                      Гэрлийг асаах
                    </label>
                    <div className="tree-workshop__swatches" role="group" aria-label="Гэрлийн өнгө">
                      {lightColors.map((light) => (
                        <SecondaryButton
                          key={light.color}
                          className="tree-workshop__swatch"
                          aria-label={light.label + " гэрэл"}
                          aria-pressed={design.lights.color === light.color}
                          disabled={!design.lights.enabled}
                          onClick={() => updateLights({ color: light.color }, light.label + " гэрэл сонголоо.")}
                        ><span style={{ backgroundColor: light.color }} aria-hidden="true" /></SecondaryButton>
                      ))}
                    </div>
                    <label className="tree-workshop__range">
                      Гэрлийн тод байдал <output>{Math.round(design.lights.brightness * 100)}%</output>
                      <input aria-label="Гэрлийн тод байдал" type="range" min="0.2" max="1" step="0.05" value={design.lights.brightness} disabled={!design.lights.enabled} onChange={(event) => updateLights({ brightness: Number(event.currentTarget.value) }, "Гэрлийн тод байдлыг тохирууллаа.")} />
                    </label>
                    <label className="tree-workshop__toggle">
                      <input type="checkbox" checked={design.lights.twinkle} disabled={!design.lights.enabled} onChange={(event) => updateLights({ twinkle: event.currentTarget.checked }, event.currentTarget.checked ? "Гэрлийн анивчилтыг асаалаа." : "Гэрлийн анивчилтыг унтраалаа.")} />
                      Зөөлөн анивчилт
                    </label>
                  </div>
                  <SecondaryButton onClick={resetTree}>Шинэчлэх</SecondaryButton>
                </>
              ),
            }}
          />

          <section className="tree-workshop__share" aria-label="Модоо хуваалцах">
            <PrimaryButton onClick={shareTree}>Модоо хуваалцах</PrimaryButton>
            <div className="tree-workshop__share-actions">
              <SecondaryButton onClick={copyShareLink}>Линк хуулах</SecondaryButton>
              <SecondaryButton onClick={savePng} disabled={downloadStatus !== "idle"}>
                {downloadStatus === "png" ? "PNG бэлдэж байна" : "PNG татах"}
              </SecondaryButton>
              <SecondaryButton onClick={saveGlb} disabled={downloadStatus !== "idle"}>
                {downloadStatus === "glb" ? "3D бэлдэж байна" : "3D татах"}
              </SecondaryButton>
            </div>
            {showShareLink && (
              <div className="tree-workshop__share-field">
                <label htmlFor="tree-share-link">Модны share линк</label>
                <input id="tree-share-link" type="url" readOnly value={shareLink} onFocus={(event) => event.currentTarget.select()} />
              </div>
            )}
          </section>
        </aside>
      </div>
    </GameShell>
  );
}

interface TreeSlotListProps {
  decorations: TreeDecoration[];
  onSlotClick: (slotId: string) => void;
  filledOnly?: boolean;
  selectedId?: string | null;
}

function TreeSlotList({ decorations, onSlotClick, filledOnly = false, selectedId }: TreeSlotListProps) {
  const occupiedSlots = new Map(decorations.map((item) => [getDecorationSlotId(item), item.id]));

  return (
    <details className="tree-workshop__disclosure">
      <summary>{filledOnly ? "Чимэглэлийг жагсаалтаас сонгох" : "Байрлалыг жагсаалтаас сонгох"}</summary>
      <div className="tree-workshop__slot-options">
        {TREE_SLOTS.map((slot, index) => {
          const ornamentId = occupiedSlots.get(slot.id);
          if (filledOnly && !ornamentId) return null;

          return (
            <SecondaryButton
              key={slot.id}
              aria-pressed={filledOnly ? ornamentId === selectedId : undefined}
              onClick={() => onSlotClick(slot.id)}
            >
              {slotLabel(index)}
              {!filledOnly && (ornamentId ? " · дүүрсэн" : " · хоосон")}
            </SecondaryButton>
          );
        })}
      </div>
    </details>
  );
}

function slotLabel(index: number) {
  return index === 0 ? "Оройн од" : `Байрлал #${index}`;
}
