// UI 薄层：文件 → 像素 → 核心引擎 → 渲染。不含算法逻辑。

import { toGrayImage } from "../src/shared/pixels.js";
import { classifyCode } from "../src/detect/route.js";
import { enhance2 } from "../src/qr/enhance2.js";
import { generateMatrix } from "../src/qr/generate.js";

// 模块加载完成标记（诊断用：看到"就绪"说明 ui.js 执行成功）
const drop = document.getElementById("drop");
const fileInput = document.getElementById("file");
const statusEl = document.getElementById("status");

// 状态提示（type 支持 "" / "ok" / "warn"）
function status(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}
const resultEl = document.getElementById("result");
const srcCanvas = document.getElementById("src");
const outCanvas = document.getElementById("out");

let current = null; // { rgba, width, height, text }

// ---------- 输入 ----------
drop.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
["dragover", "dragenter"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
["dragleave"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("dragover");
  const f = e.dataTransfer.files?.[0];
  if (f) handleFile(f);
});

// ---------- 处理 ----------
async function handleFile(file) {
  status("处理中…");
  resultEl.style.display = "none";
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const gray = toGrayImage(imgData.data, canvas.width, canvas.height);
    const route = classifyCode(gray, canvas.width, canvas.height);

    if (route.type === "qr") {
      const r = enhance2(imgData.data, canvas.width, canvas.height, 8);
      if (!r.ok) {
        status(`处理失败：${r.reason === "decode-failed" ? "无法解码（图片太模糊或不是二维码）" : "自检未通过"}`, "warn");
        return;
      }
      current = { rgba: r.rgba, width: r.width, height: r.height, text: r.text, origData: imgData.data, origW: canvas.width, origH: canvas.height };
      showPreview(imgData.data, canvas.width, canvas.height, current);
      const engine = r.engine === "B" ? "结构重绘（保留原码排列/配色/logo）" : "重编码（兜底）";
      status(`✅ 增强完成（${engine}）：内容「${r.text}」· ${canvas.width}px → ${r.width}px · 自检通过`);
    } else if (route.type === "wechat") {
      status("检测到微信小程序码：建议在微信开发者后台用 API 重新生成（官方 1280px）。视觉重绘功能开发中。", "warn");
    } else {
      status("无法识别的码类型：请上传标准二维码或微信小程序码截图。", "warn");
    }
  } catch (err) {
    status("处理出错：" + err.message, "warn");
  }
}

// ---------- 预览 ----------
function showPreview(srcData, w, h, result) {
  srcCanvas.width = w; srcCanvas.height = h;
  srcCanvas.getContext("2d").putImageData(new ImageData(srcData, w, h), 0, 0);
  outCanvas.width = result.width; outCanvas.height = result.height;
  outCanvas.getContext("2d").putImageData(new ImageData(result.rgba, result.width, result.height), 0, 0);
  resultEl.style.display = "block";
}

// ---------- 导出 ----------
document.getElementById("dl-png").addEventListener("click", async () => {
  if (!current) return;
  status("生成 4000px 高清版…");
  try {
    // 直接重新处理生成高清（跳过预览图的放大损失，logo 从原图直接采样）
    const n = Math.round(current.width / 8); // 模块数（当前输出 = n*8）
    const big = enhance2(current.origData, current.origW, current.origH, Math.round(4000 / n));
    if (!big.ok) { status("高清生成失败：" + big.reason, "warn"); return; }
    const canvas = document.createElement("canvas");
    canvas.width = big.width; canvas.height = big.height;
    canvas.getContext("2d").putImageData(new ImageData(big.rgba, big.width, big.height), 0, 0);
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "qr-enhanced-4000px.png";
      a.click();
      status("✅ 已下载 4000px 高清版");
    }, "image/png");
  } catch (e) {
    status("下载失败：" + e.message, "warn");
  }
});

// 调试接口（供自动化测试）
window.__processFile = handleFile;

// 就绪提示（模块执行到此处 = 所有绑定成功）
statusEl.textContent = "✓ 就绪：拖拽或点击选择二维码图片";

document.getElementById("dl-svg").addEventListener("click", () => {
  if (!current) return;
  const { size, matrix } = generateMatrix(current.text);
  const svg = buildSvg(matrix, size, 10);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "qr-enhanced.svg";
  a.click();
});

function buildSvg(matrix, size, modulePx = 10) {
  const total = size * modulePx;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        rects.push(`<rect x="${c * modulePx}" y="${r * modulePx}" width="${modulePx}" height="${modulePx}"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects.join("")}</g></svg>`;
}

// 自动化测试钩子：?autotest=1 时自动处理内置测试图（headless 验证用）
if (new URLSearchParams(location.search).has("autotest")) {
  fetch("/ui/test-qr.png")
    .then((r) => r.arrayBuffer())
    .then((buf) => handleFile(new File([buf], "test-qr.png", { type: "image/png" })))
    .catch((e) => status("autotest 失败: " + e.message, "warn"));
}
