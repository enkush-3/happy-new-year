import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { OrnamentKind, TreeDecoration, TreeDesign, TreePenColor, TreePenWidth, TreePoint, TreeStroke } from "../lib/tree-state";
import { MAX_POINTS_PER_STROKE, TREE_PLACEMENT_BOUNDS } from "../lib/tree-state";

export type TreeTool = "draw" | "erase" | "decorate";
const maxActivePointerPoints = 2048;

interface TreeSceneProps {
  design: TreeDesign;
  selectedDecorationId: string | null;
  drawingTool: TreeTool;
  penColor: TreePenColor;
  penWidth: TreePenWidth;
  svgRef: RefObject<SVGSVGElement | null>;
  onPlace: (x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDraw: (stroke: TreeStroke) => void;
  onErase: (id: string) => void;
}

const labels: Record<OrnamentKind, string> = {
  "bauble-red": "Улаан бөмбөлөг",
  "bauble-gold": "Алтан бөмбөлөг",
  "bauble-green": "Ногоон бөмбөлөг",
  "candy-cane": "Чихэрэн таяг",
  star: "Алтан од",
};

const colors: Record<OrnamentKind, string> = {
  "bauble-red": "#d96b5e",
  "bauble-gold": "#f2c96e",
  "bauble-green": "#a8c989",
  "candy-cane": "#f4e7ce",
  star: "#ffd978",
};

const penColors: Record<TreePenColor, string> = {
  snow: "#f7f4ee",
  gold: "#f4c96b",
  berry: "#d76b75",
  ice: "#98d8f2",
};

export function treePointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = rawTreePointFromClient(svg, clientX, clientY);
  return clampToTree(point.x, point.y);
}

export function treeCanvasPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = rawTreePointFromClient(svg, clientX, clientY);
  return {
    x: clamp(point.x, 0.015, 0.985),
    y: clamp(point.y, 0.025, 0.945),
  };
}

function rawTreePointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return { x: 0.5, y: 0.52 };

  const viewBoxWidth = svg.viewBox.baseVal.width || 400;
  const viewBoxHeight = svg.viewBox.baseVal.height || 560;
  const screenMatrix = svg.getScreenCTM?.();
  if (screenMatrix && svg.createSVGPoint) {
    try {
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = clientX;
      screenPoint.y = clientY;
      const viewBoxPoint = screenPoint.matrixTransform(screenMatrix.inverse());
      return { x: viewBoxPoint.x / viewBoxWidth, y: viewBoxPoint.y / viewBoxHeight };
    } catch {
      // A detached SVG can briefly expose a singular screen matrix during layout.
    }
  }

  const scale = Math.min(bounds.width / viewBoxWidth, bounds.height / viewBoxHeight);
  const renderedWidth = viewBoxWidth * scale;
  const renderedHeight = viewBoxHeight * scale;
  const offsetX = bounds.left + (bounds.width - renderedWidth) / 2;
  const offsetY = bounds.top + (bounds.height - renderedHeight) / 2;
  return {
    x: (clientX - offsetX) / renderedWidth,
    y: (clientY - offsetY) / renderedHeight,
  };
}

export function clampToTree(x: number, y: number) {
  const boundedY = clamp(y, TREE_PLACEMENT_BOUNDS.minY, TREE_PLACEMENT_BOUNDS.maxY);
  const progress =
    (boundedY - TREE_PLACEMENT_BOUNDS.minY) /
    (TREE_PLACEMENT_BOUNDS.maxY - TREE_PLACEMENT_BOUNDS.minY);
  const halfWidth = 0.045 + progress * 0.305;
  return {
    x: clamp(x, 0.5 - halfWidth, 0.5 + halfWidth),
    y: boundedY,
  };
}

function clampToCanvas(x: number, y: number) {
  return { x: clamp(x, 0.025, 0.975), y: clamp(y, 0.03, 0.92) };
}

