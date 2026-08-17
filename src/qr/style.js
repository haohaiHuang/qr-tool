// 风格保留：从原码图检测配色，重生时还原 — 纯函数，node 可测

/**
 * 从原图检测前景/背景色（增强而非替换：保留品牌色）
 * 用 generateMatrix 的矩阵定位：dark 模块像素均值 = fg，其余 = bg
 * 前提：原图与矩阵同尺度（比例换算）
 * 返回 { fg: [r,g,b], bg: [r,g,b] }
 */
import { generateMatrix } from "./generate.js";
import { decodeQR } from "./decode.js";

export function detectStyle(rgba, width, height, quiet = 4) {
  // 先解码拿文本 → 重生成矩阵（用于定位模块位置）
  const text = decodeQR(rgba, width, height);
  if (!text) return { fg: [0, 0, 0], bg: [255, 255, 255] };
  const { size, matrix } = generateMatrix(text, quiet);
  const modulePx = width / size; // 原图每模块像素

  let fgSum = [0, 0, 0], fgCount = 0;
  let bgSum = [0, 0, 0], bgCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const m = matrix[Math.floor(y / modulePx)][Math.floor(x / modulePx)];
      const i = (y * width + x) * 4;
      if (m) { fgSum[0] += rgba[i]; fgSum[1] += rgba[i + 1]; fgSum[2] += rgba[i + 2]; fgCount++; }
      else { bgSum[0] += rgba[i]; bgSum[1] += rgba[i + 1]; bgSum[2] += rgba[i + 2]; bgCount++; }
    }
  }
  const avg = (s, c) => (c > 0 ? Math.round(s / c) : 0);
  return {
    fg: [avg(fgSum[0], fgCount), avg(fgSum[1], fgCount), avg(fgSum[2], fgCount)],
    bg: [avg(bgSum[0], bgCount), avg(bgSum[1], bgCount), avg(bgSum[2], bgCount)],
  };
}

/** 用风格（前景/背景色）渲染模块矩阵 → RGBA（任意分辨率） */
export function renderStyled(matrix, size, style, modulePx = 4) {
  const px = size * modulePx;
  const rgba = new Uint8ClampedArray(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dark = matrix[Math.floor(y / modulePx)][Math.floor(x / modulePx)];
      const [r, g, b] = dark ? style.fg : style.bg;
      const i = (y * px + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return { rgba, width: px, height: px };
}
