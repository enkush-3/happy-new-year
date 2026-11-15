import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import TreeScene, { clampToTree, treeCanvasPointFromClient, treePointFromClient, type TreeTool } from "./components/TreeScene";
import {
  addDecoration,
  addStroke,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  encodeTreeFragment,
  MAX_DECORATIONS,
  moveDecoration,
  removeDecoration,
  removeStroke,
  type OrnamentKind,
  type TreeDesign,
  type TreePenColor,
  type TreePenWidth,
  type TreeStroke,
} from "./lib/tree-state";
import { downloadTreePng } from "./lib/png-export";
import "./styles.css";

const palette: { kind: OrnamentKind; label: string; icon: string; color: string }[] = [
  { kind: "bauble-red", label: "Улаан бөмбөлөг", icon: "●", color: "#d96b5e" },
  { kind: "bauble-gold", label: "Алтан бөмбөлөг", icon: "●", color: "#f2c96e" },
  { kind: "bauble-green", label: "Ногоон бөмбөлөг", icon: "●", color: "#b4d6ae" },
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
const snowflakeCount = 32;
const stageSnowflakeCount = 18;

export default function App() {
  const [initialShare] = useState(() => decodeTreeFragment(window.location.hash));
  const [design, setDesign] = useState<TreeDesign>(initialShare.design);
  const [selectedKind, setSelectedKind] = useState<OrnamentKind | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [drawingTool, setDrawingTool] = useState<TreeTool>(initialShare.design.treeMode === "custom" ? "draw" : "decorate");
  const [penColor, setPenColor] = useState<TreePenColor>("snow");
  const [penWidth, setPenWidth] = useState<TreePenWidth>(8);
  const [strokeHistory, setStrokeHistory] = useState<TreeStroke[][]>([]);
  const [notice, setNotice] = useState(
    initialShare.valid ? "" : "Хуваалцсан модны линк буруу байна. Шинэ модноос эхэллээ.",
  );
  const [shareLink, setShareLink] = useState("");
  const [showShareLink, setShowShareLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const treeRef = useRef<SVGSVGElement>(null);
  const paletteDrag = useRef<{ kind: OrnamentKind; pointerId: number; x: number; y: number } | null>(null);
  const suppressTreeClick = useRef(false);

  useEffect(() => {
    function finishPaletteDrag(event: PointerEvent) {
      const drag = paletteDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      paletteDrag.current = null;

      const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      const svg = treeRef.current;
      const bounds = svg?.getBoundingClientRect();
      if (
        distance < 8 ||
        !svg ||
        !bounds ||
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      const point = design.treeMode === "custom"
        ? treeCanvasPointFromClient(svg, event.clientX, event.clientY)
        : treePointFromClient(svg, event.clientX, event.clientY);
      placeDecoration(drag.kind, point.x, point.y);
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
    const fragment = encodeTreeFragment(design);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${fragment}`,
    );
  }, [design]);

  const selectedLabel = palette.find((item) => item.kind === selectedKind)?.label;

  function placeDecoration(kind: OrnamentKind, x: number, y: number) {
    if (design.decorations.length >= MAX_DECORATIONS) {
      setNotice("Мод 48 чимэглэлтэй боллоо. Дахин нэмэхийн тулд нэгийг нь устгаарай.");
      return;
    }

    const point = design.treeMode === "custom" ? clampToCanvas(x, y) : clampToTree(x, y);
    const id = createId();
    const nextDesign = addDecoration(design, { id, kind, ...point });
    setDesign(nextDesign);
    setSelectedDecorationId(id);
    setNotice(`${palette.find((item) => item.kind === kind)?.label ?? "Чимэглэл"} модон дээр нэмэгдлээ.`);
  }

  function placeSelected(x: number, y: number) {
    if (!selectedKind) {
      setNotice("Эхлээд чимэглэл сонгоод модон дээр товшино уу.");
      return;
    }
    placeDecoration(selectedKind, x, y);
  }

  function handleTreePlace(x: number, y: number) {
    if (drawingTool !== "decorate") return;
    if (suppressTreeClick.current) {
      suppressTreeClick.current = false;
      return;
    }
    placeSelected(x, y);
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

  function handleMove(id: string, x: number, y: number) {
    const point = design.treeMode === "custom" ? clampToCanvas(x, y) : clampToTree(x, y);
    setDesign((current) => moveDecoration(current, id, point.x, point.y));
  }

  function chooseTreeMode(treeMode: TreeDesign["treeMode"]) {
    setDesign((current) => ({ ...current, treeMode }));
    setDrawingTool(treeMode === "custom" ? "draw" : "decorate");
    setSelectedKind(null);
    setSelectedDecorationId(null);
    setNotice(treeMode === "custom" ? "Сойзоор модоо зурна уу." : "Бэлэн гацуураа чимэглээрэй.");
  }

  function rememberStrokes() {
    setStrokeHistory((history) => [...history.slice(-19), design.strokes]);
  }

  function handleDraw(stroke: TreeStroke) {
    const nextDesign = addStroke(design, stroke);
    if (nextDesign === design) {
      setNotice("Зураасны хязгаарт хүрлээ. Нэг зураас устгаад дахин оролдоно уу.");
      return;
    }
    rememberStrokes();
    setDesign(nextDesign);
  }

  function handleEraseStroke(id: string) {
    const nextDesign = removeStroke(design, id);
    if (nextDesign === design) return;
    rememberStrokes();
    setDesign(nextDesign);
    setNotice("Зураасыг баллуурдлаа. Хүсвэл буцааж болно.");
  }

  function undoDrawing() {
    const previousStrokes = strokeHistory[strokeHistory.length - 1];
    if (!previousStrokes) return;
    setDesign((current) => ({ ...current, strokes: previousStrokes }));
    setStrokeHistory((history) => history.slice(0, -1));
    setNotice("Сүүлчийн зургийг буцаалаа.");
  }

  function clearDrawing() {
    if (!design.strokes.length) return;
    rememberStrokes();
    setDesign((current) => ({ ...current, strokes: [] }));
    setNotice("Өөрийн зурсан зурааснуудыг арилгалаа.");
  }

  function handleRemove(id: string) {
    setDesign((current) => removeDecoration(current, id));
    setSelectedDecorationId((current) => (current === id ? null : current));
    setNotice("Чимэглэлийг модноос авлаа.");
  }

  function resetTree() {
    setDesign(DEFAULT_TREE_DESIGN);
    setStrokeHistory([]);
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
    if (!treeRef.current) return;
    setIsDownloading(true);
    try {
      await downloadTreePng(treeRef.current);
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
        <button className="button button--quiet" type="button" onClick={undoDrawing} disabled={!strokeHistory.length} aria-label="Сүүлчийн зурсан зураасыг буцаах">Буцаах</button>
        <button className="button button--quiet" type="button" onClick={clearDrawing} disabled={!design.strokes.length}>Бүгдийг арилгах</button>
      </div>
      <p className="tool-hint"><span aria-hidden="true">✦</span> Өнгөө сонгоод модны мөчир, хэлбэрээ зурж болно.</p>
    </section>
  ) : null;

  return (
    <main className="page-shell">
      <div className="snowfall" aria-hidden="true">
        {Array.from({ length: snowflakeCount }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 37 + 8) % 100}%`,
              animationDuration: `${12 + (index * 7) % 17}s`,
              animationDelay: `${-((index * 11) % 25)}s`,
              fontSize: `${5 + (index % 5) * 2}px`,
              opacity: 0.36 + (index % 4) * 0.12,
            } as CSSProperties}
          />
        ))}
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Happy New Year нүүр хуудас">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>HAPPY <b>NEW YEAR</b></span>
        </a>
        <span className="header-note"><span className="header-note__dot" /> Баярын урлан</span>
      </header>

      <section className="intro" id="top" aria-labelledby="page-title">
        <p className="eyebrow"><span>✧</span> ӨВЛИЙН ЖИЖИГХЭН ИД ШИД <span>✧</span></p>
        <h1 id="page-title">Модоо чимэглээд,<br /><em>шинэ оноо угтаарай.</em></h1>
        <p className="intro-copy">Өөрийн гацуурыг бүтээгээд, дурсамжаа найзуудтайгаа хуваалцаарай.</p>
      </section>

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

          {drawingPanel}

          <div className="tree-stage">
            <div className="stage-glow" aria-hidden="true" />
            <div className="stage-snow stage-snow--one" aria-hidden="true" />
            <div className="stage-snow stage-snow--two" aria-hidden="true" />
            <div className="tree-stage__ground" aria-hidden="true" />
            <TreeScene
              design={design}
              selectedDecorationId={selectedDecorationId}
              drawingTool={drawingTool}
              penColor={penColor}
              penWidth={penWidth}
              svgRef={treeRef}
              onPlace={handleTreePlace}
              onMove={handleMove}
              onSelect={setSelectedDecorationId}
              onRemove={handleRemove}
              onDraw={handleDraw}
              onErase={handleEraseStroke}
            />
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
            <p className="keyboard-hint">Сонгосон чимэглэлийг суман товчоор хөдөлгөж, Delete-ээр устгана.</p>
          </section>
        </aside>
      </section>

      <footer className="site-footer">
        <span>❄</span> Багахан гэрэл, их хайртай шинэ жил. <span>❄</span>
      </footer>
    </main>
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
