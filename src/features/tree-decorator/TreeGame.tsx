import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Object3D } from "three";
import Tree3DScene, { defaultTreeCameraView, type TreeCameraView } from "./components/Tree3DScene";
import {
  addDecoration,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  duplicateDecoration,
  encodeTreeFragment,
  MAX_DECORATIONS,
  moveDecoration,
  removeDecoration,
  transformDecoration,
  type OrnamentColor,
  type OrnamentKind,
  type TreeDesign,
  type TreeLights,
} from "./model/tree-state";
import { downloadTreeGlb } from "./services/gltf-export";
import { downloadTreePng } from "./services/png-export";
import { loadLastTreeDesign, saveLastTreeDesign } from "./model/tree-storage";

const palette: { kind: OrnamentKind; label: string; icon: string; color: OrnamentColor }[] = [
  { kind: "bauble-red", label: "Улаан бөмбөлөг", icon: "●", color: "#d96b5e" },
  { kind: "bauble-gold", label: "Алтан бөмбөлөг", icon: "●", color: "#f2c96e" },
  { kind: "bauble-green", label: "Ногоон бөмбөлөг", icon: "●", color: "#a8c989" },
  { kind: "candy-cane", label: "Чихэрэн таяг", icon: "♧", color: "#f4e7ce" },
  { kind: "star", label: "Алтан од", icon: "✦", color: "#ffd978" },
];
const editorColors: { color: OrnamentColor; label: string }[] = [
  { color: "#d96b5e", label: "Улаан" },
  { color: "#f2c96e", label: "Алтлаг" },
  { color: "#a8c989", label: "Ногоон" },
  { color: "#f4e7ce", label: "Цагаан" },
  { color: "#ffd978", label: "Шар" },
  { color: "#98d8f2", label: "Мөсөн цэнхэр" },
  { color: "#d58bea", label: "Нил ягаан" },
];

