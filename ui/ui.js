// UI 薄层：文件 → 像素 → 核心引擎 → 渲染。不含算法逻辑。

import { toGrayImage } from "../src/shared/pixels.js";
import { classifyCode } from "../src/detect/route.js";
import { enhance2 } from "../src/qr/enhance2.js";
import { buildSvg } from "../src/svg.js";
import { enlarge } from "../src/wechat.js";
import { detectSharpness, needsRebuild } from "../src/quality.js";

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
      // 标准码：语义级重建（结构重绘）——模块矢量重绘才是"高清无损"（任意分辨率锐利）
      const target = 1184;
      const r = enhance2(imgData.data, canvas.width, canvas.height, Math.round(target / 37));
      if (!r.ok) {
        // 重建失败 → 像素放大兜底（不报错，但非无损）
        const big = enlarge(imgData.data, canvas.width, canvas.height, null, 1184);
        current = { rgba: big.rgba, width: big.width, height: big.height, text: "二维码", fallback: true };
        showPreview(imgData.data, canvas.width, canvas.height, current);
        status(`⚠️ 结构重绘失败，已用高清放大兜底（保留原样，非矢量无损）：${canvas.width}px → ${big.width}px`, "warn");
        return;
      }
      // 保存重绘结果 + 放大版（供切换），默认重绘
      const enlarged = enlarge(imgData.data, canvas.width, canvas.height, null, 1184);
      current = { rgba: r.rgba, width: r.width, height: r.height, text: r.text, style: r.style, n: r.n, logo: r.logo, matrix: r.matrix, alt: { rgba: enlarged.rgba, width: enlarged.width, height: enlarged.height }, mode: "redraw" };
      showPreview(imgData.data, canvas.width, canvas.height, current);
      const engine = r.engine === "B" ? "结构重绘（模块矢量，高清无损）" : "重编码（兜底）";
      status(`✅ ${engine}：${canvas.width}px → ${r.width}px · 自检通过 · 可切换「原样放大」`);
    } else if (route.type === "wechat") {
      // 微信圆形码：高清放大（保留原样/色彩/创意结构）
      status("微信码高清放大中…");
      const r = enlarge(imgData.data, canvas.width, canvas.height, null, 1184);
      current = { rgba: r.rgba, width: r.width, height: r.height, text: "微信小程序码", isWechat: true, origData: imgData.data, origW: canvas.width, origH: canvas.height };
      showPreview(imgData.data, canvas.width, canvas.height, current);
      status(`✅ 微信码高清放大：${canvas.width}px → ${r.width}px（保留原样，扫码成功率不保证）`);
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
const switchHint = document.getElementById("switch-hint");
if (switchHint) {
  switchHint.addEventListener("click", () => {
    status("如增强编码放大有误，可点击切换为普通放大模式", "warn");
  });
}
const switchBtn = document.getElementById("switch-mode");
if (switchBtn) {
  switchBtn.addEventListener("click", () => {
    if (!current || !current.alt) return;
    current.mode = current.mode === "redraw" ? "enlarge" : "redraw";
    const data = current.mode === "redraw" ? current : current.alt;
    outCanvas.width = data.width; outCanvas.height = data.height;
    outCanvas.getContext("2d").putImageData(new ImageData(data.rgba, data.width, data.height), 0, 0);
    switchBtn.textContent = current.mode === "redraw" ? "切换：原样放大" : "切换：结构重绘";
    status(current.mode === "redraw" ? "当前：结构重绘（模块矢量，高清无损）" : "当前：原样放大（像素保真）");
  });
}

document.getElementById("dl-png").addEventListener("click", () => {
  if (!current) return;
  const data = current.alt && current.mode === "enlarge" ? current.alt : current;
  const canvas = document.createElement("canvas");
  canvas.width = data.width; canvas.height = data.height;
  canvas.getContext("2d").putImageData(new ImageData(data.rgba, data.width, data.height), 0, 0);
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qr-enhanced.png";
    a.click();
    status("✅ 已下载（与预览一致）");
  }, "image/png");
});

// 调试接口（供自动化测试）
window.__processFile = handleFile;

// 就绪提示（模块执行到此处 = 所有绑定成功）
statusEl.textContent = "✓ 就绪：拖拽或点击选择二维码图片";

document.getElementById("dl-svg").addEventListener("click", () => {
  if (!current) return;
  if (current.isWechat) {
    // 微信码 SVG：内嵌原图（矢量包装，按需缩放显示）
    const c = document.createElement("canvas");
    c.width = current.origW; c.height = current.origH;
    c.getContext("2d").putImageData(new ImageData(current.origData, current.origW, current.origH), 0, 0);
    const dataUrl = c.toDataURL("image/png");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${current.width}" height="${current.height}" viewBox="0 0 ${current.origW} ${current.origH}">` +
      `<rect width="${current.origW}" height="${current.origH}" fill="#ffffff"/><image x="0" y="0" width="${current.origW}" height="${current.origH}" preserveAspectRatio="xMidYMid meet" href="${dataUrl}"/></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wechat-code.svg";
    a.click();
    return;
  }
  const logoDataUrl = current.logo && current.logo.srcHalf > 0 ? cropLogoPng(current.logo) : null;
  const svg = buildSvg(current.matrix, current.n, current.style, logoDataUrl, current.logo ? current.logo.logoRatio : 0);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "qr-enhanced.svg";
  a.click();
});

// 裁原图 logo 方形区域 → PNG dataURL（SVG 嵌入，保持原 logo 形状）
function cropLogoPng(logo) {
  const { rgba, width, height, cx, cy, srcHalf } = logo;
  const r = Math.max(1, Math.round(srcHalf));
  const size = r * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.round(cx - r + x);
      const sy = Math.round(cy - r + y);
      const dst = (y * size + x) * 4;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      const src = (sy * width + sx) * 4;
      imgData.data[dst] = rgba[src];
      imgData.data[dst + 1] = rgba[src + 1];
      imgData.data[dst + 2] = rgba[src + 2];
      imgData.data[dst + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

// 自动化测试钩子：?autotest=1 时自动处理内置测试图（headless 验证用）
if (new URLSearchParams(location.search).has("autotest")) {
  fetch("/ui/test-qr.png")
    .then((r) => r.arrayBuffer())
    .then((buf) => handleFile(new File([buf], "test-qr.png", { type: "image/png" })))
    .then(() => {
      setTimeout(() => {
        try {
          const hasLogo = !!(current && current.logo);
          const logoDataUrl = hasLogo ? cropLogoPng(current.logo) : null;
          const svg = buildSvg(current.matrix, current.n, current.style, logoDataUrl, current.logo ? current.logo.logoRatio : 0);
          status(`AUTOTEST: engine=${current.style ? "B" : "?"} logo=${hasLogo} dataUrl=${!!logoDataUrl} svgLen=${svg.length} svgImg=${svg.includes("<image")}`);
        } catch (e) {
          status("AUTOTEST 错误: " + e.message);
        }
      }, 3000);
    })
    .catch((e) => status("autotest 失败: " + e.message, "warn"));
}
