import { test } from "node:test";
import assert from "node:assert/strict";
import { toGray, toGrayImage } from "../src/shared/pixels.js";

test("toGray: 加权灰度转换（ITU-R BT.601）", () => {
  // 纯红 255 → 0.299*255 ≈ 76
  assert.ok(Math.abs(toGray(255, 0, 0) - 76) < 2, "红色应≈76");
  // 纯绿 255 → 0.587*255 ≈ 150
  assert.ok(Math.abs(toGray(0, 255, 0) - 150) < 2, "绿色应≈150");
  // 纯蓝 255 → 0.114*255 ≈ 29
  assert.ok(Math.abs(toGray(0, 0, 255) - 29) < 2, "蓝色应≈29");
  // 黑白
  assert.equal(toGray(0, 0, 0), 0);
  assert.equal(toGray(255, 255, 255), 255);
});

test("toGrayImage: 像素数组转灰度（保持尺寸）", () => {
  // 输入 RGBA 数组（2x2）：黑白各半
  const rgba = new Uint8ClampedArray([
    255, 255, 255, 255, 0, 0, 0, 255,
    0, 0, 0, 255, 128, 128, 128, 255,
  ]);
  const gray = toGrayImage(rgba, 2, 2);
  assert.equal(gray.length, 4, "灰度数组 = 宽*高");
  assert.equal(gray[0], 255);
  assert.equal(gray[1], 0);
  assert.equal(gray[2], 0);
  assert.ok(Math.abs(gray[3] - 128) < 2);
});
