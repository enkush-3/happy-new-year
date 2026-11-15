const exportWidth = 1200;
const exportHeight = 1680;
const svgNamespace = "http://www.w3.org/2000/svg";

export function serializeTreeSvg(svg: SVGSVGElement): Blob {
  const clone = svg.cloneNode(true) as SVGSVGElement;
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

export async function downloadTreePng(svg: SVGSVGElement | null): Promise<void> {
  if (!svg) throw new Error("Гацуурын зураг олдсонгүй.");

  const svgUrl = URL.createObjectURL(serializeTreeSvg(svg));
  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Зургийн canvas үүсгэж чадсангүй.");
    context.drawImage(image, 0, 0, exportWidth, exportHeight);

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
    URL.revokeObjectURL(svgUrl);
  }
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
