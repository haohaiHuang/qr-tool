// Finder Pattern（QR 三回字定位符）检测 — 纯函数，node 可测
// 标准 QR 定位符：7x7 模块，黑白比例 1:1:3:1:1（黑-白-黑-白-黑），中心黑块 3 倍宽

/** 扫描一行灰度，返回游程列表 [{color, len}]（color: 0=黑/255=白） */
function runLengths(row, width) {
  const runs = [];
  let start = 0;
  let color = row[0];
  for (let i = 1; i < width; i++) {
    if (row[i] !== color) {
      runs.push({ color, len: i - start });
      start = i;
      color = row[i];
    }
  }
  runs.push({ color, len: width - start });
  return runs;
}

/** 判断 5 段是否近似 1:1:3:1:1（黑白黑白黑），返回中心 x 位置或 null */
function matchFinderRuns(runs, i, width) {
  const r0 = runs[i], r1 = runs[i + 1], r2 = runs[i + 2], r3 = runs[i + 3], r4 = runs[i + 4];
  if (!r4) return null;
  // 颜色必须是 黑 白 黑 白 黑
  if (r0.color !== 0 || r1.color !== 255 || r2.color !== 0 || r3.color !== 255 || r4.color !== 0) return null;
  // 中心黑段应约为边缘黑段的 2.5~3.5 倍
  const ratio = r2.len / (r0.len + r4.len + 1);
  if (ratio < 1.2 || ratio > 2.2) return null;
  // 白段长度应接近边缘黑段（±60%）
  const r0r = Math.min(r0.len, r4.len) + 1;
  const r0b = Math.max(r0.len, r4.len);
  const wAvg = (r1.len + r3.len) / 2;
  if (wAvg > r0b * 1.6 || wAvg < r0r * 0.4) return null;
  // 中心 x（r2 的中间，即 r0+r1 之后 + r2/2）
  let x = 0;
  for (let k = 0; k <= i + 2; k++) x += runs[k].len;
  x -= runs[i + 2].len / 2;
  return Math.round(x);
}

/** 垂直验证：从 (x, cy) 向上定位完整 1:1:3:1:1 模式起点，再数 5 段验证，返回中心 y 或 null */
function verifyVertical(gray, width, height, x, cy) {
  // 1) cy 所在黑段顶部（若 cy 在白段则 top=cy）
  let top = cy;
  while (top > 0 && gray[top * width + x] === 0) top--;
  // 2) 扩展：top 上方是白段 → 找白段顶 → 再上方黑段即 r0，向上到 r0 起点
  if (top > 0 && gray[(top - 1) * width + x] === 255) {
    let wt = top - 1;
    while (wt > 0 && gray[(wt - 1) * width + x] === 255) wt--;
    const rb = wt - 1;
    if (rb >= 0 && gray[rb * width + x] === 0) {
      let rt = rb;
      while (rt > 0 && gray[(rt - 1) * width + x] === 0) rt--;
      top = rt;
    } else {
      top = wt; // 上方不是黑段，从白段顶开始（后续比例检查会拒绝）
    }
  }
  const start = top;
  // 3) 从 start 向下数段
  const seg = [];
  let cur = gray[start * width + x];
  let len = 0;
  let p = start;
  while (p < height && seg.length < 6) {
    if (gray[p * width + x] === cur) len++;
    else { seg.push({ color: cur, len }); cur = gray[p * width + x]; len = 1; }
    p++;
  }
  seg.push({ color: cur, len });
  if (seg.length < 5) return null;
  // 4) 检查 黑 白 黑 白 黑
  const r0 = seg[0], r1 = seg[1], r2 = seg[2], r3 = seg[3], r4 = seg[4];
  if (r0.color !== 0 || r1.color !== 255 || r2.color !== 0 || r3.color !== 255 || r4.color !== 0) return null;
  const ratio = r2.len / (r0.len + r4.len + 1);
  if (ratio < 1.2 || ratio > 2.2) return null;
  const r0r = Math.min(r0.len, r4.len) + 1;
  const r0b = Math.max(r0.len, r4.len);
  const wAvg = (r1.len + r3.len) / 2;
  if (wAvg > r0b * 1.6 || wAvg < r0r * 0.4) return null;
  // 5) 中心 y = r0 起点 + r0 + r1 + r2/2
  return Math.round(start + r0.len + r1.len + r2.len / 2);
}

/** 候选点聚类（贪心）：与已有簇中心距离 < size 则并入 */
function cluster(pts, size) {
  const centers = [];
  for (const p of pts) {
    let merged = false;
    for (const c of centers) {
      if (Math.abs(c.x - p.x) < size && Math.abs(c.y - p.y) < size) {
        c.x = Math.round((c.x + p.x) / 2);
        c.y = Math.round((c.y + p.y) / 2);
        merged = true;
        break;
      }
    }
    if (!merged) centers.push({ x: p.x, y: p.y });
  }
  return centers;
}

/** 检测 QR 定位符，返回中心点列表 [{x, y}] */
export function detectFinderPatterns(gray, width, height) {
  const candidates = [];
  for (let y = 0; y < height; y++) {
    const row = gray.subarray(y * width, (y + 1) * width);
    const runs = runLengths(row, width);
    for (let i = 0; i < runs.length - 4; i++) {
      const x = matchFinderRuns(runs, i, width);
      if (x === null) continue;
      // 垂直验证
      const cy = verifyVertical(gray, width, height, x, y);
      if (cy === null) continue;
      candidates.push({ x, y: cy });
    }
  }
  // 估计 Finder 尺寸（第一段黑长作为模块尺寸的近似，用于聚类阈值）
  const size = 6; // 保守聚类距离
  return cluster(candidates, size);
}
