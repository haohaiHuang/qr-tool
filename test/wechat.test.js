import { test } from "node:test";
import assert from "node:assert/strict";
import { enlarge, detectWechatCircle } from "../src/wechat.js";
import { buildQrImage } from "./helpers/qr-image.js";

// 构造圆形码：深色外环 + 中心 logo + 放射线段
function buildWechatLike(w) {
  const rgba = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
  }
  const cx = w / 2, cy = w / 2;
  const put = (x, y, r, g, b) => {
    if (x >= 0 && x < w && y >= 0 && y < w) {
      const i = (y * w + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b;
    }
  };
  // 外环（半径 100-105）
  for (let a = 0; a < 360; a++) {
    const th = (a * Math.PI) / 180;
    for (let r = 100; r <= 105; r++) {
      put(Math.round(cx + Math.cos(th) * r), Math.round(cy + Math.sin(th) * r), 0, 0, 0);
    }
  }
  // 中心 logo（半径 30 深青）
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - cx, y - cy) <= 30) put(x, y, 0, 100, 100);
    }
  }
  // 放射线段（8 条，半径 35-95）
  for (let a = 0; a < 360; a += 45) {
    const th = (a * Math.PI) / 180;
    for (let r = 35; r <= 95; r++) {
      put(Math.round(cx + Math.cos(th) * r), Math.round(cy + Math.sin(th) * r), 0, 0, 0);
    }
  }
  return rgba;
}

test("wechat: 高清放大尺寸正确", () => {
  const w = 215;
  const rgba = buildWechatLike(w);
  const out = enlarge(rgba, w, w, 3);
  assert.equal(out.width, 645);
  assert.equal(out.height, 645);
  assert.equal(out.rgba.length, 645 * 645 * 4);
});

test("wechat: 放大保留结构（外环/中心/线段区域颜色）", () => {
  const w = 215;
  const rgba = buildWechatLike(w);
  const out = enlarge(rgba, w, w, 3);
  const center = Math.floor(645 / 2);
  // 中心 logo（深青）
  const ci = (center * 645 + center) * 4;
  assert.ok(out.rgba[ci + 1] > 50, "中心保留深青");
  // 外环带（放大后扫描中心列 600-1000 范围，应存在黑色像素）
  let foundDark = false;
  for (let y = 600; y <= 1000 && !foundDark; y++) {
    const ri = (y * 645 + center) * 4;
    if (out.rgba[ri] < 200) foundDark = true;
  }
  assert.ok(foundDark, "外环保留黑色");
  // 背景（半径 200*3）
  const bi = (Math.round(center + 294) * 645 + center) * 4; // y=616, 原图~98（放射线95外、外环100内）背景
  assert.ok(out.rgba[bi] > 200, "背景白色");
});

test("wechat: 圆环定位检测", () => {
  const w = 215;
  const rgba = buildWechatLike(w);
  const det = detectWechatCircle(rgba, w, w);
  assert.ok(det, "应检测到圆形码");
  assert.ok(Math.abs(det.cx - w / 2) < 5, "圆心 x");
  assert.ok(Math.abs(det.outerRadius - 105) < 10, `外环半径≈105，实际 ${det.outerRadius}`);
});
