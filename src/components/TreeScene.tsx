import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { OrnamentKind, TreeDecoration, TreeDesign } from "../lib/tree-state";
import { TREE_PLACEMENT_BOUNDS } from "../lib/tree-state";

interface TreeSceneProps {
  design: TreeDesign;
  selectedDecorationId: string | null;
  svgRef: RefObject<SVGSVGElement | null>;
  onPlace: (x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
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
  "bauble-green": "#b4d6ae",
  "candy-cane": "#f4e7ce",
  star: "#ffd978",
};

export function treePointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
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
      return clampToTree(viewBoxPoint.x / viewBoxWidth, viewBoxPoint.y / viewBoxHeight);
    } catch {
      // A detached SVG can briefly expose a singular screen matrix during layout.
    }
  }

  const scale = Math.min(bounds.width / viewBoxWidth, bounds.height / viewBoxHeight);
  const renderedWidth = viewBoxWidth * scale;
  const renderedHeight = viewBoxHeight * scale;
  const offsetX = bounds.left + (bounds.width - renderedWidth) / 2;
  const offsetY = bounds.top + (bounds.height - renderedHeight) / 2;
  const x = (clientX - offsetX) / renderedWidth;
  const y = (clientY - offsetY) / renderedHeight;
  return clampToTree(x, y);
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

export default function TreeScene({
  design,
  selectedDecorationId,
  svgRef,
  onPlace,
  onMove,
  onSelect,
  onRemove,
}: TreeSceneProps) {
  const draggingId = useRef<string | null>(null);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!draggingId.current || !svgRef.current) return;
    const point = treePointFromClient(svgRef.current, event.clientX, event.clientY);
    onMove(draggingId.current, point.x, point.y);
  }

  function endDrag() {
    draggingId.current = null;
  }

  function handleRootKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onPlace(0.5, 0.52);
  }

  function handleDecorationPointerDown(event: PointerEvent<SVGGElement>, decoration: TreeDecoration) {
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
      const point = clampToTree(decoration.x + nudge[0], decoration.y + nudge[1]);
      onMove(decoration.id, point.x, point.y);
    }
  }

  return (
    <svg
      ref={svgRef}
      className="tree-art"
      viewBox="0 0 400 560"
      role="group"
      aria-label="Чимэглэх гацуур"
      tabIndex={0}
      onClick={(event) => {
        const point = svgRef.current
          ? treePointFromClient(svgRef.current, event.clientX, event.clientY)
          : { x: 0.5, y: 0.52 };
        onPlace(point.x, point.y);
      }}
      onKeyDown={handleRootKeyDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="pine-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d7657" />
          <stop offset="54%" stopColor="#23563e" />
          <stop offset="100%" stopColor="#143b2d" />
        </linearGradient>
        <linearGradient id="trunk-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#70452c" />
          <stop offset="50%" stopColor="#a56b3f" />
          <stop offset="100%" stopColor="#70452c" />
        </linearGradient>
        <radialGradient id="tree-aura">
          <stop offset="0%" stopColor="#f5c46d" stopOpacity=".23" />
          <stop offset="100%" stopColor="#f5c46d" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="200" cy="275" rx="183" ry="235" fill="url(#tree-aura)" />
      <ellipse cx="200" cy="493" rx="135" ry="18" fill="#0b1813" opacity=".48" />
      <path d="M177 404h46v86h-46z" fill="url(#trunk-gradient)" />
      <path
        d="M200 58 285 210h-52l88 108h-70l121 126H28l121-126H79l88-108h-52z"
        fill="url(#pine-gradient)"
        stroke="#b9d4a8"
        strokeOpacity=".2"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M200 57 205 72l16 1-12 10 4 16-13-9-13 9 4-16-12-10 16-1z" fill="#f6ce75" />
      <path d="M128 197c31 30 111 38 151 1M91 299c49 43 168 48 218-1M54 397c79 52 218 54 293-1" fill="none" stroke="#d2a85c" strokeWidth="5" strokeLinecap="round" opacity=".82" />
      <path d="M128 197c31 30 111 38 151 1M91 299c49 43 168 48 218-1M54 397c79 52 218 54 293-1" fill="none" stroke="#f7e5af" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
      <g fill="#ffe28b" opacity=".96">
        <circle cx="150" cy="207" r="3.4" /><circle cx="190" cy="224" r="3.1" /><circle cx="235" cy="222" r="3.6" />
        <circle cx="111" cy="310" r="3.2" /><circle cx="164" cy="328" r="3.7" /><circle cx="219" cy="331" r="3" /><circle cx="274" cy="312" r="3.5" />
        <circle cx="81" cy="409" r="3.2" /><circle cx="137" cy="431" r="3.5" /><circle cx="200" cy="438" r="3.1" /><circle cx="264" cy="428" r="3.6" /><circle cx="319" cy="407" r="3.1" />
      </g>
      <g fill="#d7e7cd" opacity=".6">
        <path d="m132 261 11 5-11 5-5 11-5-11-11-5 11-5 5-11z" />
        <path d="m265 355 9 4-9 4-4 9-4-9-9-4 9-4 4-9z" />
      </g>
      <path d="M172 489h56l20 19h-96z" fill="#9d6540" />
      <path d="M156 509h88l-10 12h-68z" fill="#74492f" />

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
          onPointerUp={endDrag}
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

function starPoints(outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
  }).join(" ");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
