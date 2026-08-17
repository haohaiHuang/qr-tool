// 标准 QR 重生生成 — 纯函数，node 可测
// 从文本生成 QR 模块矩阵（含 quiet zone），可渲染任意分辨率

import qrcode from "qrcode-generator";

/** 从文本生成 QR 模块矩阵（含 quiet zone），返回 { size, matrix[row][col] } */
export function generateMatrix(text, quiet = 4, errorLevel = "M") {
  const qr = qrcode(0, errorLevel);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + quiet * 2;
  const matrix = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      const mr = r - quiet;
      const mc = c - quiet;
      row.push(mr >= 0 && mr < n && mc >= 0 && mc < n && qr.isDark(mr, mc));
    }
    matrix.push(row);
  }
  return { size, matrix };
}

/** 模块矩阵 → RGBA 像素数组（modulePx = 每模块像素，决定分辨率） */
export function matrixToRgba(matrix, size, modulePx = 4) {
  const px = size * modulePx;
  const rgba = new Uint8ClampedArray(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dark = matrix[Math.floor(y / modulePx)][Math.floor(x / modulePx)];
      const v = dark ? 0 : 255;
      const i = (y * px + x) * 4;
      rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
    }
  }
  return { rgba, width: px, height: px };
}
