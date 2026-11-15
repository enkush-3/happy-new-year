import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import TreeScene, { clampToTree, treeCanvasPointFromClient, treePointFromClient, type TreeTool } from "./components/TreeScene";
import Tree3DScene from "./components/Tree3DScene";
import {
  addDecoration,
  addStroke,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  duplicateDecoration,
  encodeTreeFragment,
  MAX_DECORATIONS,
  moveDecoration,
  removeDecoration,
  removeStroke,
  transformDecoration,
  type OrnamentColor,
  type OrnamentKind,
  type TreeDesign,
  type TreePenColor,
  type TreePenWidth,
  type TreeStroke,
} from "./model/tree-state";
import { downloadTreePng } from "./services/png-export";
import { loadLastTreeDesign, saveLastTreeDesign } from "./model/tree-storage";

const palette: { kind: OrnamentKind; label: string; icon: string; color: string }[] = [
  { kind: "bauble-red", label: "Улаан бөмбөлөг", icon: "●", color: "#d96b5e" },
  { kind: "bauble-gold", label: "Алтан бөмбөлөг", icon: "●", color: "#f2c96e" },
  { kind: "bauble-green", label: "Ногоон бөмбөлөг", icon: "●", color: "#a8c989" },
  { kind: "candy-cane", label: "Чихэрэн таяг", icon: "♧", color: "#f4e7ce" },
  { kind: "star", label: "Алтан од", icon: "✦", color: "#ffd978" },
];

