import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSharpness, needsRebuild } from "../src/quality.js";
import { buildQrImage } from "./helpers/qr-image.js";

// 3x3 均值模糊
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

test("detectSharpness: 清晰码梯度大，模糊码梯度小", () => {
  const { rgba, width, height } = buildQrImage("SHARPNESS TEST", 4, 4);
  const sharp = detectSharpness(rgba, width, height);
  // 模糊版
  const gray = buildQrImage("SHARPNESS TEST", 4, 4).rgba;
  const blurred = blur3(gray, width, height);
  const blurredRgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < blurred.length; i++, j += 4) {
    blurredRgba[j] = blurred[i]; blurredRgba[j + 1] = blurred[i]; blurredRgba[j + 2] = blurred[i]; blurredRgba[j + 3] = 255;
  }
  const soft = detectSharpness(blurredRgba, width, height);
  assert.ok(sharp > soft * 2, `清晰码梯度应远大于模糊码：${sharp.toFixed(1)} vs ${soft.toFixed(1)}`);
});

test("needsRebuild: 清晰码不需要重建，模糊码需要", () => {
  const { rgba, width, height } = buildQrImage("REBUILD TEST", 4, 4);
  const s = detectSharpness(rgba, width, height);
  assert.equal(needsRebuild(rgba, width, height, s), false, "清晰码不需要重建");
  // 模糊
  const gray = buildQrImage("REBUILD TEST", 4, 4).rgba;
  const blurred = blur3(gray, width, height);
  const br = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < blurred.length; i++, j += 4) {
    br[j] = blurred[i]; br[j + 1] = blurred[i]; br[j + 2] = blurred[i]; br[j + 3] = 255;
  }
  const s2 = detectSharpness(br, width, height);
  assert.equal(needsRebuild(br, width, height, s2), true, "模糊码需要重建");
});
