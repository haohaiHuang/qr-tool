import { test } from "node:test";
import assert from "node:assert/strict";
import { detectGrid, detectModuleStyle } from "../src/detect/grid.js";
import { toGrayImage } from "../src/shared/pixels.js";
import { buildQrImage } from "./helpers/qr-image.js";

const QUIET = 4;
import { redraw } from "../src/qr/redraw.js";
import { generateMatrix } from "../src/qr/generate.js";

// TC-G1: 合成码（纯黑白 quiet=4）网格误差 ≤0.5 模块
test("TC-G1: 合成码网格定位（quiet=4）", () => {
  const { rgba, width, height } = buildQrImage("GRID TEST G1", 4, 4);
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid, "应定位到网格");
  assert.equal(grid.n, 21, "短文本 → version 1 → 21 模块");
  // 模块 (0,0) 中心 = quiet(4)*4px + 半模块(2px) = 18
  const [x0, y0] = grid.toPixel(0, 0);
  assert.ok(Math.abs(x0 - 18) <= 2, `模块(0,0)中心 x≈18，实际 ${x0}`);
  assert.ok(Math.abs(y0 - 18) <= 2, `模块(0,0)中心 y≈18，实际 ${y0}`);
  // 模块 (20,20) 中心 = 18 + 20*4 = 98
  const [x1, y1] = grid.toPixel(20, 20);
  assert.ok(Math.abs(x1 - 98) <= 2, `模块(20,20)中心 x≈98，实际 ${x1}`);
  assert.ok(Math.abs(y1 - 98) <= 2);
});

// TC-G2: quiet=8/12 网格误差 ≤0.5 模块
test("TC-G2: quiet zone 不同（8/12）", () => {
  for (const quiet of [8, 12]) {
    const { rgba, width, height } = buildQrImage("GRID G2", 4, quiet);
    const gray = toGrayImage(rgba, width, height);
    const grid = detectGrid(gray, width, height);
    assert.ok(grid, `quiet=${quiet} 应定位到网格`);
    assert.equal(grid.n, 21);
    const [x0, y0] = grid.toPixel(0, 0);
    assert.ok(Math.abs(x0 - (quiet * 4 + 2)) <= 2, `quiet=${quiet} 模块(0,0) x≈${quiet * 4 + 2}，实际 ${x0}`);
  }
});

// TC-G4: 纯白图 → null
test("TC-G4: 纯白图返回 null", () => {
  const W = 100, H = 100;
  const gray = new Uint8ClampedArray(W * H).fill(255);
  assert.equal(detectGrid(gray, W, H), null);
});

// TC-G3: 模糊/JPEG 码网格误差 ≤1 模块
test("TC-G3: 模糊码网格定位", () => {
  const { rgba, width, height } = buildQrImage("GRID G3 BLUR", 4, 4);
  const gray = toGrayImage(rgba, width, height);
  // 3x3 均值模糊（灰度渐变）
  const blurred = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < height && xx >= 0 && xx < width) { sum += gray[yy * width + xx]; n++; }
        }
      }
      blurred[y * width + x] = sum / n;
    }
  }
  const grid = detectGrid(blurred, width, height);
  assert.ok(grid, "模糊码应定位到网格");
  assert.equal(grid.n, 21);
  const [x0] = grid.toPixel(0, 0);
  assert.ok(Math.abs(x0 - 18) <= 4, `模糊码模块(0,0) x≈18（容差 1 模块），实际 ${x0}`);
});

// TC-G5: 实心模块码 → moduleFill≈1（无间隙）
test("TC-G5: 实心模块检测无间隙", () => {
  const { rgba, width, height } = buildQrImage("GRID G5 SOLID", 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const style = detectModuleStyle(gray, width, height, grid);
  assert.ok(style.moduleFill >= 0.97, `实心模块 fill 应≈1，实际 ${style.moduleFill}`);
  assert.equal(style.moduleRadius, 0);
});

// TC-G6: 间隙+圆角码（redraw 生成）→ 检测出间隙
test("TC-G6: 间隙圆角模块检测出 fill<1", () => {
  const { matrix } = generateMatrix("GRID G6 GAP", QUIET);
  const n = matrix.length;
  // 用 redraw 生成圆角间隙码
  const out = redraw(matrix, n, { fg: [0, 0, 0], bg: [255, 255, 255], moduleRadius: 0.3, moduleFill: 0.85 }, 4);
  const gray = toGrayImage(out.rgba, out.width, out.height);
  const grid = detectGrid(gray, out.width, out.height);
  assert.ok(grid);
  const style = detectModuleStyle(gray, out.width, out.height, grid);
  assert.ok(style.moduleFill < 0.95, `间隙码 fill 应<1，实际 ${style.moduleFill}`);
  assert.ok(style.moduleRadius > 0, `间隙码应有圆角，实际 ${style.moduleRadius}`);
});

// TC-G7: 高版本码（77 模块）网格定位——finder 误报时选对真三角
test("TC-G7: 高版本码（77 模块）网格定位", () => {
  const longText = "HIGHV" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(8);
  const { rgba, width, height } = buildQrImage(longText, 4, QUIET);
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid, "应定位到网格");
  assert.ok(grid.n >= 65, `高版本码 n 应大（69+），实际 ${grid.n}`);
});
