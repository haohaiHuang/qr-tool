// 方案 B 核心：QR 模块网格精确定位 — 纯函数，node 可测
// 3 个 Finder 中心 → 仿射映射（模块坐标 → 像素坐标），附 modulePx 与模块数 n

import { detectFinderPatterns } from "./finder.js";

// QR 模块数 = 17 + 4*version：21, 25, 29, ...
const MODULE_SIZES = Array.from({ length: 40 }, (_, v) => 17 + 4 * (v + 1));

/** 从候选 Finder 点中挑选构成直角三角的三点（左上/右上/左下）
 *  直角点 = 到另外两点距离之和最小的点；最长边为斜边 */
function pickRightTriangle(pts) {
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue;
      for (let k = 0; k < pts.length; k++) {
        if (k === i || k === j) continue;
        const a = pts[i], b = pts[j], c = pts[k];
        const dAB = Math.hypot(b.x - a.x, b.y - a.y);
        const dAC = Math.hypot(c.x - a.x, c.y - a.y);
        const dBC = Math.hypot(c.x - b.x, c.y - b.y);
        // 直角点 = 两条短边的公共点（勾股近似）
        const eps = Math.max(dAB, dAC, dBC) * 0.15;
        if (Math.abs(dAB * dAB + dAC * dAC - dBC * dBC) < dBC * dBC * 0.1) {
          // a 是直角点，b/c 是斜边两端 → b 右上、c 左下（按位置排序）
          // 确定左右：b/c 中 x 较大为右上
          const [tr, bl] = dBC > 0 && dAB >= dAC
            ? (b.x > c.x ? [b, c] : [c, b])  // 斜边 = BC，a 直角
            : null;
          if (tr) return { tl: a, tr, bl };
        }
      }
    }
  }
  return null;
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
  return { moduleRadius: hasGap ? 0.3 : 0, moduleFill: hasGap ? moduleFill : 1 };
}
