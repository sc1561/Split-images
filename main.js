// ==================================
// إعدادات عامة
// ==================================

const DPI = 150; // دقة الطباعة المقترَحة للملصق الجداري

const imageInput = document.getElementById("imageInput");
const colsInput = document.getElementById("colsInput");
const rowsInput = document.getElementById("rowsInput");
const marginInput = document.getElementById("marginInput");
const orientationSelect = document.getElementById("orientation");
const generateBtn = document.getElementById("generateBtn");
const previewCanvas = document.getElementById("previewCanvas");
const infoBox = document.getElementById("infoBox");

const suggestionsList = document.getElementById("suggestionsList");
const refreshSuggestionsBtn = document.getElementById("refreshSuggestionsBtn");

let loadedImage = null;
let imgNaturalW = 0;
let imgNaturalH = 0;


// ==================================
// أدوات مساعدة
// ==================================

const mmToPx = (mm) => (mm / 25.4) * DPI;

// يرجع أبعاد A4 حسب الاتجاه الحالي كبيكسل (للرسم) وملّيمتر (لـPDF)
function getA4SizePx(orientation) {
  if (orientation === "landscape") {
    return {
      wPx: mmToPx(297),
      hPx: mmToPx(210),
      wMm: 297,
      hMm: 210
    };
  } else {
    return {
      wPx: mmToPx(210),
      hPx: mmToPx(297),
      wMm: 210,
      hMm: 297
    };
  }
}


// ==================================
// معاينة التقسيم
// ==================================

function redrawPreview() {
  if (!loadedImage) {
    // لا توجد صورة بعد
    previewCanvas.width = 400;
    previewCanvas.height = 300;
    const ctx = previewCanvas.getContext("2d");
    ctx.fillStyle = "#ddd";
    ctx.fillRect(0,0,previewCanvas.width,previewCanvas.height);
    infoBox.textContent = "حمّل صورة لعرض المعاينة.";
    return;
  }

  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;

  // تصغير الصورة للعرض فقط
  const maxPreviewW = 600;
  const scale = imgNaturalW > maxPreviewW ? (maxPreviewW / imgNaturalW) : 1;

  const dispW = imgNaturalW * scale;
  const dispH = imgNaturalH * scale;

  previewCanvas.width = dispW;
  previewCanvas.height = dispH;

  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0,0,dispW,dispH);

  ctx.drawImage(loadedImage, 0, 0, dispW, dispH);

  // رسم شبكة (تقريب لصفحات A4)
  const cellW = dispW / cols;
  const cellH = dispH / rows;

  ctx.strokeStyle = "rgba(255,0,0,0.6)";
  ctx.lineWidth = 1;

  // خطوط الأعمدة
  for (let c=1; c<cols; c++) {
    const x = c * cellW;
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,dispH);
    ctx.stroke();
  }

  // خطوط الصفوف
  for (let r=1; r<rows; r++) {
    const y = r * cellH;
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(dispW,y);
    ctx.stroke();
  }

  // معلومات الحجم النهائي على الحائط
  const {wCm,hCm} = getPosterPhysicalSizeCm();
  const totalPages = rows * cols;
  infoBox.textContent =
`عدد الصفحات: ${totalPages} ورقة A4
الحجم النهائي التقريبي على الحائط:
≈ ${wCm.toFixed(1)} سم × ${hCm.toFixed(1)} سم`;
}


// يحسب أبعاد البوستر النهائي بالسنتيمتر بعد التجميع
function getPosterPhysicalSizeCm() {
  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;
  const { wMm, hMm } = getA4SizePx(orientationSelect.value);

  const marginMm = parseFloat(marginInput.value) || 0;
  const usefulWmm = wMm - (marginMm * 2);
  const usefulHmm = hMm - (marginMm * 2);

  return {
    wCm: (usefulWmm * cols) / 10,
    hCm: (usefulHmm * rows) / 10
  };
}


// ==================================
// الاقتراحات الذكية (layout جاهز)
// ==================================

