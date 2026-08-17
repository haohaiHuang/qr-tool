import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeQR } from "../src/qr/decode.js";
import { buildQrImage } from "./helpers/qr-image.js";

test("decodeQR: 解码含文本的二维码", () => {
  const { rgba, width, height } = buildQrImage("HELLO WORLD 123");
  const data = decodeQR(rgba, width, height);
  assert.equal(data, "HELLO WORLD 123");
});

test("decodeQR: 解码 URL", () => {
  const { rgba, width, height } = buildQrImage("https://example.com/qr-test");
  assert.equal(decodeQR(rgba, width, height), "https://example.com/qr-test");
});

test("decodeQR: 白图返回 null", () => {
  const size = 100;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  assert.equal(decodeQR(rgba, size, size), null);
});
