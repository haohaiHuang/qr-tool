// 方案 B 核心：QR 模块网格精确定位 — 纯函数，node 可测
// 3 个 Finder 中心 → 仿射映射（模块坐标 → 像素坐标），附 modulePx 与模块数 n

import { detectFinderPatterns } from "./finder.js";

// QR 模块数 = 17 + 4*version：21, 25, 29, ...
const MODULE_SIZES = Array.from({ length: 40 }, (_, v) => 17 + 4 * (v + 1));

/** 从候选 Finder 点中挑选构成直角三角的三点（左上/右上/左下）
 *  直角点 = 到另外两点距离之和最小的点；最长边为斜边 */
function pickRightTriangle(pts) {
  let best = null, bestScore = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue;
      for (let k = 0; k < pts.length; k++) {
        if (k === i || k === j) continue;
        const a = pts[i], b = pts[j], c = pts[k];
        const dAB = Math.hypot(b.x - a.x, b.y - a.y);
        const dAC = Math.hypot(c.x - a.x, c.y - a.y);
        const dBC = Math.hypot(c.x - b.x, c.y - b.y);
        // a 为直角点：AB、AC 为直角边，BC 为斜边
        if (Math.abs(dAB * dAB + dAC * dAC - dBC * dBC) < dBC * dBC * 0.1) {
          // 正方形码特征：两直角边长度接近（真 finder 三角一致；误报三角边长差异大）
          const score = Math.abs(dAB - dAC) / Math.max(dAB, dAC);
          if (score < bestScore) {
            bestScore = score;
            // b 右上、c 左下（x 大者为右上）
            const tr = b.x > c.x ? b : c;
            const bl = b.x > c.x ? c : b;
            best = { tl: a, tr, bl };
          }
        }
      }
    }
  }
  return best;
}

/**
 * 检测 QR 模块网格
 * @returns { n, modulePx, toPixel(r,c): [x,y], finders } | null
 *   toPixel 返回模块 (r,c) 中心的像素坐标
 */
export function detectGrid(gray, width, height) {
  const pts = detectFinderPatterns(gray, width, height);
  if (pts.length < 3) return null;
  const trio = pickRightTriangle(pts);
  if (!trio) return null;

  const { tl, tr, bl } = trio;
  // 左上-右上距离（finder 中心间距 = (n-7)*modulePx）
  const dH = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const dV = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const modulePx = Math.max(1, (tl.modulePx || 4)); // finder 边缘黑段 = 1 模块

  // 估计模块数：n ≈ 间距/modulePx + 7，归一到合法值
  const nEst = Math.round(((dH + dV) / 2) / modulePx) + 7;
  let n = MODULE_SIZES[0];
  for (const s of MODULE_SIZES) {
    if (Math.abs(s - nEst) < Math.abs(n - nEst)) n = s;
  }

  // 仿射：模块中心坐标 (u=r+0.5, v=c+0.5) → 像素（u=行，v=列）
  // finder 中心在模块坐标：左上 (3.5,3.5) / 右上 (3.5, n-3.5) / 左下 (n-3.5, 3.5)
  const u1 = 3.5, v1 = 3.5;
  const u2 = 3.5, v2 = n - 3.5;
  const u3 = n - 3.5, v3 = 3.5;
  const x1 = tl.x, y1 = tl.y;
  const x2 = tr.x, y2 = tr.y;
  const x3 = bl.x, y3 = bl.y;
  // 解仿射：x = a*u + b*v + e; y = c*u + d*v + f
  const denom = (u1 - u2) * (v1 - v3) - (u1 - u3) * (v1 - v2);
  if (Math.abs(denom) < 1e-6) return null;
  const a = ((x1 - x2) * (v1 - v3) - (x1 - x3) * (v1 - v2)) / denom;
  const b = ((u1 - u2) * (x1 - x3) - (u1 - u3) * (x1 - x2)) / denom;
  const e = x1 - a * u1 - b * v1;
  const c = ((y1 - y2) * (v1 - v3) - (y1 - y3) * (v1 - v2)) / denom;
  const d = ((u1 - u2) * (y1 - y3) - (u1 - u3) * (y1 - y2)) / denom;
  const f = y1 - c * u1 - d * v1;

  const toPixel = (row, col) => [
    a * (row + 0.5) + b * (col + 0.5) + e,
    c * (row + 0.5) + d * (col + 0.5) + f,
  ];

  return { n, modulePx, toPixel, finders: [tl, tr, bl] };
}

