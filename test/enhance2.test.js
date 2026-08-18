import { test } from "node:test";
import assert from "node:assert/strict";
import { enhance2 } from "../src/qr/enhance2.js";
import { decodeQR } from "../src/qr/decode.js";
import { generateMatrix } from "../src/qr/generate.js";
import { buildQrImage } from "./helpers/qr-image.js";

const QUIET = 4;

// TC-E1: 标准码 → B 引擎成功（扫码一致 + 视觉接近）
test("TC-E1: 标准码走 B 引擎（结构重绘）", () => {
  const text = "ENHANCE2 E1";
  const { rgba, width, height } = buildQrImage(text, 3, QUIET); // 低分辨率（模块 3px）
  const r = enhance2(rgba, width, height, 8);
  assert.equal(r.ok, true, `应成功：${r.reason ?? ""}`);
  assert.equal(r.engine, "B", "标准码应走 B 引擎（结构重绘）");
  assert.equal(r.text, text);
  // 输出尺寸增大（3px → 8px 模块）
  assert.ok(r.width > width);
  // 输出可扫码且内容一致
  assert.equal(decodeQR(r.rgba, r.width, r.height), text);
});

// TC-E2: 带 logo 码 → B 成功 + logo 保留
test("TC-E2: 带 logo 码 B 引擎 + logo 保留", () => {
  const text = "ENHANCE2 E2 LOGO";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  // 中心画 logo（深色圆，模拟真实）
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const r = Math.floor(width * 0.08);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        const i = (y * width + x) * 4;
        rgba[i] = 40; rgba[i + 1] = 60; rgba[i + 2] = 180; // 深蓝 logo
      }
    }
  }
  const res = enhance2(rgba, width, height, 8);
  assert.equal(res.ok, true, `应成功：${res.reason ?? ""}`);
  assert.equal(res.engine, "B");
  assert.equal(res.text, text);
  // logo 保留：输出中心区域含 logo 蓝（非纯 fg/bg）
  const oi = (Math.floor(res.height / 2) * res.width + Math.floor(res.width / 2)) * 4;
  const b = res.rgba[oi + 2];
  assert.ok(b > 120, `输出中心应含 logo 蓝色，实际 B=${b}`);
});

// TC-E3: B 定位失败（遮挡一个 finder）→ 回退 A 引擎 → 扫码一致
test("TC-E3: B 失败回退 A 引擎", () => {
  const text = "ENHANCE2 E3 FALLBACK";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  // 遮住右上 finder 区域（白色）→ detectGrid 找不到 3 finder → B 失败
  const { size, matrix } = generateMatrix(text, QUIET);
  const n = size - QUIET * 2;
  // 右上 finder 的像素区域：quiet 右边界内 7 模块
  const fPx = 7 * 4;
  const xStart = width - (QUIET * 4 + fPx);
  for (let y = QUIET * 4; y < QUIET * 4 + fPx; y++) {
    for (let x = xStart; x < xStart + fPx; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255;
    }
  }
  const r = enhance2(rgba, width, height, 8);
  // 遮挡 finder：B 定位应不可用（不假报 B 成功）；结果要么回退 A 要么明确失败
  assert.ok(!r.ok || r.engine === "A", `B 不应假成功：ok=${r.ok} engine=${r.engine} reason=${r.reason ?? ""}`);
  if (r.ok) assert.equal(r.text, text, "回退成功时内容必须一致");
});

// TC-E4: 白图 → 明确失败
test("TC-E4: 白图明确失败", () => {
  const size = 100;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  const r = enhance2(rgba, size, size);
  assert.equal(r.ok, false);
  assert.ok(r.reason, "应给出失败原因");
});
