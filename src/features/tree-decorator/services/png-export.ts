const exportWidth = 1200;
const exportHeight = 1680;
const svgNamespace = "http://www.w3.org/2000/svg";

export function serializeTreeSvg(svg: SVGSVGElement): Blob {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll(".tree-decoration-selection, .draw-empty-hint").forEach((element) => element.remove());
  clone.setAttribute("xmlns", svgNamespace);
  clone.setAttribute("width", String(exportWidth));
  clone.setAttribute("height", String(exportHeight));
  clone.setAttribute("viewBox", "0 0 400 560");
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const background = document.createElementNS(svgNamespace, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", "400");
  background.setAttribute("height", "560");
  background.setAttribute("fill", "#10192d");
  const firstArtNode = clone.children.item(1);
  clone.insertBefore(background, firstArtNode ?? null);

  return new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
}

export async function downloadTreePng(source: SVGSVGElement | HTMLCanvasElement | null): Promise<void> {
  if (!source) throw new Error("Гацуурын зураг олдсонгүй.");

  const svgUrl = source.tagName.toLowerCase() === "svg"
    ? URL.createObjectURL(serializeTreeSvg(source as SVGSVGElement))
    : null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Зургийн canvas үүсгэж чадсангүй.");
    context.fillStyle = "#10192d";
    context.fillRect(0, 0, exportWidth, exportHeight);
    if (svgUrl) {
      const image = await loadImage(svgUrl);
      context.drawImage(image, 0, 0, exportWidth, exportHeight);
    } else {
      const renderCanvas = source as HTMLCanvasElement;
      const fitted = containCanvas(renderCanvas.width, renderCanvas.height);
      context.drawImage(renderCanvas, fitted.x, fitted.y, fitted.width, fitted.height);
    }
    if (typeof context.fillText === "function") {
      context.fillStyle = "rgba(10, 16, 29, 0.88)";
      context.fillRect(0, 1540, exportWidth, 140);
      context.fillStyle = "#c8d2df";
      context.font = "16px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText("Загвар: Christmas Tree · RoboHoloclone12", exportWidth / 2, 1570);
      context.fillText("Эх сурвалж: https://sketchfab.com/3d-models/christmas-tree-742b8a73f28c4749a51d756332809375", exportWidth / 2, 1601);
      context.fillText("Өөрчлөлт: glTF болгон хөрвүүлж, web-д зориулан polygon багасгасан", exportWidth / 2, 1632);
      context.fillText("CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/", exportWidth / 2, 1663);
    }

    const png = await canvasToBlob(canvas);
    const pngUrl = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "happy-new-year-tree.png";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    if (svgUrl) URL.revokeObjectURL(svgUrl);
  }
}

function containCanvas(width: number, height: number) {
  if (width <= 0 || height <= 0) return { x: 0, y: 0, width: exportWidth, height: exportHeight };
  const scale = Math.min(exportWidth / width, exportHeight / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;
  return {
    x: (exportWidth - fittedWidth) / 2,
    y: (exportHeight - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG зураг уншиж чадсангүй."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG файл үүсгэж чадсангүй."));
    }, "image/png");
  });
}
