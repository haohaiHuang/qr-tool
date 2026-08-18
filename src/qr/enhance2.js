// 方案 B 主管道：结构重绘（B）优先 → 重编码（A）回退 — 纯函数，node 可测
// logo 按需贴片：先无 logo 重绘自检（标准码中心是模块，无 logo 版即扫）；
// 无 logo 版扫码失败（中心被 logo 破坏）才贴片（微信码）

import { toGrayImage } from "../shared/pixels.js";
import { detectGrid, detectModuleStyle, detectLogoBounds } from "../detect/grid.js";
import { sampleModules } from "../detect/sampler.js";
import { detectStyle } from "./style.js";
import { redraw } from "./redraw.js";
import { enhanceQr } from "./enhance.js";
import { decodeQR } from "./decode.js";

/** 尝试 B 重绘 + 自检；返回 { ok, out, origText } */
function tryRedraw(matrix, grid, style, rgba, width, height, modulePx, original) {
  const out = redraw(matrix, grid.n, style, modulePx, original);
  const origText = decodeQR(rgba, width, height);
  const reText = decodeQR(out.rgba, out.width, out.height);
  if (origText && reText === origText) {
    return { ok: true, out, origText };
  }
  return { ok: false, out, origText };
}

/**
 * 增强 QR 码：B（结构重绘，保留排列/配色/logo）→ 失败回退 A（重编码）
 * @returns { ok:true, engine:"B"|"A", text, rgba, width, height, matrix? } | { ok:false, reason }
 */
export function enhance2(rgba, width, height, modulePx = 8) {
  const gray = toGrayImage(rgba, width, height);

  const grid = detectGrid(gray, width, height);
  if (grid) {
    const matrix = sampleModules(gray, width, height, grid);
    const style = detectStyle(rgba, width, height);
    const modStyle = detectModuleStyle(gray, width, height, grid);
    style.moduleRadius = modStyle.moduleRadius;
    style.moduleFill = modStyle.moduleFill;

    // ① 检测 logo（纯检测；标准码误判无害——贴片自检会兜底）
    const bounds = detectLogoBounds(gray, width, height, grid);
    const [lcx, lcy] = grid.toPixel((grid.n - 1) / 2, (grid.n - 1) / 2);

    if (bounds) {
      // 检测到 logo → 贴片重绘 + 自检（保留 logo；自检失败再试无 logo 版）
      // 贴片只覆盖黑底（白环由重绘纯白模块形成，避免原图低质白放大出"半透明"感）
      const srcHalf = (bounds.halfW + bounds.halfH) / 2;
      const logoRatio = (srcHalf * 2) / (grid.modulePx * grid.n);
      const original = { rgba, width, height, cx: bounds.cx, cy: bounds.cy, srcHalf, logoRatio };
      const r2 = tryRedraw(matrix, grid, style, rgba, width, height, modulePx, original);
      if (r2.ok) {
        return { ok: true, engine: "B", text: r2.origText, rgba: r2.out.rgba, width: r2.out.width, height: r2.out.height, matrix };
      }
    }

    // ② 无 logo 重绘自检（标准码/误判兜底）
    const r1 = tryRedraw(matrix, grid, style, rgba, width, height, modulePx, null);
    if (r1.ok) {
      return { ok: true, engine: "B", text: r1.origText, rgba: r1.out.rgba, width: r1.out.width, height: r1.out.height, matrix };
    }
    // B 全失败 → 落 A
  }

  const r = enhanceQr(rgba, width, height, modulePx);
  if (r.ok) return { ...r, engine: "A" };
  return { ok: false, reason: r.reason };
}
