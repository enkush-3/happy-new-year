import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import TreeScene, { clampToTree, treePointFromClient } from "./components/TreeScene";
import {
  addDecoration,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  encodeTreeFragment,
  MAX_DECORATIONS,
  moveDecoration,
  removeDecoration,
  type OrnamentKind,
  type TreeDesign,
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

export default function App() {
  const [initialShare] = useState(() => decodeTreeFragment(window.location.hash));
  const [design, setDesign] = useState<TreeDesign>(initialShare.design);
  const [selectedKind, setSelectedKind] = useState<OrnamentKind | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
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

      const point = treePointFromClient(svg, event.clientX, event.clientY);
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

    const point = clampToTree(x, y);
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
    paletteDrag.current = {
      kind,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleMove(id: string, x: number, y: number) {
    const point = clampToTree(x, y);
    setDesign((current) => moveDecoration(current, id, point.x, point.y));
  }

  function handleRemove(id: string) {
    setDesign((current) => removeDecoration(current, id));
    setSelectedDecorationId((current) => (current === id ? null : current));
    setNotice("Чимэглэлийг модноос авлаа.");
  }

  function resetTree() {
    setDesign(DEFAULT_TREE_DESIGN);
    setSelectedKind(null);
    setSelectedDecorationId(null);
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

  return (
    <main className="page-shell">
      <div className="snowfall" aria-hidden="true">
        <span>✦</span><span>·</span><span>✧</span><span>·</span><span>✦</span><span>·</span><span>✧</span>
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

          <div className="tree-stage">
            <div className="stage-glow" aria-hidden="true" />
            <div className="stage-snow stage-snow--one" aria-hidden="true" />
            <div className="stage-snow stage-snow--two" aria-hidden="true" />
            <div className="tree-stage__ground" aria-hidden="true" />
            <TreeScene
              design={design}
              selectedDecorationId={selectedDecorationId}
              svgRef={treeRef}
              onPlace={handleTreePlace}
              onMove={handleMove}
              onSelect={setSelectedDecorationId}
              onRemove={handleRemove}
            />
            <div className="stage-caption" aria-hidden="true"><span /> ОДОО ТАНЫ ЭЭЛЖ</div>
          </div>

          <p className="live-notice" role="status" aria-live="polite">
            {notice || (selectedKind ? `${selectedLabel} сонгогдлоо — модон дээр товшино уу.` : "Чимэглэл сонгоод модон дээр байрлуулаарай.")}
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
