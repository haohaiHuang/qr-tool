import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCode } from "../src/detect/route.js";
import { detectFinderPatterns } from "../src/detect/finder.js";
import { detectCircle } from "../src/detect/circle.js";

// 画 Finder（与 finder.test.js 同辅助）
function drawFinder(gray, width, height, cx, cy, modulePx) {
  const pattern = [
    "1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111",
  ];
  const size = 7 * modulePx;
  const x0 = cx - Math.floor(size / 2);
  const y0 = cy - Math.floor(size / 2);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = pattern[Math.floor(r / modulePx)][Math.floor(c / modulePx)] === "1" ? 0 : 255;
      const y = y0 + r, x = x0 + c;
      if (y >= 0 && y < height && x >= 0 && x < width) gray[y * width + x] = v;
    }
  }
}

// 画圆环
function drawRing(gray, width, height, cx, cy, r1, r2) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= r1 && d <= r2) gray[y * width + x] = 0;
    }
  }
}

test("classifyCode: 三 Finder → qr", () => {
  const W = 200, H = 200;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  drawFinder(gray, W, H, 50, 50, 4);
  drawFinder(gray, W, H, 150, 50, 4);
  drawFinder(gray, W, H, 50, 150, 4);
  const r = classifyCode(gray, W, H);
  assert.equal(r.type, "qr");
  assert.equal(r.finders.length, 3);
});

test("classifyCode: 同心圆环 → wechat", () => {
  const W = 200, H = 200;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  drawRing(gray, W, H, 100, 100, 34, 44);
  drawRing(gray, W, H, 100, 100, 20, 26);
  const r = classifyCode(gray, W, H);
  assert.equal(r.type, "wechat");
  assert.ok(r.circle && Math.abs(r.circle.radius - 44) <= 4);
});

test("classifyCode: 纯白 → unknown", () => {
  const W = 100, H = 100;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  assert.equal(classifyCode(gray, W, H).type, "unknown");
});
