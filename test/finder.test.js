import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFinderPatterns } from "../src/detect/finder.js";

// 工具：画一个 Finder Pattern（7x7 模块，模块 = modulePx 像素，黑边白1黑3白1黑1）
function drawFinder(gray, width, height, cx, cy, modulePx, dark = 0, light = 255) {
  // Finder 总尺寸 7*modulePx
  const size = 7 * modulePx;
  const x0 = cx - Math.floor(size / 2);
  const y0 = cy - Math.floor(size / 2);
  // 模块相对坐标 (r, c) ∈ [0,7)：回字结构
  const pattern = [
    // 1:1:3:1:1 黑白交替
    "1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111",
  ].map((row) => row.split("").map((ch) => (ch === "1" ? dark : light)));
  for (let r = 0; r < size; r++) {
    const modR = Math.floor(r / modulePx);
    for (let c = 0; c < size; c++) {
      const modC = Math.floor(c / modulePx);
      const y = y0 + r;
      const x = x0 + c;
      if (y >= 0 && y < height && x >= 0 && x < width) {
        gray[y * width + x] = pattern[modR][modC];
      }
    }
  }
}

test("detectFinderPatterns: 单 Finder 在图中（100x100）", () => {
  const W = 100, H = 100;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  drawFinder(gray, W, H, 50, 50, 4); // 中心 28x28 Finder
  const pts = detectFinderPatterns(gray, W, H);
  assert.equal(pts.length, 1, "应检测到 1 个定位符");
  assert.ok(Math.abs(pts[0].x - 50) <= 4, `中心 x≈50，实际 ${pts[0].x}`);
  assert.ok(Math.abs(pts[0].y - 50) <= 4, `中心 y≈50，实际 ${pts[0].y}`);
});

test("detectFinderPatterns: 三 Finder 布局（标准 QR 三角）", () => {
  const W = 200, H = 200;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  // 左上 (50,50)、右上 (150,50)、左下 (50,150)
  drawFinder(gray, W, H, 50, 50, 4);
  drawFinder(gray, W, H, 150, 50, 4);
  drawFinder(gray, W, H, 50, 150, 4);
  const pts = detectFinderPatterns(gray, W, H);
  assert.equal(pts.length, 3, "应检测到 3 个定位符");
  // 三个点应大致在对应角落
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  assert.ok(xs[0] < 80 && xs[2] > 120, "x 分布：左 50 / 右 150");
  assert.ok(ys[0] < 80 && ys[2] > 120, "y 分布：上 50 / 下 150");
});

test("detectFinderPatterns: 纯白图无定位符", () => {
  const W = 100, H = 100;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  assert.equal(detectFinderPatterns(gray, W, H).length, 0);
});

// 真实感：抗锯齿/模糊的二维码（灰度渐变）仍应检测到定位符
test("detectFinderPatterns: 模糊（抗锯齿）图像仍能检测", () => {
  const W = 200, H = 200;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  drawFinder(gray, W, H, 50, 50, 4);
  drawFinder(gray, W, H, 150, 50, 4);
  drawFinder(gray, W, H, 50, 150, 4);
  // 3x3 邻域平均模拟抗锯齿模糊（产生灰度渐变而非纯黑白）
  const blurred = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < H && xx >= 0 && xx < W) { sum += gray[yy * W + xx]; n++; }
        }
      }
      blurred[y * W + x] = sum / n;
    }
  }
  const pts = detectFinderPatterns(blurred, W, H);
  assert.equal(pts.length, 3, "模糊图应检测到 3 个定位符");
});