export default function TreeGame() {
  const [initialShare] = useState(() => {
    const hash = window.location.hash;
    const shared = decodeTreeFragment(hash);
    if (hash.includes("tree=")) return shared;
    return { ...shared, design: loadLastTreeDesign() ?? shared.design };
  });
  const [design, setDesign] = useState<TreeDesign>(initialShare.design);
  const designRef = useRef(design);
  designRef.current = design;
  const [selectedKind, setSelectedKind] = useState<OrnamentKind | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"edit" | "orbit">("edit");
  const cameraViewRef = useRef<TreeCameraView>({ ...defaultTreeCameraView });
  const exportRootRef = useRef<Object3D | null>(null);
  const [history, setHistory] = useState<{ past: TreeDesign[]; future: TreeDesign[] }>({ past: [], future: [] });
  const historyRef = useRef(history);
  historyRef.current = history;
  const [notice, setNotice] = useState(
    initialShare.discardedLegacyDrawing
      ? "Хуучин модны чимэглэлийг сэргээж, гараар зурсан хэсгийг хаслаа."
      : initialShare.valid ? "" : "Хуваалцсан модны линк буруу байна. Шинэ модноос эхэллээ.",
  );
  const [shareLink, setShareLink] = useState("");
  const [showShareLink, setShowShareLink] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "png" | "glb">("idle");
  const pendingMoveBeforeRef = useRef<TreeDesign | null>(null);
  const persistedFragmentRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingMoveBeforeRef.current) return;
    const fragment = encodeTreeFragment(design);
    if (persistedFragmentRef.current === fragment) return;
    persistedFragmentRef.current = fragment;
    saveLastTreeDesign(design);
    window.history.replaceState(null, "", `${window.location.pathname}${fragment}`);
  }, [design]);

  const handleExportRoot = useCallback((root: Object3D | null) => {
    exportRootRef.current = root;
  }, []);

  const selectedKindLabel = palette.find((item) => item.kind === selectedKind)?.label;
  const selectedDecoration = design.decorations.find((item) => item.id === selectedDecorationId);

  function pushHistory(snapshot: TreeDesign) {
    const current = historyRef.current;
    const next = { past: [...current.past.slice(-39), snapshot], future: [] as TreeDesign[] };
    historyRef.current = next;
    setHistory(next);
  }

  function updateDesign(next: TreeDesign, record = true) {
    const current = designRef.current;
    if (next === current) return;
    if (record) {
      if (pendingMoveBeforeRef.current) {
        const before = pendingMoveBeforeRef.current;
        pendingMoveBeforeRef.current = null;
        pushHistory(before);
      } else {
        pushHistory(current);
      }
    } else if (!pendingMoveBeforeRef.current) {
      pendingMoveBeforeRef.current = current;
    }
    designRef.current = next;
    setDesign(next);
  }

  function commitPendingMove() {
    const before = pendingMoveBeforeRef.current;
    if (!before) return;
    pendingMoveBeforeRef.current = null;
    pushHistory(before);
  }

  function undoEdit() {
    commitPendingMove();
    const current = historyRef.current;
    const previous = current.past.at(-1);
    if (!previous) return;
    const next = { past: current.past.slice(0, -1), future: [designRef.current, ...current.future] };
    historyRef.current = next;
    setHistory(next);
    designRef.current = previous;
    setDesign(previous);
    if (!previous.decorations.some((decoration) => decoration.id === selectedDecorationId)) {
      setSelectedDecorationId(previous.decorations.at(-1)?.id ?? null);
    }
    setNotice("Сүүлчийн засварыг буцаалаа.");
  }

  function redoEdit() {
    const current = historyRef.current;
    const nextDesign = current.future[0];
    if (!nextDesign) return;
    const next = { past: [...current.past, designRef.current].slice(-40), future: current.future.slice(1) };
    historyRef.current = next;
    setHistory(next);
    designRef.current = nextDesign;
    setDesign(nextDesign);
    if (!nextDesign.decorations.some((decoration) => decoration.id === selectedDecorationId)) {
      setSelectedDecorationId(nextDesign.decorations.at(-1)?.id ?? null);
    }
    setNotice("Буцаасан засварыг сэргээлээ.");
  }

  function placeDecoration(kind: OrnamentKind, point: { x: number; y: number; angle: number; radius: number }) {
    if (designRef.current.decorations.length >= MAX_DECORATIONS) {
      setNotice("Мод 48 чимэглэлтэй боллоо. Дахин нэмэхийн тулд нэгийг нь устгаарай.");
      return;
    }
    const item = palette.find((entry) => entry.kind === kind)!;
    const id = createId();
    updateDesign(addDecoration(designRef.current, {
      id,
      kind,
      x: point.x,
      y: point.y,
      angle: point.angle,
      radius: point.radius,
      rotation: 0,
      scale: 1,
      color: item.color,
    }));
    setSelectedDecorationId(id);
    setNotice(`${item.label} модон дээр нэмэгдлээ.`);
  }

  function handleMove(id: string, point: { x: number; y: number; angle: number; radius: number }) {
    updateDesign(moveDecoration(designRef.current, id, point.x, point.y, point.angle, point.radius), false);
  }

  function handleMoveCommit() {
    commitPendingMove();
    const next = designRef.current;
    saveLastTreeDesign(next);
    persistedFragmentRef.current = encodeTreeFragment(next);
    window.history.replaceState(null, "", `${window.location.pathname}${persistedFragmentRef.current}`);
  }

  function removeSelected() {
    if (!selectedDecorationId) return;
    updateDesign(removeDecoration(designRef.current, selectedDecorationId));
    setSelectedDecorationId(null);
    setNotice("Чимэглэлийг модноос авлаа.");
  }

  function duplicateSelected() {
    if (!selectedDecorationId || design.decorations.length >= MAX_DECORATIONS) return;
    const id = createId();
    updateDesign(duplicateDecoration(designRef.current, selectedDecorationId, id));
    setSelectedDecorationId(id);
    setNotice("Чимэглэлийг хуулбарлалаа.");
  }

  function updateLights(lights: Partial<TreeLights>, message: string) {
    updateDesign({ ...designRef.current, lights: { ...designRef.current.lights, ...lights } });
    setNotice(message);
  }

  function resetTree() {
    updateDesign(DEFAULT_TREE_DESIGN);
    pendingMoveBeforeRef.current = null;
    setSelectedKind(null);
    setSelectedDecorationId(null);
    setShareLink("");
    setShowShareLink(false);
    setNotice("Модоо шинээр эхлүүллээ.");
  }

  function createShareUrl() {
    const url = `${window.location.origin}${window.location.pathname}${encodeTreeFragment(design)}`;
    setShareLink(url);
    setShowShareLink(true);
    return url;
  }

  function showManualCopyFallback() {
    setNotice("Линкийг автоматаар хуваалцаж чадсангүй. Доорх линкийг сонгоод хуулна уу.");
    window.setTimeout(() => {
      const input = document.getElementById("share-link") as HTMLInputElement | null;
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
      setNotice("Модны линкийг хууллаа. Найзууддаа илгээгээрэй!");
    } catch {
      showManualCopyFallback();
    }
  }

  async function copyTreeLink() {
    try {
      const url = createShareUrl();
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Модны линкийг хууллаа. Найзууддаа илгээгээрэй!");
    } catch {
      showManualCopyFallback();
    }
  }

  async function savePng() {
    const canvas = document.querySelector<HTMLCanvasElement>(".tree-3d-canvas");
    if (!canvas) {
      setNotice("3D мод бэлэн болмогц зураг татах боломжтой.");
      return;
    }
    setDownloadStatus("png");
    try {
      await downloadTreePng(canvas);
      setNotice("Модны PNG зураг татагдлаа.");
    } catch {
      setNotice("Зураг үүсгэж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setDownloadStatus("idle");
    }
  }

  async function saveGlb() {
    const root = exportRootRef.current;
    if (!root) {
      setNotice("3D мод бэлэн болмогц GLB файл татах боломжтой.");
      return;
    }
    setDownloadStatus("glb");
    try {
      await downloadTreeGlb(root);
      setNotice("Таны 3D гацуурыг GLB файл болгон татлаа.");
    } catch {
      setNotice("3D файл гаргаж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setDownloadStatus("idle");
    }
  }

  function transformSelected(transform: Parameters<typeof transformDecoration>[2], message: string) {
    if (!selectedDecorationId) return;
    updateDesign(transformDecoration(designRef.current, selectedDecorationId, transform));
    setNotice(message);
  }

  return (
    <section className="tree-game-page" aria-labelledby="tree-game-title">
      <div className="game-page-heading">
        <p className="eyebrow">ГАЦУУРЫН УРЛАН</p>
        <h1 id="tree-game-title">Модоо өөрийнхөөрөө бүтээ</h1>
        <p className="intro-copy">3D гацуураа чимэглэж, хүссэн өнцгөөс харж, бүтээлээ найзуудтайгаа хуваалцаарай.</p>
      </div>

      <section className="studio" aria-label="3D гацуур чимэглэх урлан">
        <div className="studio__tree-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">ТАНЫ ШИНЭ ЖИЛИЙН МОД</span><h2>Өөрийнхөөрөө бүтээ</h2></div>
            <span className="decoration-count" aria-label={`${design.decorations.length} чимэглэл`}><span aria-hidden="true">✦</span> {design.decorations.length} чимэглэл</span>
          </div>

          <div className="tree-view-switch" role="group" aria-label="3D модны камерын горим">
            <button className={`tool-chip${cameraMode === "edit" ? " is-active" : ""}`} type="button" aria-pressed={cameraMode === "edit"} onClick={() => setCameraMode("edit")}>Чимэглэх</button>
            <button className={`tool-chip${cameraMode === "orbit" ? " is-active" : ""}`} type="button" aria-label="Модны өнцгийг өөрчлөх" aria-pressed={cameraMode === "orbit"} onClick={() => setCameraMode(cameraMode === "orbit" ? "edit" : "orbit")}>{cameraMode === "orbit" ? "Засварлах горим" : "Модны өнцөг"}</button>
          </div>

          <div className="tree-stage">
            <div className="stage-glow" aria-hidden="true" />
            <div className="stage-snow stage-snow--one" aria-hidden="true" />
            <div className="stage-snow stage-snow--two" aria-hidden="true" />
            <div className="tree-stage__ground" aria-hidden="true" />
            <Tree3DScene
              design={design}
              selectedDecorationId={selectedDecorationId}
              selectedKind={selectedKind}
              viewMode={cameraMode}
              cameraViewRef={cameraViewRef}
              onExportRoot={handleExportRoot}
              onPlace={placeDecoration}
              onMove={handleMove}
              onMoveCommit={handleMoveCommit}
              onSelect={setSelectedDecorationId}
              onRemove={(id) => { updateDesign(removeDecoration(designRef.current, id)); setSelectedDecorationId(null); setNotice("Чимэглэлийг модноос авлаа."); }}
            />
            <div className="stage-fall" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ left: `${(index * 43 + 4) % 100}%`, animationDuration: `${5 + (index * 3) % 8}s`, animationDelay: `${-((index * 5) % 11)}s`, width: `${2 + index % 3}px`, height: `${2 + index % 3}px`, opacity: 0.45 + (index % 4) * 0.12 }} />)}</div>
            <div className="stage-caption" aria-hidden="true"><span /> 3D ГАЦУУРАА ЗАСАХ</div>
          </div>

          <p className="live-notice" role="status" aria-live="polite">{notice || (selectedKind ? `${selectedKindLabel} сонгогдлоо — модон дээр товшоод байрлуулаарай.` : "Чимэглэл сонгоод 3D модон дээр товшиж байрлуулаарай.")}</p>
          <p className="tree-asset-credit">Загвар: RoboHoloclone12 · CC BY 4.0 · <a href="https://sketchfab.com/3d-models/christmas-tree-742b8a73f28c4749a51d756332809375" target="_blank" rel="noreferrer">Sketchfab эх сурвалж</a></p>
        </div>

        <aside className="studio__tools" aria-label="3D модны чимэглэл ба хэрэгслүүд">
          <section className="tool-card palette-card" aria-labelledby="palette-title">
            <div className="section-title-row"><div className="section-icon" aria-hidden="true">✧</div><div><h2 id="palette-title">Чимэглэл сонгох</h2><p>Сонгоод модон дээр хүссэн цэгээ товшино уу</p></div></div>
            <div className="ornament-palette" role="group" aria-label="Чимэглэлийн сонголт">
              {palette.map((item) => <button key={item.kind} className={`palette-item${selectedKind === item.kind ? " is-active" : ""}`} type="button" aria-label={`${item.label} сонгох`} aria-pressed={selectedKind === item.kind} disabled={design.decorations.length >= MAX_DECORATIONS} onClick={() => { setSelectedKind(item.kind); setSelectedDecorationId(null); setNotice(`${item.label} сонгогдлоо — модон дээр товшоод байрлуулаарай.`); }}><span className={`palette-item__icon icon-${item.kind}`} style={{ color: item.color }} aria-hidden="true">{item.icon}</span><span className="palette-item__label">{item.label}</span></button>)}
            </div>
            <p className="tool-hint"><span aria-hidden="true">↳</span> Модон дээр гарсан бүдэг дүрсийг харж, байршлаа яг таг сонгоорой.</p>
            {design.decorations.length > 0 && <div className="tree-placed-list" role="group" aria-label="Модон дээрх чимэглэлүүд">{design.decorations.map((decoration, index) => <button key={decoration.id} className={`tree-placed-item${selectedDecorationId === decoration.id ? " is-active" : ""}`} type="button" aria-label={`Модон дээрх ${palette.find((item) => item.kind === decoration.kind)?.label ?? "Чимэглэл"}`} aria-pressed={selectedDecorationId === decoration.id} onClick={() => setSelectedDecorationId(decoration.id)}><span aria-hidden="true" style={{ color: decoration.color }}>●</span>{palette.find((item) => item.kind === decoration.kind)?.label ?? "Чимэглэл"} {index + 1}</button>)}</div>}
          </section>

          <section className="tool-card light-card" aria-labelledby="lights-title">
            <div className="section-title-row section-title-row--compact"><div className="section-icon section-icon--gold" aria-hidden="true">✺</div><div><h2 id="lights-title">Гэрлэн чимэглэл</h2><p>Бүх мөчрөөр тойруулан зөөлөн анивчуулна</p></div></div>
            <label className="light-toggle"><input type="checkbox" checked={design.lights.enabled} onChange={(event) => updateLights({ enabled: event.currentTarget.checked }, event.currentTarget.checked ? "Гэрлэн чимэглэлийг асаалаа." : "Гэрлэн чимэглэлийг унтраалаа.")} /><span>Гэрлийг асаах</span></label>
            <div className="tree-editor-colors" role="group" aria-label="Гэрлийн өнгө">{editorColors.map((item) => <button key={item.color} className={`tree-editor-color${design.lights.color === item.color ? " is-active" : ""}`} style={{ "--tree-color": item.color } as CSSProperties} type="button" aria-label={`${item.label} гэрэл`} aria-pressed={design.lights.color === item.color} disabled={!design.lights.enabled} onClick={() => updateLights({ color: item.color }, `${item.label} гэрэл сонголоо.`)} />)}</div>
            <label className="light-range">Гэрлийн тод байдал <input type="range" min="0.2" max="1" step="0.05" value={design.lights.brightness} disabled={!design.lights.enabled} onChange={(event) => updateLights({ brightness: Number(event.currentTarget.value) }, "Гэрлийн тод байдлыг тохирууллаа.")} /></label>
            <label className="light-toggle light-toggle--subtle"><input type="checkbox" checked={design.lights.twinkle} disabled={!design.lights.enabled} onChange={(event) => updateLights({ twinkle: event.currentTarget.checked }, event.currentTarget.checked ? "Зөөлөн анивчилтыг асаалаа." : "Анивчилтыг зогсоолоо.")} /><span>Зөөлөн анивчилт</span></label>
          </section>

          <section className="tool-card action-card" aria-labelledby="action-title">
            <div className="section-title-row section-title-row--compact"><div className="section-icon section-icon--gold" aria-hidden="true">♡</div><div><h2 id="action-title">Модоо хуваалцах</h2><p>Линк, зураг эсвэл 3D файл татах</p></div></div>
            <div className="action-buttons">
              <button className="button button--primary" type="button" onClick={shareTree}><span aria-hidden="true">↗</span> Хуваалцах</button>
              <button className="button button--secondary" type="button" onClick={copyTreeLink}><span aria-hidden="true">⧉</span> Линк хуулах</button>
              <button className="button button--secondary" type="button" onClick={savePng} disabled={downloadStatus !== "idle"}><span aria-hidden="true">↓</span> {downloadStatus === "png" ? "Бэлдэж байна…" : "PNG зураг татах"}</button>
              <button className="button button--secondary" type="button" onClick={saveGlb} disabled={downloadStatus !== "idle"}><span aria-hidden="true">▣</span> {downloadStatus === "glb" ? "3D файл бэлдэж байна…" : "3D GLB татах"}</button>
            </div>
            {showShareLink && <div className="share-link-wrap"><label htmlFor="share-link">Модны share линк</label><input id="share-link" type="url" readOnly value={shareLink} onFocus={(event) => event.currentTarget.select()} /></div>}
          </section>

          <section className="tool-card edit-card" aria-labelledby="edit-title">
            <div className="section-title-row section-title-row--compact"><div className="section-icon section-icon--muted" aria-hidden="true">✳</div><div><h2 id="edit-title">Засварлах</h2><p>{selectedDecoration ? "Сонгосон чимэглэлээ тохируулаарай" : "Модны засвараа удирдах"}</p></div></div>
            {selectedDecoration && <><div className="tree-editor-controls" aria-label="Сонгосон чимэглэлийн тохиргоо"><button className="button button--quiet" type="button" onClick={duplicateSelected} disabled={design.decorations.length >= MAX_DECORATIONS}>Хуулбарлах</button><button className="button button--quiet" type="button" onClick={() => transformSelected({ rotation: wrapDegrees(selectedDecoration.rotation + 15) }, "Чимэглэлийг эргүүллээ.")}>↻ 15°</button><button className="button button--quiet" type="button" onClick={() => transformSelected({ scale: Math.min(1.6, selectedDecoration.scale + 0.1) }, "Чимэглэлийг томрууллаа.")} disabled={selectedDecoration.scale >= 1.6}>Томруулах</button><button className="button button--quiet" type="button" onClick={() => transformSelected({ scale: Math.max(0.6, selectedDecoration.scale - 0.1) }, "Чимэглэлийг жижгэрүүллээ.")} disabled={selectedDecoration.scale <= 0.6}>Жижигрүүлэх</button></div><div className="tree-editor-colors" role="group" aria-label="Чимэглэлийн өнгө">{editorColors.map((item) => <button key={item.color} className={`tree-editor-color${selectedDecoration.color === item.color ? " is-active" : ""}`} style={{ "--tree-color": item.color } as CSSProperties} type="button" aria-label={`${item.label} өнгө`} aria-pressed={selectedDecoration.color === item.color} onClick={() => transformSelected({ color: item.color }, `${item.label} өнгөөр сольлоо.`)} />)}</div><button className="button button--quiet" type="button" onClick={removeSelected}>Сонгосныг устгах</button></>}
            <div className="edit-buttons"><button className="button button--quiet" type="button" onClick={undoEdit} disabled={!history.past.length}>Буцаах</button><button className="button button--quiet" type="button" onClick={redoEdit} disabled={!history.future.length}>Дахин хийх</button><button className="button button--quiet" type="button" onClick={resetTree}>Шинээр эхлэх</button></div>
            <p className="keyboard-hint">Чимэглэлийг хулганаар чирж эсвэл сонгосны дараа суман товчоор хөдөлгөнө. Delete-ээр устгана.</p>
          </section>
        </aside>
      </section>
    </section>
  );
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ornament-${Math.random().toString(36).slice(2, 12)}`;
}

function wrapDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