function buildSuggestions() {
  if (!loadedImage) {
    if (suggestionsList) {
      suggestionsList.innerHTML =
        `<div class="placeholderText">حمِّل صورة لرؤية الاقتراحات 👇</div>`;
    }
    if (refreshSuggestionsBtn) {
      refreshSuggestionsBtn.disabled = true;
    }
    return;
  }

  if (refreshSuggestionsBtn) {
    refreshSuggestionsBtn.disabled = false;
  }

  const orientation = orientationSelect.value;
  const { wPx:pageWpx, hPx:pageHpx, wMm, hMm } = getA4SizePx(orientation);

  const marginMmVal = parseFloat(marginInput.value) || 0;
  const marginPxVal = mmToPx(marginMmVal);

  // المساحة المفيدة داخل الورقة بعد الهامش
  const usefulWpx = pageWpx - marginPxVal * 2;
  const usefulHpx = pageHpx - marginPxVal * 2;
  const usefulWmm = wMm - marginMmVal * 2;
  const usefulHmm = hMm - marginMmVal * 2;

  const opts = [];

  // نجرّب شبكات من 2x2 حتى 8x8 ونقيّم الجودة
  for (let rows=2; rows<=8; rows++) {
    for (let cols=2; cols<=8; cols++) {
      const finalWpx = usefulWpx * cols;
      const finalHpx = usefulHpx * rows;

      // حجم التكبير المطلوب
      const scaleX = finalWpx / imgNaturalW;
      const scaleY = finalHpx / imgNaturalH;
      const scaleNeeded = Math.max(scaleX, scaleY); // أكبر تكبير

      let qualityClass = "";
      let qualityText = "";
      if (scaleNeeded <= 1.1) {
        qualityClass = "good";
        qualityText = "دقة ممتازة";
      } else if (scaleNeeded <= 2.0) {
        qualityClass = "ok";
        qualityText = "دقة جيدة";
      } else {
        qualityClass = "bad";
        qualityText = "قد تصبح مشوشة";
      }

      // الأبعاد التقريبية على الحائط
      const posterWcm = (usefulWmm * cols) / 10;
      const posterHcm = (usefulHmm * rows) / 10;

      // لا نقترح شكل غريب جداً مقارنة بنسبة الصورة
      const aspectPoster = posterWcm / posterHcm;
      const aspectImg = imgNaturalW / imgNaturalH;
      const aspectRatioDiff = Math.max(aspectPoster/aspectImg, aspectImg/aspectPoster);
      if (aspectRatioDiff > 2.5) {
        continue;
      }

      opts.push({
        rows,
        cols,
        pages: rows*cols,
        posterWcm,
        posterHcm,
        qualityClass,
        qualityText
      });
    }
  }

  // نرتب الاقتراحات: الأقل أوراق أولاً، ثم جودة أفضل
  opts.sort((a,b)=>{
    if (a.pages !== b.pages) return a.pages - b.pages;
    const rank = q => q.qualityClass === "good" ? 0 : q.qualityClass === "ok" ? 1 : 2;
    return rank(a) - rank(b);
  });

  const top = opts.slice(0,10);

  if (!suggestionsList) return;

  suggestionsList.innerHTML = "";

  if (top.length === 0) {
    suggestionsList.innerHTML =
      `<div class="placeholderText">لم أجد اقتراحات مناسبة لهذه الصورة بهذا الإعداد.</div>`;
    return;
  }

  top.forEach(opt => {
    const card = document.createElement("div");
    card.className = "suggestionCard";
    card.innerHTML = `
      <div class="suggestionLine1">
        <span class="suggestionMainSize">${opt.cols} × ${opt.rows} أوراق</span>
        <span>(${opt.pages} صفحة)</span>
        <span class="suggestionQuality ${opt.qualityClass}">${opt.qualityText}</span>
      </div>
      <div class="suggestionLine2">
        الحجم على الحائط ≈ ${opt.posterWcm.toFixed(1)}سم × ${opt.posterHcm.toFixed(1)}سم
      </div>
    `;

    // عند الضغط على الاقتراح، نحدّث الحقول ونرسم من جديد
    card.addEventListener("click", ()=>{
      colsInput.value = opt.cols;
      rowsInput.value = opt.rows;
      redrawPreview();
    });

    suggestionsList.appendChild(card);
  });
}


// ==================================
// تحميل الصورة من المستخدم
// ==================================

imageInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    loadedImage = img;
    imgNaturalW = img.naturalWidth;
    imgNaturalH = img.naturalHeight;

    generateBtn.disabled = false;
    if (refreshSuggestionsBtn) {
      refreshSuggestionsBtn.disabled = false;
    }

    redrawPreview();
    buildSuggestions();
  };
  img.src = url;
});

if (refreshSuggestionsBtn) {
  refreshSuggestionsBtn.addEventListener("click", ()=>{
    buildSuggestions();
  });
}

// أي تغيير في الإعدادات يعيد المعاينة والاقتراحات
[colsInput, rowsInput, marginInput, orientationSelect].forEach(el=>{
  el.addEventListener("input", ()=>{
    redrawPreview();
    buildSuggestions();
  });
});


// ==================================
// توليد PDF المقسّم (بدون نص على الصفحات، فقط الإطار)
// ==================================

generateBtn.addEventListener("click", () => {
  if (!loadedImage) return;

  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;
  const marginMm = parseFloat(marginInput.value) || 0;
  const orientation = orientationSelect.value;

  // --- خطوة 1: نضمن jsPDF موجود ---
  const jsPDFConstructor =
    (window.jspdf && window.jspdf.jsPDF)
      ? window.jspdf.jsPDF
      : (typeof jsPDF !== "undefined" ? jsPDF : null);

  if (!jsPDFConstructor) {
    alert("jsPDF غير محمّل. تأكد من وجود libs/jspdf.umd.min.js في المشروع.");
    return;
  }

  // --- خطوة 2: حساب أبعاد الورقة ---
  const { wPx:pageWpx, hPx:pageHpx, wMm:pageWmm, hMm:pageHmm } = getA4SizePx(orientation);

  const marginPx = mmToPx(marginMm);

  const usefulWpx = pageWpx - marginPx * 2;
  const usefulHpx = pageHpx - marginPx * 2;

  // حجم البوستر النهائي بعد التجميع
  const finalWpx = usefulWpx * cols;
  const finalHpx = usefulHpx * rows;

  // --- خطوة 3: نصنع Canvas نهائي بالحجم الكامل ---
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = finalWpx;
  finalCanvas.height = finalHpx;

  const fctx = finalCanvas.getContext("2d");
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(loadedImage, 0, 0, finalWpx, finalHpx);

  // --- خطوة 4: دالة قص جزء واحد (خانة/تايل) ---
  function getTileDataURL(colIndex, rowIndex) {
    const sx = colIndex * usefulWpx;
    const sy = rowIndex * usefulHpx;
    const sw = usefulWpx;
    const sh = usefulHpx;

    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = usefulWpx;
    tileCanvas.height = usefulHpx;
    const tctx = tileCanvas.getContext("2d");
    tctx.drawImage(finalCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return tileCanvas.toDataURL("image/jpeg", 0.95);
  }

  // --- خطوة 5: جهز ملف الـPDF ---
  const pdf = new jsPDFConstructor({
    orientation: (orientation === "landscape") ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // نرسم فقط إطار القص (بدون أي نص عربي أو لاتيني)
  function drawGuidesBoxOnly() {
    pdf.setDrawColor(150);
    pdf.setLineWidth(0.1);
    pdf.rect(
      marginMm,
      marginMm,
      pageWmm - marginMm*2,
      pageHmm - marginMm*2
    );
    pdf.stroke();
  }

  // --- خطوة 6: إضافة كل جزء على صفحة خاصة ---
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {

      // الصفحة الأولى موجودة تلقائياً. بعد ذلك نضيف صفحات جديدة.
      if (!(r===0 && c===0)) {
        pdf.addPage();
      }

      const dataURL = getTileDataURL(c, r);

      // ضع صورة الجزء داخل المساحة (بدون حواف الطابعة)
      pdf.addImage(
        dataURL,
        "JPEG",
        marginMm,
        marginMm,
        pageWmm - marginMm*2,
        pageHmm - marginMm*2
      );

      // أضف الإطار فقط
      drawGuidesBoxOnly();
    }
  }

  // --- خطوة 7: حفظ الملف ---
  pdf.save("poster.pdf");
});