export default function TreeScene({
  design,
  selectedDecorationId,
  drawingTool,
  penColor,
  penWidth,
  svgRef,
  onPlace,
  onMove,
  onSelect,
  onRemove,
  onDraw,
  onErase,
}: TreeSceneProps) {
  const draggingId = useRef<string | null>(null);
  const activePointerId = useRef<number | null>(null);
  const activePoints = useRef<TreePoint[]>([]);
  const erasedIds = useRef(new Set<string>());
  const [previewPoints, setPreviewPoints] = useState<TreePoint[] | null>(null);
  const [keyboardPoints, setKeyboardPoints] = useState<TreePoint[]>([]);
  const isCustom = design.treeMode === "custom";
  const canDraw = isCustom && drawingTool === "draw";
  const canErase = isCustom && drawingTool === "erase";

  useEffect(() => {
    if (!isCustom || drawingTool !== "draw") setKeyboardPoints([]);
  }, [isCustom, drawingTool]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !svgRef.current || (!canDraw && !canErase)) return;
    event.preventDefault();
    const point = treeCanvasPointFromClient(svgRef.current, event.clientX, event.clientY);
    activePointerId.current = event.pointerId;
    erasedIds.current.clear();
    if (canDraw) {
      activePoints.current = [point];
      setPreviewPoints([point]);
    } else {
      eraseNear(point);
    }
    try {
      svgRef.current.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not exposed by every browser or test environment.
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointerId.current === event.pointerId && canDraw && svgRef.current) {
      const point = treeCanvasPointFromClient(svgRef.current, event.clientX, event.clientY);
      const points = activePoints.current;
      const previous = points[points.length - 1];
      if (Math.hypot((point.x - previous.x) * 400, (point.y - previous.y) * 560) >= 2) {
        const extended = [...points, point];
        const next = extended.length > maxActivePointerPoints
          ? simplifyStrokePoints(extended, maxActivePointerPoints / 2)
          : extended;
        activePoints.current = next;
        setPreviewPoints(simplifyStrokePoints(next));
      }
      return;
    }

    if (activePointerId.current === event.pointerId && canErase && svgRef.current) {
      eraseNear(treeCanvasPointFromClient(svgRef.current, event.clientX, event.clientY));
      return;
    }

    if (!draggingId.current || !svgRef.current) return;
    const point = isCustom
      ? treeCanvasPointFromClient(svgRef.current, event.clientX, event.clientY)
      : treePointFromClient(svgRef.current, event.clientX, event.clientY);
    onMove(draggingId.current, point.x, point.y);
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (activePointerId.current === event.pointerId && canDraw) {
      const points = simplifyStrokePoints(activePoints.current);
      if (points.length === 1) points.push(points[0]);
      onDraw({ id: createStrokeId(), color: penColor, width: penWidth, points });
    }
    if (activePointerId.current === event.pointerId) {
      activePointerId.current = null;
      activePoints.current = [];
      setPreviewPoints(null);
      erasedIds.current.clear();
    }
    draggingId.current = null;
  }

  function handlePointerCancel(event: PointerEvent<SVGSVGElement>) {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    activePoints.current = [];
    setPreviewPoints(null);
    erasedIds.current.clear();
    draggingId.current = null;
  }

  function eraseNear(point: TreePoint) {
    const hit = design.strokes.find((stroke) =>
      !erasedIds.current.has(stroke.id) && isNearStroke(stroke.points, point, 17),
    );
    if (!hit) return;
    erasedIds.current.add(hit.id);
    onErase(hit.id);
  }

  function handleRootKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;

    if (canDraw) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (keyboardPoints.length === 0) {
          setKeyboardPoints([{ x: 0.5, y: 0.2 }]);
        } else if (keyboardPoints.length > 1) {
          onDraw({
            id: createStrokeId(),
            color: penColor,
            width: penWidth,
            points: simplifyStrokePoints(keyboardPoints),
          });
          setKeyboardPoints([]);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setKeyboardPoints([]);
        return;
      }
      const nudges: Record<string, [number, number]> = {
        ArrowUp: [0, -0.025],
        ArrowDown: [0, 0.025],
        ArrowLeft: [-0.025, 0],
        ArrowRight: [0.025, 0],
      };
      const nudge = nudges[event.key];
      if (nudge) {
        event.preventDefault();
        setKeyboardPoints((points) => {
          const base = points.length ? points : [{ x: 0.5, y: 0.2 }];
          const previous = base[base.length - 1];
          return [...base, clampToCanvas(previous.x + nudge[0], previous.y + nudge[1])];
        });
      }
      return;
    }

    if (canErase && (event.key === "Delete" || event.key === "Backspace")) {
      const lastStroke = design.strokes[design.strokes.length - 1];
      if (lastStroke) {
        event.preventDefault();
        onErase(lastStroke.id);
      }
      return;
    }

    if ((event.key !== "Enter" && event.key !== " ") || drawingTool !== "decorate") return;
    event.preventDefault();
    onPlace(0.5, 0.52);
  }

  function handleDecorationPointerDown(event: PointerEvent<SVGGElement>, decoration: TreeDecoration) {
    if (isCustom && drawingTool !== "decorate") return;
    event.stopPropagation();
    event.preventDefault();
    onSelect(decoration.id);
    draggingId.current = decoration.id;
    try {
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not exposed by every browser or test environment.
    }
  }

  function handleDecorationKeyDown(event: KeyboardEvent<SVGGElement>, decoration: TreeDecoration) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(decoration.id);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(decoration.id);
      return;
    }
    const nudges: Record<string, [number, number]> = {
      ArrowUp: [0, -0.025],
      ArrowDown: [0, 0.025],
      ArrowLeft: [-0.025, 0],
      ArrowRight: [0.025, 0],
    };
    const nudge = nudges[event.key];
    if (nudge) {
      event.preventDefault();
      const point = isCustom
        ? clampToCanvas(decoration.x + nudge[0], decoration.y + nudge[1])
        : clampToTree(decoration.x + nudge[0], decoration.y + nudge[1]);
      onMove(decoration.id, point.x, point.y);
    }
  }

  const interactionLabel = canDraw
    ? "Чирж зурах, эсвэл Enter дарж эхлүүлээд суман товчоор зурж Enter-ээр дуусгах"
    : canErase
      ? "Зураас дээр чирж баллуурдах, эсвэл Delete дарж сүүлчийн зураасыг арилгах"
      : "Чимэглэл байрлуулах";
  const currentPreview = previewPoints ?? (keyboardPoints.length ? simplifyStrokePoints(keyboardPoints) : null);

  return (
    <svg
      ref={svgRef}
      className={`tree-art${isCustom ? " tree-art--custom" : ""}${canDraw ? " tree-art--drawing" : ""}${canErase ? " tree-art--erasing" : ""}`}
      viewBox="0 0 400 560"
      role="group"
      aria-label={isCustom ? "Өөрөө зурж бүтээх мод" : "Чимэглэх гацуур"}
      aria-description={interactionLabel}
      tabIndex={0}
      onClick={(event) => {
        if (drawingTool !== "decorate") return;
        const point = svgRef.current
          ? isCustom
            ? treeCanvasPointFromClient(svgRef.current, event.clientX, event.clientY)
            : treePointFromClient(svgRef.current, event.clientX, event.clientY)
          : { x: 0.5, y: 0.52 };
        onPlace(point.x, point.y);
      }}
      onKeyDown={handleRootKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="pine-gradient" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#5d9d79" />
          <stop offset="28%" stopColor="#347557" />
          <stop offset="68%" stopColor="#1d513e" />
          <stop offset="100%" stopColor="#10392f" />
        </linearGradient>
        <linearGradient id="branch-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#174a3d" stopOpacity="0" />
          <stop offset="100%" stopColor="#08271f" stopOpacity=".78" />
        </linearGradient>
        <linearGradient id="trunk-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#70452c" />
          <stop offset="50%" stopColor="#bf8650" />
          <stop offset="100%" stopColor="#70452c" />
        </linearGradient>
        <radialGradient id="tree-aura">
          <stop offset="0%" stopColor="#f6d48c" stopOpacity=".31" />
          <stop offset="56%" stopColor="#b99464" stopOpacity=".11" />
          <stop offset="100%" stopColor="#f5cf80" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="star-aura">
          <stop offset="0%" stopColor="#ffe7a0" stopOpacity=".62" />
          <stop offset="100%" stopColor="#ffc95b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {design.treeMode === "classic" && <ClassicTree />}

      {design.treeMode === "custom" && design.strokes.length === 0 && !previewPoints && (
        <text x="200" y="285" className="draw-empty-hint" textAnchor="middle">Модоо энд зураарай</text>
      )}

      {isCustom && design.strokes.map((stroke) => (
        <path
          key={stroke.id}
          d={pathFromPoints(stroke.points)}
          fill="none"
          stroke={penColors[stroke.color]}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drawn-tree-stroke"
          data-testid="tree-stroke"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}
      {currentPreview && (
        <path
          d={pathFromPoints(currentPreview)}
          fill="none"
          stroke={penColors[penColor]}
          strokeWidth={penWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drawn-tree-stroke drawn-tree-stroke--preview"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}

      {design.decorations.map((decoration) => (
        <g
          key={decoration.id}
          transform={`translate(${decoration.x * 400} ${decoration.y * 560})`}
          role="button"
          aria-label={`Модон дээрх ${labels[decoration.kind]}`}
          aria-pressed={selectedDecorationId === decoration.id}
          tabIndex={0}
          data-testid="placed-decoration"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(decoration.id);
          }}
          onPointerDown={(event) => handleDecorationPointerDown(event, decoration)}
          onPointerUp={() => { draggingId.current = null; }}
          onKeyDown={(event) => handleDecorationKeyDown(event, decoration)}
          className={`tree-decoration${selectedDecorationId === decoration.id ? " is-selected" : ""}`}
        >
          {selectedDecorationId === decoration.id && (
            <circle r="23" fill="#fff5d6" fillOpacity=".12" stroke="#fff0c1" strokeWidth="2" strokeDasharray="4 5" />
          )}
          <g className="ornament-pop" aria-hidden="true">
            {decoration.kind === "star" ? (
              <>
                <circle r="23" fill="#f8d274" fillOpacity=".18" />
                <polygon points={starPoints(17, 8)} fill={colors[decoration.kind]} stroke="#fff0b8" strokeWidth="2" strokeLinejoin="round" />
              </>
            ) : decoration.kind === "candy-cane" ? (
              <>
                <path d="M-8 11v-17a9 9 0 0 1 18 0v5" fill="none" stroke="#fff3dc" strokeWidth="13" strokeLinecap="round" />
                <path d="M-8 11v-17a9 9 0 0 1 18 0v5" fill="none" stroke="#d76b5d" strokeWidth="5" strokeDasharray="5 6" strokeLinecap="round" />
                <path d="M-13 12h10" stroke="#e7c875" strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M-5-13v-8h10v8" fill="#dfbd7c" stroke="#f4e4b6" strokeWidth="2" />
                <circle r="14" fill={colors[decoration.kind]} stroke="#fff0c0" strokeWidth="2.2" />
                <ellipse cx="-5" cy="-5" rx="3.4" ry="5" fill="#fff" opacity=".46" />
                <path d="M-7 15h14" stroke="#fff0c0" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </g>
        </g>
      ))}
    </svg>
  );
}

function ClassicTree() {
  const lights = [
    [175, 135], [198, 150], [218, 139], [147, 198], [174, 213], [204, 219], [232, 210], [260, 192],
    [111, 279], [145, 296], [180, 302], [218, 300], [254, 292], [289, 276], [78, 387], [121, 404],
    [164, 415], [202, 418], [242, 414], [282, 402], [322, 386],
  ];

  return (
    <g className="classic-tree" data-testid="classic-tree">
      <ellipse cx="200" cy="279" rx="181" ry="229" fill="url(#tree-aura)" />
      <ellipse cx="200" cy="496" rx="143" ry="19" fill="#020914" opacity=".6" />
      <path d="M178 407h44v86h-44z" fill="url(#trunk-gradient)" stroke="#dfad78" strokeOpacity=".3" />
      <path d="M200 54c-12 29-24 55-59 87 23-7 42-7 59 8-30 15-55 38-86 78 31-10 55-5 79 9-40 18-76 49-114 90 37-11 70-3 101 10-53 24-98 60-145 108 54-14 100-10 142 5-25 18-49 34-68 52 29 7 60 11 91 11s62-4 91-11c-19-18-43-34-68-52 42-15 88-19 142-5-47-48-92-84-145-108 31-13 64-21 101-10-38-41-74-72-114-90 24-14 48-19 79-9-31-40-56-63-86-78 17-15 36-15 59-8-35-32-47-58-59-87z" fill="url(#pine-gradient)" stroke="#a9d6df" strokeOpacity=".19" strokeWidth="2" strokeLinejoin="round" />
      <path d="M200 54c-12 29-24 55-59 87 24-8 42-6 59 8-29 15-55 38-86 78 32-8 55-5 79 9-41 18-76 49-114 90 38-9 69-3 101 10-53 24-98 60-145 108 54-14 100-10 142 5-25 18-49 34-68 52 29 7 60 11 91 11" fill="url(#branch-shade)" opacity=".65" />

      <g className="tree-snow-caps" fill="none" stroke="#e8f3fb" strokeLinecap="round" strokeLinejoin="round">
        <path d="M197 63c-8 24-23 48-47 69 18-4 31-1 45 10" strokeWidth="6" />
        <path d="M194 159c-22 14-41 31-63 57 22-6 41-2 59 9" strokeWidth="7" />
        <path d="M188 264c-34 20-62 43-96 74 31-7 55-3 80 8" strokeWidth="8" />
        <path d="M178 378c-42 20-77 45-119 83 43-10 81-9 115 2" strokeWidth="9" />
        <path d="M211 84c10 20 24 39 42 57-17-5-31-4-46 5" strokeWidth="4" opacity=".75" />
        <path d="M224 184c23 9 43 24 66 49-22-5-40-4-59 4" strokeWidth="5" opacity=".75" />
        <path d="M234 290c30 13 57 33 87 60-30-6-53-4-79 4" strokeWidth="6" opacity=".75" />
      </g>

      <path className="tree-garland" d="M165 140c25 20 46 24 69 9M129 229c41 28 99 35 143 0M88 337c63 38 161 46 224 0M49 454c90 46 212 46 302 0" fill="none" stroke="#c7974c" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M165 140c25 20 46 24 69 9M129 229c41 28 99 35 143 0M88 337c63 38 161 46 224 0M49 454c90 46 212 46 302 0" fill="none" stroke="#ffe4a5" strokeWidth="1" strokeLinecap="round" opacity=".76" />
      <g className="tree-lights">
          {lights.map(([cx, cy], index) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={index % 3 === 0 ? 4 : 3.2} fill={treeLightColors[index % treeLightColors.length]} className={`tree-light tree-light--${index % 4}`} style={{ animationDelay: `${(index % 7) * -0.31}s` }} />
        ))}
      </g>

      <g className="tree-topper">
        <circle cx="200" cy="65" r="35" fill="url(#star-aura)" />
        <polygon points={starPoints(21, 9)} transform="translate(200 65)" fill="#f9d478" stroke="#fff1bc" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="193" cy="58" r="2.5" fill="#fff9df" />
      </g>
      <path d="M172 493h56l21 18h-98z" fill="#9d6540" />
      <path d="M156 511h88l-10 12h-68z" fill="#70452f" />
      <path d="M170 505h60" stroke="#e8bb7a" strokeOpacity=".5" strokeWidth="2" />
    </g>
  );
}

function pathFromPoints(points: TreePoint[]) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${formatCoordinate(point.x * 400)} ${formatCoordinate(point.y * 560)}`).join(" ");
}

const treeLightColors = ["#ffe3a1", "#f8d9a1", "#f5b7a5", "#c1e6ef"];

function simplifyStrokePoints(points: TreePoint[], maximum = MAX_POINTS_PER_STROKE): TreePoint[] {
  if (points.length <= maximum) return points;
  const stride = (points.length - 1) / (maximum - 1);
  return Array.from({ length: maximum }, (_, index) => points[Math.round(index * stride)]);
}

function formatCoordinate(value: number) {
  return Number(value.toFixed(2));
}

function isNearStroke(points: TreePoint[], point: TreePoint, radius: number) {
  const x = point.x * 400;
  const y = point.y * 560;
  if (points.length === 1) return Math.hypot(points[0].x * 400 - x, points[0].y * 560 - y) <= radius;
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(
      x,
      y,
      points[index - 1].x * 400,
      points[index - 1].y * 560,
      points[index].x * 400,
      points[index].y * 560,
    ) <= radius) return true;
  }
  return false;
}

function distanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const amount = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - (x1 + amount * dx), y - (y1 + amount * dy));
}

function starPoints(outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
  }).join(" ");
}

function createStrokeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `stroke-${crypto.randomUUID().slice(0, 20)}`;
  return `stroke-${Math.random().toString(36).slice(2, 12)}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