/**
 * 检测模块样式（间隙/圆角）：沿数据区中间行扫描 dark 段宽度
 * 实心模块 → fill≈1 无圆角；微信码类（间隙+圆角）→ fill<1 有圆角
 * @returns { moduleRadius, moduleFill }
 */
export function detectModuleStyle(gray, width, height, grid, threshold = 128) {
  const { n, modulePx } = grid;
  const r = Math.floor(n / 2);
  const [, y] = grid.toPixel(r, 0);
  const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
  // 该行 dark 段宽度
  const runs = [];
  let inDark = false, start = 0;
  for (let x = 0; x < width; x++) {
    const dark = gray[cy * width + x] < threshold;
    if (dark && !inDark) { inDark = true; start = x; }
    else if (!dark && inDark) { inDark = false; runs.push(x - start); }
  }
  if (inDark) runs.push(width - start);
  // dark 段 = 模块 fg 宽（排除 finder 大段 > 2 模块）
  const sorted = runs.filter((w) => w < modulePx * 2 && w >= modulePx * 0.3).sort((a, b) => a - b);
  if (sorted.length === 0) return { moduleRadius: 0, moduleFill: 1 };
  const fgW = sorted[Math.floor(sorted.length / 2)];
  const moduleFill = Math.max(0.5, Math.min(1, fgW / modulePx));
  const hasGap = moduleFill < 0.97;
  return { moduleRadius: hasGap ? 0.15 : 0, moduleFill: hasGap ? moduleFill : 1 };
}


/**
 * 检测原图 logo 边界（白环法）：微信码类 logo = 深色主体 + 一圈白留白环（两侧深色）
 * 从码中心沿中心行/列向外，找第一个"宽白段（0.5-2 模块）且两侧深色" = 白环
 * logo 区域 = 中心到白环内缘
 * @returns { cx, cy, halfW, halfH }（原图坐标）| null
 */

/**
 * 检测原图 logo 边界（白环法）：微信码类 logo = 深色主体 + 一圈白留白环（两侧深色）
 * 从码中心沿中心行/列向外找第一个"宽白段（0.5-2 模块）且两侧深色" = 白环
 * @returns { cx, cy, halfW, halfH }（原图坐标）| null
 */

/**
 * 检测原图 logo 边界（区域生长法）：logo 深色主体 = 中心附近的深色连通块
 * 白留白环天然阻挡生长（不穿过白），外接矩形 = logo 边界
 * @returns { cx, cy, halfW, halfH }（原图坐标）| null
 */

/**
 * 检测原图 logo 边界（颜色相似 + 距离限制生长）
 * 种子 = 中心附近深色像素；生长条件 = 与基准色差 < tol 且距种子 < maxDist
 * （白环/不同色阻挡；远处模块因距离/色差不并入 → 不外溢）
 * @returns { cx, cy, halfW, halfH, mask }（原图坐标；mask = logo 像素集合）| null
 */

/**
 * 检测原图 logo 边界（颜色相似 + 距离限制生长 + 白占比校验）
 * 种子 = 中心附近深色像素；生长 = 与基准色差 < tol 且距种子 < maxDist
 * 校验：外接矩形内白占比 ∈ [0.05, 0.6]（真 logo 黑底含白气泡；纯黑模块组白≈0）
 * @returns { cx, cy, halfW, halfH, mask }（mask = logo 深色像素集合）| null
 */

