// 像素数组工具 — 纯函数，node 可测（不依赖 DOM/Canvas）
// 像素格式约定：RGBA 字节数组（Uint8ClampedArray），顺序 R,G,B,A 每像素 4 字节

/** 单像素加权灰度（ITU-R BT.601）：0.299R + 0.587G + 0.114B */
export function toGray(r, g, b) {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/** RGBA 像素数组 → 灰度数组（长度 = width*height） */
export function toGrayImage(rgba, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    gray[j] = toGray(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return gray;
}
