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
  const out = redraw(sampled, grid.n, style, 8, { rgba, width, height, cx: lcx, cy: lcy, srcHalf: lr, logoRatio: 0.22 });
  // 输出中心像素应接近 logo 红（220,30,30），而非纯 fg/bg
  const oi = (Math.floor(out.height / 2) * out.width + Math.floor(out.width / 2)) * 4;
  assert.ok(out.rgba[oi] > 150 && out.rgba[oi + 1] < 100, `中心应含红色 logo，实际 [${out.rgba[oi]},${out.rgba[oi + 1]},${out.rgba[oi + 2]}]`);
});

// TC-R4: 圆角 + 间隙样式（微信码"虚线感"）——模块间留隙、圆角
test("TC-R4: 圆角+间隙样式（模块间为背景色）", () => {
  const { matrix } = generateMatrix("REDRAW R4");
  const n = matrix.length;
  const style = { fg: [0, 0, 0], bg: [255, 255, 255], moduleRadius: 0.3, moduleFill: 0.85 };
  const out = redraw(matrix, n, style, 8);
  // 找一对水平相邻 dark 模块（数据区，跳过 finder 实心区）
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let found = false;
  for (let r = 0; r < n && !found; r++) {
    for (let c = 0; c < n - 1; c++) {
      if (inFinder(r, c) || inFinder(r, c + 1)) continue;
      if (matrix[r][c] && matrix[r][c + 1]) {
        // 两模块格子之间的中点像素（gap 中心）应为背景
        const gapX = Math.floor((c + 1) * 8); // 模块 c 格子右边界 = 模块 c+1 左边界
        const y = Math.floor((r + 0.5) * 8);
        const i = (y * out.width + gapX) * 4;
        assert.ok(out.rgba[i] > 200, `模块间隙应为背景色，实际 ${out.rgba[i]}`);
        found = true;
        break;
      }
    }
  }
  assert.ok(found, "应找到相邻 dark 模块");
  // 圆角：数据区 dark 模块的格子角应接近背景（finder 实心无圆角）
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c] && !inFinder(r, c)) {
        // 模块格子左上角内 1px（圆角区）
        const x = Math.floor(c * 8) + 1, y = Math.floor(r * 8) + 1;
        const i = (y * out.width + x) * 4;
        assert.ok(out.rgba[i] > 200, `圆角角落应为背景（r=${r},c=${c}），实际 ${out.rgba[i]}`);
        return; // 只验证第一个
      }
    }
  }
});

// TC-R5: logo 区域不画模块（无"圆压方"）——logo 圆内像素来自原图
test("TC-R5: logo 区域原样（非模块压底）", () => {
  const text = "REDRAW R5";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  // 中心画彩色 logo（红圆）
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const r = Math.floor(width * 0.1);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        const i = (y * width + x) * 4;
        rgba[i] = 220; rgba[i + 1] = 30; rgba[i + 2] = 30;
      }
    }
  }
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const sampled = sampleModules(gray, width, height, grid);
  const style = detectStyle(rgba, width, height);
  const [lcx, lcy] = grid.toPixel(grid.n / 2, grid.n / 2);
  const lr = width * 0.12;
  const out = redraw(sampled, grid.n, style, 8, { rgba, width, height, cx: lcx, cy: lcy, srcHalf: lr, logoRatio: 0.22 });
  // logo 圆心像素 = 原图圆心像素（原样，而非模块色）
  const oi = (Math.floor(out.height / 2) * out.width + Math.floor(out.width / 2)) * 4;
  assert.ok(out.rgba[oi] > 150 && out.rgba[oi + 1] < 100, `logo 中心应=原图 logo 红，实际 [${out.rgba[oi]},${out.rgba[oi + 1]},${out.rgba[oi + 2]}]`);
});