/**
 * 检测原图 logo 边界（白环规则性）：微信码类 logo = 深色主体 + 四周规则白环
 * 从中心沿中心行/列向外，测 4 方向第一个白段宽度；4 方向均有且宽度接近（CV<0.5）→ 白环 → logo
 * 边界 = 中心到白段内缘（黑底外缘）
 * @returns { cx, cy, halfW, halfH }（原图坐标）| null
 */

/**
 * 检测原图 logo 边界：① 白环规则性（4 方向白段宽度接近）② 区域生长 fallback（深色大块）
 * @returns { cx, cy, halfW, halfH }（原图坐标）| null
 */
export function detectLogoBounds(gray, width, height, grid) {
  const { n, modulePx, toPixel } = grid;
  const [cx, cy] = toPixel((n - 1) / 2, (n - 1) / 2);
  const cxi = Math.round(cx), cyi = Math.round(cy);
  if (cxi < 0 || cxi >= width || cyi < 0 || cyi >= height) return null;
  const at = (x, y) => gray[y * width + x];

  // ① 白环：4 方向第一个白段，宽度接近（CV<0.5）
  const findWhite = (start, dir, axis) => {
    const len = axis === "x" ? width : height;
    let p = start;
    while (p > 0 && p < len - 1) {
      if (at(axis === "x" ? p : cxi, axis === "x" ? cyi : p) > 200) {
        let e = p;
        while (e + dir >= 0 && e + dir < len && at(axis === "x" ? e + dir : cxi, axis === "x" ? cyi : e + dir) > 200) e += dir;
        const from = Math.min(p, e), to = Math.max(p, e);
        const w = to - from + 1;
        if (w >= modulePx * 0.4 && w <= modulePx * 3) {
          return { inner: dir > 0 ? from : to, width: w };
        }
        p = dir > 0 ? to + 1 : from - 1;
      } else {
        p += dir;
      }
    }
    return null;
  };
  const l = findWhite(cxi, -1, "x"), r = findWhite(cxi, 1, "x");
  const t = findWhite(cyi, -1, "y"), b = findWhite(cyi, 1, "y");
  if (l && r && t && b) {
    const widths = [l.width, r.width, t.width, b.width];
    const mean = widths.reduce((a, x) => a + x, 0) / 4;
    const variance = widths.reduce((a, x) => a + (x - mean) ** 2, 0) / 4;
    if (mean > 0 && Math.sqrt(variance) / mean < 0.5) {
      return {
        cx: (l.inner + r.inner) / 2, cy: (t.inner + b.inner) / 2,
        halfW: Math.abs(r.inner - l.inner) / 2, halfH: Math.abs(b.inner - t.inner) / 2,
      };
    }
  }

  // ② 区域生长 fallback：中心深色大块（无白环 logo，如纯色圆）
  let seed = null;
  const maxR = Math.max(width, height);
  for (let rr = 0; rr < maxR && !seed; rr++) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = cxi + dx * rr, y = cyi + dy * rr;
      if (x >= 0 && x < width && y >= 0 && y < height && gray[y * width + x] < 128) { seed = [x, y]; break; }
    }
  }
  if (!seed) return null;
  const baseColor = gray[seed[1] * width + seed[0]];
  const maxDist = modulePx * n * 0.25;
  const queue = [seed];
  const visited = new Set([seed[1] * width + seed[0]]);
  let minX = seed[0], maxX = seed[0], minY = seed[1], maxY = seed[1];
  while (queue.length) {
    const [x, y] = queue.pop();
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const key = ny * width + nx;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited.has(key)) continue;
      if (Math.abs(gray[key] - baseColor) > 60) continue;
      if (Math.hypot(nx - seed[0], ny - seed[1]) > maxDist) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  const w2 = maxX - minX, h2 = maxY - minY;
  if (w2 < modulePx || h2 < modulePx) return null;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, halfW: w2 / 2, halfH: h2 / 2 };
}
