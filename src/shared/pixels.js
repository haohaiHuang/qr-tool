// 像素数组工具 — 纯函数，node 可测（不依赖 DOM/Canvas）
// 像素格式约定：RGBA 字节数组（Uint8ClampedArray），顺序 R,G,B,A 每像素 4 字节

/** 单像素加权灰度（ITU-R BT.601）：0.299R + 0.587G + 0.114B */
export function toGray(r, g, b) {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/** RGBA 像素数组 → 灰度数组（长度 = width*height） */
export function toGrayImage(rgba, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    gray[j] = toGray(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return gray;
}

/** 裁剪灰度子区域：原图 width×height，从 (x,y) 取 w×h */
export function cropGray(gray, width, height, x, y, w, h) {
  const out = new Uint8ClampedArray(w * h);
  for (let row = 0; row < h; row++) {
    const srcRow = y + row;
    const srcStart = srcRow * width + x;
    const dstStart = row * w;
    for (let col = 0; col < w; col++) {
      out[dstStart + col] = gray[srcStart + col];
    }
  }
  return out;
}

/** 最近邻缩放灰度：width×height → newW×newH */
export function resizeGray(gray, width, height, newW, newH) {
  const out = new Uint8ClampedArray(newW * newH);
  for (let row = 0; row < newH; row++) {
    const srcRow = Math.min(height - 1, Math.floor((row * height) / newH));
    for (let col = 0; col < newW; col++) {
      const srcCol = Math.min(width - 1, Math.floor((col * width) / newW));
      out[row * newW + col] = gray[srcRow * width + srcCol];
    }
  }
  return out;
}

/** 全局阈值二值化：< threshold → 0，≥ threshold → 255 */
export function binarize(gray, threshold = 128) {
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] < threshold ? 0 : 255;
  }
  return out;
}

/** 自适应阈值二值化（局部均值，暗块为前景）：像素 < 邻域均值 - C → 255（前景），否则 0
 *  用于光照不均/边缘模糊场景（微信码坑位检测）
 *  blockSize 邻域边长（奇数），C 常量偏移 */
export function adaptiveThreshold(gray, width, height, blockSize = 15, C = 10) {
  const half = Math.floor(blockSize / 2);
  const out = new Uint8ClampedArray(gray.length);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      // 邻域均值（对小块直接累加足够）
      let sum = 0;
      let count = 0;
      for (let dy = -half; dy <= half; dy++) {
        const r = row + dy;
        if (r < 0 || r >= height) continue;
        for (let dx = -half; dx <= half; dx++) {
          const c = col + dx;
          if (c < 0 || c >= width) continue;
          sum += gray[r * width + c];
          count++;
        }
      }
      const mean = sum / count;
      out[row * width + col] = gray[row * width + col] < mean - C ? 255 : 0;
    }
  }
  return out;
}
