import { test } from "node:test";
import assert from "node:assert/strict";
import { detectGrid } from "../src/detect/grid.js";
import { sampleModules } from "../src/detect/sampler.js";
import { toGrayImage } from "../src/shared/pixels.js";
import { generateMatrix, matrixToRgba } from "../src/qr/generate.js";
import { decodeQR } from "../src/qr/decode.js";
import { buildQrImage } from "./helpers/qr-image.js";

const QUIET = 4; // buildQrImage / generateMatrix 的 quiet

// 工具：对灰度图做 3x3 均值模糊（模拟抗锯齿）
function blur3(gray, width, height) {
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < height && xx >= 0 && xx < width) { sum += gray[yy * width + xx]; n++; }
        }
      }
      out[y * width + x] = sum / n;
    }
  }
  return out;
}

// TC-S1: 合成码采样矩阵 = 原矩阵（100%）
test("TC-S1: 合成码采样矩阵与原矩阵一致", () => {
  const text = "SAMPLE TEST S1";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const sampled = sampleModules(gray, width, height, grid);
  // 原矩阵（数据模块，跳过 quiet）
  const { size, matrix } = generateMatrix(text, QUIET);
  let same = 0, total = grid.n * grid.n;
  for (let r = 0; r < grid.n; r++) {
    for (let c = 0; c < grid.n; c++) {
      if (sampled[r][c] === matrix[r + QUIET][c + QUIET]) same++;
    }
  }
  assert.equal(same, total, `应 100% 一致（${same}/${total}）`);
});

// TC-S2: 模糊码一致率 ≥95%
test("TC-S2: 模糊码采样一致率 ≥95%", () => {
  const text = "BLUR SAMPLE S2";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  const blurred = blur3(gray, width, height);
  const grid = detectGrid(blurred, width, height);
  assert.ok(grid);
  const sampled = sampleModules(blurred, width, height, grid);
  const { matrix } = generateMatrix(text, QUIET);
  let same = 0;
  for (let r = 0; r < grid.n; r++) {
    for (let c = 0; c < grid.n; c++) {
      if (sampled[r][c] === matrix[r + QUIET][c + QUIET]) same++;
    }
  }
  const rate = same / (grid.n * grid.n);
  assert.ok(rate >= 0.95, `模糊码一致率应 ≥95%，实际 ${(rate * 100).toFixed(1)}%`);
});

// TC-S3: 带噪声码 → 采样 → 重绘 → 可扫码 = 原内容
test("TC-S3: 采样矩阵重绘后可扫码（含噪声）", () => {
  const text = "NOISY SAMPLE S3";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  const blurred = blur3(gray, width, height);
  // 椒盐噪声：固定位置翻转（确定性；~1% 稀疏，模拟真实噪点）
  for (let i = 0; i < blurred.length; i += 97) {
    blurred[i] = blurred[i] < 128 ? 255 : 0;
  }
  const grid = detectGrid(blurred, width, height);
  assert.ok(grid, "噪声码应定位到网格");
  const sampled = sampleModules(blurred, width, height, grid);
  // 用矩阵重绘（黑白）→ 解码应 = 原内容
  const out = matrixToRgba(sampled, grid.n, 4);
  assert.equal(decodeQR(out.rgba, out.width, out.height), text, "采样重绘后应可扫码且内容一致");
});
