// 风格保留：从原码图检测配色，重生时还原 — 纯函数，node 可测

import { generateMatrix } from "./generate.js";
import { decodeResult } from "./decode.js";

const QUIET = 4; // generateMatrix 的 quiet zone（矩阵含 quiet，定位时跳过）

/**
 * 从原图检测前景/背景色（增强而非替换：保留品牌色）
 * 用 jsQR 的 location 精确定位模块网格（不依赖 quiet zone 宽度假设）
 * 返回 { fg: [r,g,b], bg: [r,g,b] }
 */
export function detectStyle(rgba, width, height) {
  const result = decodeResult(rgba, width, height);
  if (!result) return { fg: [0, 0, 0], bg: [255, 255, 255] };

  const { size, matrix } = generateMatrix(result.data); // size = n + 2*QUIET
  const n = size - QUIET * 2; // 数据模块数
  const loc = result.location;
  const x0 = loc.topLeftCorner.x;
  const y0 = loc.topLeftCorner.y;
  const gridW = loc.topRightCorner.x - x0;
  const modulePx = gridW / n; // 每模块像素（浮点）

  let fgSum = [0, 0, 0], fgCount = 0;
  let bgSum = [0, 0, 0], bgCount = 0;
  // 遍历数据模块（矩阵含 quiet，偏移 QUIET）
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cx = x0 + (c + 0.5) * modulePx;
      const cy = y0 + (r + 0.5) * modulePx;
      const px = Math.round(cx);
      const py = Math.round(cy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const i = (py * width + px) * 4;
      if (matrix[r + QUIET][c + QUIET]) {
        fgSum[0] += rgba[i]; fgSum[1] += rgba[i + 1]; fgSum[2] += rgba[i + 2]; fgCount++;
      } else {
        bgSum[0] += rgba[i]; bgSum[1] += rgba[i + 1]; bgSum[2] += rgba[i + 2]; bgCount++;
      }
    }
  }
  const avg = (s, cnt) => (cnt > 0 ? Math.round(s / cnt) : 0);
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
