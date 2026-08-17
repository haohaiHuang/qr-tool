// Logo 码处理：中心区域抹白后重解（纠错恢复被 logo 覆盖的数据）— 纯函数

/** 抹白图中心圆形区域（半径 = min(w,h)*ratio），返回新 rgba（不修改原图） */
export function maskCenter(rgba, width, height, ratio = 0.16) {
  const out = new Uint8ClampedArray(rgba);
  const cx = width / 2, cy = height / 2;
  const r = Math.floor(Math.min(width, height) * ratio);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (Math.hypot(x - cx, y - cy) <= r) {
        const i = (y * width + x) * 4;
        out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = 255;
      }
    }
  }
  return out;
}
