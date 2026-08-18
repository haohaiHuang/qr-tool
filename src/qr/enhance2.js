// 方案 B 主管道：结构重绘（B）优先 → 重编码（A）回退 — 纯函数，node 可测

import { toGrayImage } from "../shared/pixels.js";
import { detectGrid } from "../detect/grid.js";
import { sampleModules } from "../detect/sampler.js";
import { detectStyle } from "./style.js";
import { redraw } from "./redraw.js";
import { enhanceQr } from "./enhance.js";
import { decodeQR } from "./decode.js";

/**
 * 增强 QR 码：B（结构重绘，保留排列/配色/logo）→ 失败回退 A（重编码）
 * @returns { ok:true, engine:"B"|"A", text, rgba, width, height, matrix? } | { ok:false, reason }
 */
export function enhance2(rgba, width, height, modulePx = 8) {
  const gray = toGrayImage(rgba, width, height);

  // ===== 方案 B：结构重绘 =====
  const grid = detectGrid(gray, width, height);
  if (grid) {
    const matrix = sampleModules(gray, width, height, grid);
    const style = detectStyle(rgba, width, height);
    // logo 定位：码中心 + 半径（码尺寸 ~12%）
    const [lcx, lcy] = grid.toPixel(grid.n / 2, grid.n / 2);
    const radius = grid.modulePx * grid.n * 0.12;
    const original = { rgba, width, height, cx: lcx, cy: lcy, radius };
    const out = redraw(matrix, grid.n, style, modulePx, original);

    // 自检：输出可解码且与原图解码一致
    const origText = decodeQR(rgba, width, height);
    const reText = decodeQR(out.rgba, out.width, out.height);
    if (origText && reText === origText) {
      return { ok: true, engine: "B", text: origText, rgba: out.rgba, width: out.width, height: out.height, matrix };
    }
    // B 自检失败（定位/采样误差）→ 落到 A
  }

  // ===== 方案 A：重编码（兜底）=====
  const r = enhanceQr(rgba, width, height, modulePx);
  if (r.ok) return { ...r, engine: "A" };
  return { ok: false, reason: r.reason };
}
