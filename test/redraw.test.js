import { test } from "node:test";
import assert from "node:assert/strict";
import { detectGrid } from "../src/detect/grid.js";
import { sampleModules } from "../src/detect/sampler.js";
import { redraw } from "../src/qr/redraw.js";
import { detectStyle } from "../src/qr/style.js";
import { toGrayImage } from "../src/shared/pixels.js";
import { generateMatrix } from "../src/qr/generate.js";
import { decodeQR } from "../src/qr/decode.js";
import { buildQrImage } from "./helpers/qr-image.js";

const QUIET = 4;

// TC-R1: 采样矩阵 → 重绘（黑白）→ 扫码 = 原内容
test("TC-R1: 重绘结果可扫码且内容一致", () => {
  const text = "REDRAW R1 TEST";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const sampled = sampleModules(gray, width, height, grid);
  const style = { fg: [0, 0, 0], bg: [255, 255, 255] };
  const out = redraw(sampled, grid.n, style, 8);
  assert.equal(out.width, grid.n * 8);
  assert.equal(decodeQR(out.rgba, out.width, out.height), text);
});

// TC-R2: 彩色码 → 重绘配色保留（±30）
test("TC-R2: 彩色码重绘保留配色", () => {
  const fg = [0, 90, 200];
  const bg = [250, 245, 225];
  const { rgba, width, height } = buildQrImage("REDRAW R2", 4, QUIET, fg, bg);
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const sampled = sampleModules(gray, width, height, grid);
  const style = detectStyle(rgba, width, height);
  const out = redraw(sampled, grid.n, style, 8);
  // 找第一个 dark 模块的像素颜色
  let darkIdx = -1;
  for (let r = 0; r < grid.n && darkIdx < 0; r++) {
    for (let c = 0; c < grid.n; c++) {
      if (sampled[r][c]) { darkIdx = r * grid.n + c; break; }
    }
  }
  const py = Math.floor(darkIdx / grid.n) * 8 + 4;
  const px = (darkIdx % grid.n) * 8 + 4;
  const i = (py * out.width + px) * 4;
  assert.ok(Math.abs(out.rgba[i] - fg[0]) < 30, `dark 像素 R≈${fg[0]}，实际 ${out.rgba[i]}`);
  assert.ok(Math.abs(out.rgba[i + 1] - fg[1]) < 30);
});

// TC-R3: 带 logo 码 → 重绘后中心保留 logo（非纯模块色）
test("TC-R3: 重绘保留中心 logo", () => {
  const text = "REDRAW R3 LOGO";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  // 中心画彩色 logo（红色圆）
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const r = Math.floor(width * 0.1);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        const i = (y * width + x) * 4;
        rgba[i] = 220; rgba[i + 1] = 30; rgba[i + 2] = 30; // 红 logo
      }
    }
  }
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const sampled = sampleModules(gray, width, height, grid);
  const style = detectStyle(rgba, width, height);
  // logo 定位：码中心 + 半径
  const [lcx, lcy] = grid.toPixel(grid.n / 2, grid.n / 2);
  const lr = width * 0.12;
  const out = redraw(sampled, grid.n, style, 8, { rgba, width, height, cx: lcx, cy: lcy, radius: lr });
  // 输出中心像素应接近 logo 红（220,30,30），而非纯 fg/bg
  const oi = (Math.floor(out.height / 2) * out.width + Math.floor(out.width / 2)) * 4;
  assert.ok(out.rgba[oi] > 150 && out.rgba[oi + 1] < 100, `中心应含红色 logo，实际 [${out.rgba[oi]},${out.rgba[oi + 1]},${out.rgba[oi + 2]}]`);
});
