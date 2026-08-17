import { test } from "node:test";
import assert from "node:assert/strict";
import { detectCircle } from "../src/detect/circle.js";

// 画圆环：中心 (cx,cy)，内半径 r1，外半径 r2（含边界），环内黑色
function drawRing(gray, width, height, cx, cy, r1, r2) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= r1 && d <= r2) gray[y * width + x] = 0;
    }
  }
}

test("detectCircle: 同心双圆环（微信码特征）", () => {
  const W = 200, H = 200;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  drawRing(gray, W, H, 100, 100, 34, 44); // 外环
  drawRing(gray, W, H, 100, 100, 20, 26); // 内环
  const c = detectCircle(gray, W, H);
  assert.ok(c !== null, "应检测到圆");
  assert.ok(Math.abs(c.x - 100) <= 3, `中心 x≈100，实际 ${c?.x}`);
  assert.ok(Math.abs(c.y - 100) <= 3, `中心 y≈100，实际 ${c?.y}`);
  assert.ok(Math.abs(c.radius - 44) <= 4, `半径≈44，实际 ${c?.radius}`);
});

test("detectCircle: 纯白图无圆", () => {
  const W = 100, H = 100;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  assert.equal(detectCircle(gray, W, H), null);
});

test("detectCircle: 方形块不是圆（QR 定位符样式）", () => {
  const W = 100, H = 100;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  // 中央 40x40 实心方块
  for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) gray[y * W + x] = 0;
  assert.equal(detectCircle(gray, W, H), null, "方形应判非圆");
});
