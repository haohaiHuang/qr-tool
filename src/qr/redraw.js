// 方案 B：高清矢量重绘 — 纯函数，node 可测
// 按原模块矩阵重绘（保留排列），Otsu 配色，可选中心 logo 原样叠加

/**
 * 重绘模块矩阵为高清 RGBA
 * @param matrix 模块矩阵 [row][col]（dark=true）
 * @param n 模块数
 * @param style { fg:[r,g,b], bg:[r,g,b] }
 * @param modulePx 每模块像素（输出分辨率）
 * @param original 可选 { rgba, width, height, cx, cy, radius } 原图 + logo 中心/半径 → 中心叠加原 logo
 * @returns { rgba, width, height }
 */
export function redraw(matrix, n, style, modulePx = 8, original = null) {
  const px = n * modulePx;
  const rgba = new Uint8ClampedArray(px * px * 4);

  // 1) 画模块（方形，保留原排列 + 配色）
  for (let y = 0; y < px; y++) {
    const modR = Math.min(n - 1, Math.floor(y / modulePx));
    for (let x = 0; x < px; x++) {
      const modC = Math.min(n - 1, Math.floor(x / modulePx));
      const dark = matrix[modR][modC];
      const [r, g, b] = dark ? style.fg : style.bg;
      const i = (y * px + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }

  // 2) 中心叠加原 logo（原图对应区域缩放到输出中心）
  if (original) {
    const { rgba: orig, width: ow, height: oh, cx, cy, radius } = original;
    const outR = px * 0.14; // 输出 logo 半径（码尺寸 ~14%）
    for (let dy = -Math.floor(outR); dy <= Math.floor(outR); dy++) {
      for (let dx = -Math.floor(outR); dx <= Math.floor(outR); dx++) {
        if (Math.hypot(dx, dy) > outR) continue;
        const ox = Math.round(cx + (dx / outR) * radius);
        const oy = Math.round(cy + (dy / outR) * radius);
        if (ox < 0 || ox >= ow || oy < 0 || oy >= oh) continue;
        const si = (oy * ow + ox) * 4;
        const oy2 = Math.floor(px / 2) + dy;
        const ox2 = Math.floor(px / 2) + dx;
        const di = (oy2 * px + ox2) * 4;
        rgba[di] = orig[si]; rgba[di + 1] = orig[si + 1]; rgba[di + 2] = orig[si + 2]; rgba[di + 3] = 255;
      }
    }
  }

  return { rgba, width: px, height: px };
}