const drawingColors: { color: TreePenColor; label: string; value: string }[] = [
  { color: "snow", label: "Цасан цагаан", value: "#f7f4ee" },
  { color: "gold", label: "Алтан шар", value: "#f4c96b" },
  { color: "berry", label: "Жимсний улаан", value: "#d76b75" },
  { color: "ice", label: "Мөсөн цэнхэр", value: "#98d8f2" },
];
const drawingWidths: TreePenWidth[] = [5, 8, 12];
const stageSnowflakeCount = 10;
const ornamentEditorColors: { color: OrnamentColor; label: string }[] = [
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
  const [drawingTool, setDrawingTool] = useState<TreeTool>(initialShare.design.treeMode === "custom" ? "draw" : "decorate");
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [cameraMode, setCameraMode] = useState<"edit" | "orbit">("edit");
  const [penColor, setPenColor] = useState<TreePenColor>("snow");
  const [penWidth, setPenWidth] = useState<TreePenWidth>(8);
  const [history, setHistory] = useState<{ past: TreeDesign[]; future: TreeDesign[] }>({ past: [], future: [] });
  const historyRef = useRef(history);
  historyRef.current = history;
  const [notice, setNotice] = useState(
    initialShare.valid ? "" : "Хуваалцсан модны линк буруу байна. Шинэ модноос эхэллээ.",
  );
  const [shareLink, setShareLink] = useState("");
  const [showShareLink, setShowShareLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const treeRef = useRef<SVGSVGElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const pendingMoveBeforeRef = useRef<TreeDesign | null>(null);
  const persistedFragmentRef = useRef<string | null>(null);
  const paletteDrag = useRef<{ kind: OrnamentKind; pointerId: number; x: number; y: number } | null>(null);
  const suppressTreeClick = useRef(false);
  const handleCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    threeCanvasRef.current = canvas;
  }, []);

  useEffect(() => {
    function finishPaletteDrag(event: PointerEvent) {
      const drag = paletteDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      paletteDrag.current = null;

      const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      const svg = treeRef.current;
      const canvas = threeCanvasRef.current;
      const target = svg ?? canvas;
      const bounds = target?.getBoundingClientRect();
      if (
        distance < 8 ||
        !target ||
        !bounds ||
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      if (svg) {
        const point = design.treeMode === "custom"
          ? treeCanvasPointFromClient(svg, event.clientX, event.clientY)
          : treePointFromClient(svg, event.clientX, event.clientY);
        placeDecoration(drag.kind, point.x, point.y);
      } else if (canvas && bounds) {
        const xRatio = (event.clientX - bounds.left) / bounds.width;
        const yRatio = (event.clientY - bounds.top) / bounds.height;
        const x = 0.5 + (xRatio - 0.5) * 0.65;
        placeDecoration(drag.kind, x, 0.16 + yRatio * 0.66, 0.5 + (xRatio - 0.5) * 0.72);
      }
      suppressTreeClick.current = true;
      window.setTimeout(() => {
        suppressTreeClick.current = false;
      }, 0);
    }

    function cancelPaletteDrag() {
      paletteDrag.current = null;
    }

    window.addEventListener("pointerup", finishPaletteDrag);
    window.addEventListener("pointercancel", cancelPaletteDrag);
    return () => {
      window.removeEventListener("pointerup", finishPaletteDrag);
      window.removeEventListener("pointercancel", cancelPaletteDrag);
    };
  }, [design]);

  useEffect(() => {
    if (pendingMoveBeforeRef.current) return;
    persistDesign(design);
  }, [design]);

  function persistDesign(nextDesign: TreeDesign) {
    const fragment = encodeTreeFragment(nextDesign);
    if (persistedFragmentRef.current === fragment) return;
    persistedFragmentRef.current = fragment;
    saveLastTreeDesign(nextDesign);
    window.history.replaceState(null, "", `${window.location.pathname}${fragment}`);
  }

  const selectedLabel = palette.find((item) => item.kind === selectedKind)?.label;
  const selectedDecoration = design.decorations.find((item) => item.id === selectedDecorationId);

  function pushHistory(snapshot: TreeDesign) {
    const current = historyRef.current;
    const next = { past: [...current.past.slice(-39), snapshot], future: [] };
    historyRef.current = next;
    setHistory(next);
  }

  function commitPendingMove() {
    const previous = pendingMoveBeforeRef.current;
    if (!previous) return;
    pendingMoveBeforeRef.current = null;
    pushHistory(previous);
  }

  function updateDesign(next: TreeDesign, record = true) {
    const current = designRef.current;
    if (next === current) return;
    if (record) {
      commitPendingMove();
      pushHistory(current);
    } else if (!pendingMoveBeforeRef.current) {
      pendingMoveBeforeRef.current = current;
    }
    designRef.current = next;
    setDesign(next);
  }

  function undoEdit() {
    commitPendingMove();
    const current = historyRef.current;
    const previous = current.past[current.past.length - 1];
    if (!previous) return;
    const nextHistory = { past: current.past.slice(0, -1), future: [designRef.current, ...current.future] };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    designRef.current = previous;
    setDesign(previous);
    setNotice("Сүүлчийн засварыг буцаалаа.");
  }

  function redoEdit() {
    const current = historyRef.current;
    const next = current.future[0];
    if (!next) return;
    const nextHistory = { past: [...current.past, designRef.current].slice(-40), future: current.future.slice(1) };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    designRef.current = next;
    setDesign(next);
    setNotice("Буцаасан засварыг сэргээлээ.");
  }

  function placeDecoration(kind: OrnamentKind, x: number, y: number, angle?: number) {
    if (designRef.current.decorations.length >= MAX_DECORATIONS) {
      setNotice("Мод 48 чимэглэлтэй боллоо. Дахин нэмэхийн тулд нэгийг нь устгаарай.");
      return;
    }

    const point = designRef.current.treeMode === "custom" ? clampToCanvas(x, y) : clampToTree(x, y);
    const id = createId();
    const itemColor = (palette.find((item) => item.kind === kind)?.color ?? "#ffd978") as OrnamentColor;
    const nextDesign = addDecoration(designRef.current, {
      id, kind, ...point,
      angle: angle ?? Math.round((0.5 + (point.x - 0.5) * 0.8) * 1000) / 1000,
      rotation: 0,
      scale: 1,
      color: itemColor,
    });
    updateDesign(nextDesign);
    setSelectedDecorationId(id);
    setNotice(`${palette.find((item) => item.kind === kind)?.label ?? "Чимэглэл"} модон дээр нэмэгдлээ.`);
  }

  function placeSelected(x: number, y: number, angle?: number) {
    if (!selectedKind) {
      setNotice("Эхлээд чимэглэл сонгоод модон дээр товшино уу.");
      return;
    }
    placeDecoration(selectedKind, x, y, angle);
  }

  function handleTreePlace(x: number, y: number, angle?: number) {
    if (drawingTool !== "decorate") return;
    if (suppressTreeClick.current) {
      suppressTreeClick.current = false;
      return;
    }
    placeSelected(x, y, angle);
  }

  function startPaletteDrag(kind: OrnamentKind, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setSelectedKind(kind);
    setSelectedDecorationId(null);
    setDrawingTool("decorate");
    paletteDrag.current = {
      kind,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleMove(id: string, x: number, y: number, angle?: number) {
    const point = designRef.current.treeMode === "custom" ? clampToCanvas(x, y) : clampToTree(x, y);
    updateDesign(moveDecoration(designRef.current, id, point.x, point.y, angle), false);
  }

  function handleMove3D(id: string, point: { x: number; y: number; angle: number }) {
    updateDesign(moveDecoration(designRef.current, id, point.x, point.y, point.angle), false);
  }

  function handleMoveCommit() {
    commitPendingMove();
    persistDesign(designRef.current);
  }

  function chooseTreeMode(treeMode: TreeDesign["treeMode"]) {
    updateDesign({ ...designRef.current, treeMode });
    setDrawingTool(treeMode === "custom" ? "draw" : "decorate");
    setSelectedKind(null);
    setSelectedDecorationId(null);
    setNotice(treeMode === "custom" ? "Сойзоор модоо зурна уу." : "Бэлэн гацуураа чимэглээрэй.");
  }

  function handleDraw(stroke: TreeStroke) {
    const nextDesign = addStroke(designRef.current, stroke);
    if (nextDesign === designRef.current) {
      setNotice("Зураасны хязгаарт хүрлээ. Нэг зураас устгаад дахин оролдоно уу.");
      return;
    }
    updateDesign(nextDesign);
  }

  function handleEraseStroke(id: string) {
    const nextDesign = removeStroke(designRef.current, id);
    if (nextDesign === designRef.current) return;
    updateDesign(nextDesign);
    setNotice("Зураасыг баллуурдлаа. Хүсвэл буцааж болно.");
  }

  function clearDrawing() {
    if (!design.strokes.length) return;
    updateDesign({ ...designRef.current, strokes: [] });
    setNotice("Өөрийн зурсан зурааснуудыг арилгалаа.");
  }

  function handleRemove(id: string) {
    updateDesign(removeDecoration(designRef.current, id));
    setSelectedDecorationId((current) => (current === id ? null : current));
    setNotice("Чимэглэлийг модноос авлаа.");
  }

  function transformSelected(transform: Parameters<typeof transformDecoration>[2], message: string) {
    if (!selectedDecorationId) return;
    updateDesign(transformDecoration(designRef.current, selectedDecorationId, transform));
    setNotice(message);
  }

  function duplicateSelected() {
    if (!selectedDecorationId) return;
    const id = createId();
    updateDesign(duplicateDecoration(designRef.current, selectedDecorationId, id));
    setSelectedDecorationId(id);
    setNotice("Чимэглэлийг хуулбарлалаа.");
  }

  function resetTree() {
    updateDesign(DEFAULT_TREE_DESIGN);
    pendingMoveBeforeRef.current = null;
    setSelectedKind(null);
    setSelectedDecorationId(null);
    setDrawingTool("decorate");
    setShareLink("");
    setShowShareLink(false);
    setNotice("Модоо шинээр эхлүүллээ.");
  }

  function createShareUrl() {
    const fragment = encodeTreeFragment(design);
    const url = `${window.location.origin}${window.location.pathname}${fragment}`;
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
        await navigator.share({
          title: "Миний шинэ жилийн гацуур",
          text: "Миний чимэглэсэн гацуурыг үзээрэй!",
          url,
        });
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
    const url = createShareUrl();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Модны линкийг хууллаа. Найзууддаа илгээгээрэй!");
    } catch {
      showManualCopyFallback();
    }
  }

  async function savePng() {
    const source = threeCanvasRef.current ?? treeRef.current;
    if (!source) return;
    setIsDownloading(true);
    try {
      await downloadTreePng(source);
      setNotice("Таны модны зураг бэлэн боллоо.");
    } catch {
      setNotice("Зураг үүсгэж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setIsDownloading(false);
    }
  }

  const drawingPanel = design.treeMode === "custom" ? (
    <section className="tool-card drawing-card" aria-labelledby="drawing-title">
      <div className="section-title-row">
        <div className="section-icon section-icon--blue" aria-hidden="true">✎</div>
        <div>
          <h2 id="drawing-title">Өөрийн гацуурыг зур</h2>
          <p>Зурган дээрээ хуруу эсвэл хулганаар чирнэ үү</p>
        </div>
      </div>
      <div className="drawing-tools" role="group" aria-label="Зургийн хэрэгсэл">
        <button className={`tool-chip${drawingTool === "draw" ? " is-active" : ""}`} type="button" aria-pressed={drawingTool === "draw"} onClick={() => setDrawingTool("draw")}>Сойз</button>
        <button className={`tool-chip${drawingTool === "erase" ? " is-active" : ""}`} type="button" aria-pressed={drawingTool === "erase"} onClick={() => setDrawingTool("erase")}>Баллуур</button>
        <button className={`tool-chip${drawingTool === "decorate" ? " is-active" : ""}`} type="button" aria-pressed={drawingTool === "decorate"} onClick={() => setDrawingTool("decorate")}>Чимэглэх</button>
      </div>
      <div className="draw-color-palette" role="group" aria-label="Зурах өнгө">
        {drawingColors.map((item) => (
          <button
            key={item.color}
            type="button"
            className={`draw-color${penColor === item.color ? " is-active" : ""}`}
            style={{ "--swatch": item.value } as CSSProperties}
            aria-label={item.label}
            aria-pressed={penColor === item.color}
            onClick={() => { setPenColor(item.color); setDrawingTool("draw"); }}
          />
        ))}
      </div>
      <div className="draw-widths" role="group" aria-label="Сойзны хэмжээ">
        {drawingWidths.map((width, index) => (
          <button
            key={width}
            type="button"
            className={`width-button${penWidth === width ? " is-active" : ""}`}
            aria-label={`${["Нарийн", "Дунд", "Өргөн"][index]} сойз`}
            aria-pressed={penWidth === width}
            onClick={() => { setPenWidth(width); setDrawingTool("draw"); }}
          ><span style={{ width: `${4 + index * 3}px`, height: `${4 + index * 3}px` }} /></button>
        ))}
      </div>
      <div className="edit-buttons drawing-actions">
        <button className="button button--quiet" type="button" onClick={undoEdit} disabled={!history.past.length} aria-label="Сүүлчийн зурсан зураасыг буцаах">Буцаах</button>
        <button className="button button--quiet" type="button" onClick={redoEdit} disabled={!history.future.length}>Дахин хийх</button>
        <button className="button button--quiet" type="button" onClick={clearDrawing} disabled={!design.strokes.length}>Бүгдийг арилгах</button>
      </div>
      <p className="tool-hint"><span aria-hidden="true">✦</span> Өнгөө сонгоод модны мөчир, хэлбэрээ зурж болно.</p>
    </section>
  ) : null;

  return (
    <section className="tree-game-page" aria-labelledby="tree-game-title">
      <div className="game-page-heading">
        <p className="eyebrow">ГАЦУУРЫН УРЛАН</p>
        <h1 id="tree-game-title">Модоо өөрийнхөөрөө бүтээ</h1>
        <p className="intro-copy">Чимэглэлээ байрлуулж эсвэл өөрийн гацуураа зурж, үр дүнгээ хуваалцаарай.</p>
      </div>
            <section className="studio" aria-label="Гацуур чимэглэх урлан">
        <div className="studio__tree-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">ТАНЫ ШИНЭ ЖИЛИЙН МОД</span>
              <h2>Өөрийнхөөрөө бүтээ</h2>
            </div>
            <span className="decoration-count" aria-label={`${design.decorations.length} чимэглэл`}>
              <span aria-hidden="true">✦</span> {design.decorations.length} чимэглэл
            </span>
          </div>

          <div className="tree-mode-switch" role="group" aria-label="Модны загвараа сонгох">
            <button
              type="button"
              className={`mode-button${design.treeMode === "classic" ? " is-active" : ""}`}
              aria-pressed={design.treeMode === "classic"}
              onClick={() => chooseTreeMode("classic")}
            >
              <span aria-hidden="true">♧</span> Бэлэн гацуур
            </button>
            <button
              type="button"
              className={`mode-button${design.treeMode === "custom" ? " is-active" : ""}`}
              aria-pressed={design.treeMode === "custom"}
              onClick={() => chooseTreeMode("custom")}
            >
              <span aria-hidden="true">✎</span> Өөрөө модоо зурах
            </button>
          </div>

          {design.treeMode === "classic" && (
            <div className="tree-view-switch" role="group" aria-label="Модны харагдац">
              <button className={`tool-chip${viewMode === "3d" ? " is-active" : ""}`} type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>3D мод</button>
              <button className={`tool-chip${viewMode === "2d" ? " is-active" : ""}`} type="button" aria-pressed={viewMode === "2d"} onClick={() => setViewMode("2d")}>2D зураг</button>
              {viewMode === "3d" && <button className={`tool-chip${cameraMode === "orbit" ? " is-active" : ""}`} type="button" aria-pressed={cameraMode === "orbit"} onClick={() => setCameraMode(cameraMode === "orbit" ? "edit" : "orbit")}>Модоо эргүүлж харах</button>}
            </div>
          )}

          {drawingPanel}

          <div className="tree-stage">
            <div className="stage-glow" aria-hidden="true" />
            <div className="stage-snow stage-snow--one" aria-hidden="true" />
            <div className="stage-snow stage-snow--two" aria-hidden="true" />
            <div className="tree-stage__ground" aria-hidden="true" />
            {design.treeMode === "classic" && viewMode === "3d" ? (
              <Tree3DScene
                design={design}
                selectedDecorationId={selectedDecorationId}
                selectedKind={selectedKind}
                viewMode={cameraMode}
                onCanvas={handleCanvas}
                onPlace={(kind, point) => placeDecoration(kind, point.x, point.y, point.angle)}
                onMove={handleMove3D}
                onMoveCommit={handleMoveCommit}
                onSelect={setSelectedDecorationId}
                fallback={(
                  <TreeScene
                    design={design}
                    selectedDecorationId={selectedDecorationId}
                    drawingTool={drawingTool}
                    penColor={penColor}
                    penWidth={penWidth}
                    svgRef={treeRef}
                    onPlace={handleTreePlace}
                    onMove={handleMove}
                    onMoveCommit={handleMoveCommit}
                    onSelect={setSelectedDecorationId}
                    onRemove={handleRemove}
                    onDraw={handleDraw}
                    onErase={handleEraseStroke}
                  />
                )}
              />
            ) : (
              <TreeScene
                design={design}
                selectedDecorationId={selectedDecorationId}
                drawingTool={drawingTool}
                penColor={penColor}
                penWidth={penWidth}
                svgRef={treeRef}
                onPlace={handleTreePlace}
                onMove={handleMove}
                onMoveCommit={handleMoveCommit}
                onSelect={setSelectedDecorationId}
                onRemove={handleRemove}
                onDraw={handleDraw}
                onErase={handleEraseStroke}
              />
            )}
            <div className="stage-fall" aria-hidden="true">
              {Array.from({ length: stageSnowflakeCount }, (_, index) => (
                <i
                  key={index}
                  style={{
                    left: `${(index * 43 + 4) % 100}%`,
                    animationDuration: `${5 + (index * 3) % 8}s`,
                    animationDelay: `${-((index * 5) % 11)}s`,
                    width: `${2 + index % 3}px`,
                    height: `${2 + index % 3}px`,
                    opacity: 0.45 + (index % 4) * 0.12,
                  }}
                />
              ))}
            </div>
            <div className="stage-caption" aria-hidden="true"><span /> ОДОО ТАНЫ ЭЭЛЖ</div>
          </div>

          <p className="live-notice" role="status" aria-live="polite">
            {notice || (selectedKind
              ? `${selectedLabel} сонгогдлоо — модон дээр товшино уу.`
              : design.treeMode === "custom"
                ? drawingTool === "decorate" ? "Чимэглэл сонгоод өөрийн зурсан модон дээр байрлуулаарай." : "Сойзоо чирж өөрийн гацуурыг зурна уу."
                : "Чимэглэл сонгоод модон дээр байрлуулаарай.")}
          </p>
        </div>

        <aside className="studio__tools" aria-label="Модны чимэглэл ба хэрэгслүүд">
          <section className="tool-card palette-card" aria-labelledby="palette-title">
            <div className="section-title-row">
              <div className="section-icon" aria-hidden="true">✧</div>
              <div>
                <h2 id="palette-title">Чимэглэл сонгох</h2>
                <p>Товшоод байрлуулах эсвэл мод руу чирнэ үү</p>
              </div>
            </div>

            <div className="ornament-palette" role="group" aria-label="Чимэглэлийн сонголт">
              {palette.map((item) => (
                <button
                  key={item.kind}
                  className={`palette-item${selectedKind === item.kind ? " is-active" : ""}`}
                  type="button"
                  aria-label={`${item.label} сонгох`}
                  aria-pressed={selectedKind === item.kind}
                  disabled={design.decorations.length >= MAX_DECORATIONS}
                  onPointerDown={(event) => startPaletteDrag(item.kind, event)}
                  onPointerCancel={() => {
                    paletteDrag.current = null;
                  }}
                  onClick={() => {
                    setSelectedKind(item.kind);
                    setSelectedDecorationId(null);
                    setDrawingTool("decorate");
                    setNotice(`${item.label} сонгогдлоо — модон дээр товшино уу.`);
                  }}
                >
                  <span className={`palette-item__icon icon-${item.kind}`} style={{ color: item.color }} aria-hidden="true">{item.icon}</span>
                  <span className="palette-item__label">{item.label}</span>
                </button>
              ))}
            </div>
            <p className="tool-hint"><span aria-hidden="true">↳</span> Байрлуулсан чимэглэлээ модон дээр чирж хөдөлгөж болно.</p>
            {design.decorations.length > 0 && (
              <div className="tree-placed-list" role="group" aria-label="Модон дээрх чимэглэлүүд">
                {design.decorations.map((decoration, index) => (
                  <button
                    key={decoration.id}
                    className={`tree-placed-item${selectedDecorationId === decoration.id ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={selectedDecorationId === decoration.id}
                    onClick={() => setSelectedDecorationId(decoration.id)}
                  >
                    <span aria-hidden="true" style={{ color: decoration.color }}>●</span>
                    {palette.find((item) => item.kind === decoration.kind)?.label ?? "Чимэглэл"} {index + 1}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="tool-card action-card" aria-labelledby="action-title">
            <div className="section-title-row section-title-row--compact">
              <div className="section-icon section-icon--gold" aria-hidden="true">♡</div>
              <div>
                <h2 id="action-title">Модоо хуваалцах</h2>
                <p>Бүтээлээ найзууддаа илгээгээрэй</p>
              </div>
            </div>
            <div className="action-buttons">
              <button className="button button--primary" type="button" onClick={shareTree}>
                <span aria-hidden="true">↗</span> Хуваалцах
              </button>
              <button className="button button--secondary" type="button" onClick={copyTreeLink}>
                <span aria-hidden="true">⧉</span> Линк хуулах
              </button>
              <button className="button button--secondary" type="button" onClick={savePng} disabled={isDownloading}>
                <span aria-hidden="true">↓</span> {isDownloading ? "Бэлдэж байна…" : "PNG зураг татах"}
              </button>
            </div>
            {showShareLink && (
              <div className="share-link-wrap">
                <label htmlFor="share-link">Модны share линк</label>
                <input
                  id="share-link"
                  type="url"
                  readOnly
                  value={shareLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
            )}
          </section>

          <section className="tool-card edit-card" aria-labelledby="edit-title">
            <div className="section-title-row section-title-row--compact">
              <div className="section-icon section-icon--muted" aria-hidden="true">✳</div>
              <div>
                <h2 id="edit-title">Засварлах</h2>
                <p>{selectedDecorationId ? "Сонгосон чимэглэлээ устгах эсвэл" : "Модоо цэвэрлээд шинээр эхлээрэй"}</p>
              </div>
            </div>
            <div className="edit-buttons">
              <button
                className="button button--quiet"
                type="button"
                onClick={() => selectedDecorationId && handleRemove(selectedDecorationId)}
                disabled={!selectedDecorationId}
              >
                Устгах
              </button>
              <button className="button button--quiet" type="button" onClick={resetTree}>
                Шинээр эхлэх
              </button>
            </div>
            {selectedDecoration && (
              <>
                <div className="tree-editor-controls" aria-label="Сонгосон чимэглэлийн тохиргоо">
                  <button className="button button--quiet" type="button" onClick={duplicateSelected} disabled={design.decorations.length >= MAX_DECORATIONS}>Хуулбарлах</button>
                  <button className="button button--quiet" type="button" onClick={() => transformSelected({ rotation: wrapDegrees(selectedDecoration.rotation + 15) }, "Чимэглэлийг эргүүллээ.")}>↻ 15°</button>
                  <button className="button button--quiet" type="button" onClick={() => transformSelected({ scale: Math.min(1.6, selectedDecoration.scale + 0.1) }, "Чимэглэлийг томрууллаа.")} disabled={selectedDecoration.scale >= 1.6}>Томруулах</button>
                  <button className="button button--quiet" type="button" onClick={() => transformSelected({ scale: Math.max(0.6, selectedDecoration.scale - 0.1) }, "Чимэглэлийг жижгэрүүллээ.")} disabled={selectedDecoration.scale <= 0.6}>Жижигрүүлэх</button>
                </div>
                <div className="tree-editor-colors" role="group" aria-label="Чимэглэлийн өнгө">
                  {ornamentEditorColors.map((item) => (
                    <button
                      key={item.color}
                      className={`tree-editor-color${selectedDecoration.color === item.color ? " is-active" : ""}`}
                      style={{ "--tree-color": item.color } as CSSProperties}
                      type="button"
                      aria-label={`${item.label} өнгө`}
                      aria-pressed={selectedDecoration.color === item.color}
                      onClick={() => transformSelected({ color: item.color }, `${item.label} өнгөөр сольлоо.`)}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="edit-buttons">
              <button className="button button--quiet" type="button" onClick={undoEdit} disabled={!history.past.length}>Буцаах</button>
              <button className="button button--quiet" type="button" onClick={redoEdit} disabled={!history.future.length}>Дахин хийх</button>
            </div>
            <p className="keyboard-hint">Сонгосон чимэглэлийг суман товчоор хөдөлгөж, Delete-ээр устгана.</p>
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

function clampToCanvas(x: number, y: number) {
  return {
    x: Math.min(0.975, Math.max(0.025, x)),
    y: Math.min(0.92, Math.max(0.03, y)),
  };
}

function wrapDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
