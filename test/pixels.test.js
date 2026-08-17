import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toGray,
  toGrayImage,
  cropGray,
  resizeGray,
  binarize,
  adaptiveThreshold,
} from "../src/shared/pixels.js";

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

test("cropGray: 裁剪子区域（尺寸与内容）", () => {
  // 3x3 灰度，值 = 行*3+列
  const g = new Uint8ClampedArray([
    0, 1, 2,
    3, 4, 5,
    6, 7, 8,
  ]);
  const c = cropGray(g, 3, 3, 1, 1, 2, 2);
  assert.equal(c.length, 4, "2x2 = 4");
  assert.deepEqual(Array.from(c), [4, 5, 7, 8], "裁出右下 2x2");
});

test("resizeGray: 最近邻缩放", () => {
  // 2x2 → 4x4（每个像素翻倍）
  const g = new Uint8ClampedArray([
    0, 1,
    2, 3,
  ]);
  const r = resizeGray(g, 2, 2, 4, 4);
  assert.equal(r.length, 16);
  assert.deepEqual(Array.from(r), [
    0, 0, 1, 1,
    0, 0, 1, 1,
    2, 2, 3, 3,
    2, 2, 3, 3,
  ]);
});

test("binarize: 全局阈值", () => {
  const g = new Uint8ClampedArray([0, 127, 128, 255]);
  const b = binarize(g, 128);
  assert.deepEqual(Array.from(b), [0, 0, 255, 255], "<128→0，≥128→255");
});

test("adaptiveThreshold: 渐变背景下的局部阈值（全局阈值会失败）", () => {
  // 8x1：左暗右亮的渐变背景，中间一个暗块（值 60）
  // 背景：左侧 200，右侧 60（亮暗渐变）
  // 设计：背景从左 220 渐变到右 40，块位置在索引 4（值 60，与右端背景接近）
  // 全局阈值（均值≈130）会把右半背景全判为前景；自适应应只标出真正的块
  const g = new Uint8ClampedArray([220, 200, 180, 160, 140, 120, 100, 80]);
  const block = 3;
  const C = 10;
  const a = adaptiveThreshold(g, 8, 1, block, C);
  // 与全局阈值对比：全局（均值 150）会把 <150 全变 255（5 个）；
  // 自适应应只标记与邻域均值差 > C 的（这里纯渐变没有块，理论上全 0）
  assert.ok(
    a.every((v) => v === 0),
    "纯渐变无孤立块时自适应应全 0（对比局部均值）",
  );
});

test("adaptiveThreshold: 能找出比邻域暗的块", () => {
  // 10x1：均匀亮背景（200），中间一个暗块（50）
  const g = new Uint8ClampedArray([200, 200, 200, 200, 50, 200, 200, 200, 200, 200]);
  const a = adaptiveThreshold(g, 10, 1, 3, 15);
  // 暗块位置（索引 4）应标 255（前景），背景 0
  assert.equal(a[4], 255, "暗块应被标为前景");
  assert.equal(a[0], 0, "背景应为 0");
  assert.equal(a[9], 0);
});
