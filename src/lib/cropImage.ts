/**
 * 把浏览器无法原生解码的格式（主要是 iPhone 的 HEIC/HEIF）先转成 JPEG File，
 * 其它格式（JPG/PNG/WEBP/AVIF/GIF…）原样直通——这些 `<img>`/canvas 本就能解码。
 *
 * 解码库 `heic-to`（libheif WASM）走**动态 import**：只有真选了 HEIC 才加载 ~1MB WASM，
 * 不进首屏 bundle。检测优先用 `isHeic()` 读 ftyp 魔数（比 MIME 可靠——浏览器常把
 * HEIC 的 `File.type` 报成空串），再兜底扩展名。
 */
export async function normalizeImageFile(file: File): Promise<File> {
  const looksHeicByName = /\.(heic|heif)$/i.test(file.name);
  const looksHeicByType = file.type === 'image/heic' || file.type === 'image/heif';
  // 先用便宜的线索过滤：明显是常见格式（有 image/* 且非 heic）就直接放行，省去加载 WASM
  if (!looksHeicByName && !looksHeicByType && file.type && file.type.startsWith('image/')) {
    return file;
  }

  const { isHeic, heicTo } = await import('heic-to');
  let heic = looksHeicByName || looksHeicByType;
  try {
    if (!heic) heic = await isHeic(file);
  } catch {
    // isHeic 读不了就退回到文件名/类型的判断
  }
  if (!heic) return file;

  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  const jpegName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], jpegName, { type: 'image/jpeg', lastModified: Date.now() });
}

/** Compress a cropped File to a base64 data URL, resizing to maxWidth at given quality. */
export async function compressToBase64(
  file: File,
  maxWidth = 720,
  quality = 0.78
): Promise<string> {
  // HEIC/HEIF 先转 JPEG，再走原生 canvas 压缩（幂等：非 HEIC 0 成本直通）
  file = await normalizeImageFile(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
    image.src = url;
  });

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<File | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = getRadianAngle(rotation);

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = {
    width:
      Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
    height:
      Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
  };

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // draw rotated image
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    return null;
  }

  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = 'high';

  // Set the size of the cropped canvas.
  // 注意：本函数产出的 File 仅是中间产物——调用方（AddEditItemModal）随后会用
  // compressToBase64(file, 720, 0.78) 再压一道，最终存进 Firestore / 详情页显示的恒为 720px。
  // 这里给 1200px 只是给那一步留足像素余量，不会直接影响最终清晰度。
  const MAX_WIDTH = 1200;
  const scale = pixelCrop.width > MAX_WIDTH ? MAX_WIDTH / pixelCrop.width : 1;

  croppedCanvas.width = Math.max(1, Math.round(pixelCrop.width * scale));
  croppedCanvas.height = Math.max(1, Math.round(pixelCrop.height * scale));

  // Draw the cropped image onto the new canvas
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    croppedCanvas.width,
    croppedCanvas.height
  );

  // As a blob
  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob((file) => {
      if (file) {
        // Convert Blob to File
        const croppedFile = new File([file], 'cropped_image.jpg', {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(croppedFile);
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, 'image/jpeg', 0.92); // 92% quality — sharper on detail page, still fast upload
  });
}
