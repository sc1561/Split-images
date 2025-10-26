// =====================
// إعدادات عامة
// =====================

const DPI = 150; // دقة مناسبة للبوستر الجداري - خفيفة على الطابعة ومقبولة من بعيد

const imageInput = document.getElementById("imageInput");
const colsInput = document.getElementById("colsInput");
const rowsInput = document.getElementById("rowsInput");
const marginInput = document.getElementById("marginInput");
const labelMode = document.getElementById("labelMode");
const orientationSelect = document.getElementById("orientation");
const generateBtn = document.getElementById("generateBtn");
const previewCanvas = document.getElementById("previewCanvas");
const infoBox = document.getElementById("infoBox");

const suggestionsList = document.getElementById("suggestionsList");
const refreshSuggestionsBtn = document.getElementById("refreshSuggestionsBtn");

let loadedImage = null;
let imgNaturalW = 0;
let imgNaturalH = 0;


// =====================
// دوال مساعدة
// =====================

const mmToPx = (mm) => (mm / 25.4) * DPI;

// مقاس A4 بالنسبة للدقة المختارة ودوران الورقة
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


// =====================
// معاينة الشبكة
// =====================

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

  // تصغير للعرض فقط
  const maxPreviewW = 600;
  const scale = imgNaturalW > maxPreviewW ? (maxPreviewW / imgNaturalW) : 1;

  const dispW = imgNaturalW * scale;
  const dispH = imgNaturalH * scale;

  previewCanvas.width = dispW;
  previewCanvas.height = dispH;

  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0,0,dispW,dispH);

  ctx.drawImage(loadedImage, 0, 0, dispW, dispH);

  // رسم مربعات التقسيم
  const cellW = dispW / cols;
  const cellH = dispH / rows;

  ctx.strokeStyle = "rgba(255,0,0,0.6)";
  ctx.lineWidth = 1;

  // خطوط الأعمدة
  for (let c=1; c<cols; c++) {
    const x = c*cellW;
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,dispH);
    ctx.stroke();
  }

  // خطوط الصفوف
  for (let r=1; r<rows; r++) {
    const y = r*cellH;
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(dispW,y);
    ctx.stroke();
  }

  // معلومات الحجم
  const {wCm,hCm} = getPosterPhysicalSizeCm();
  const totalPages = rows*cols;
  infoBox.textContent =
`عدد الصفحات: ${totalPages} ورقة A4
الحجم النهائي التقريبي على الحائط:
≈ ${wCm.toFixed(1)} سم × ${hCm.toFixed(1)} سم`;
}


// يحسب الحجم النهائي للبوستر بالسنتيمتر (بعد جمع كل الأوراق)
function getPosterPhysicalSizeCm() {
  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;
  const { wMm, hMm } = getA4SizePx(orientationSelect.value);

  const marginMm = parseFloat(marginInput.value) || 0;
  const usefulWmm = wMm - (marginMm*2);
  const usefulHmm = hMm - (marginMm*2);

  return {
    wCm: (usefulWmm * cols) / 10,
    hCm: (usefulHmm * rows) / 10
  };
}


// =====================
// الاقتراحات الذكية (شبكات جاهزة)
// =====================

function buildSuggestions() {
  if (!loadedImage) {
    // لو ما في صورة، اعرض نص فقط
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

  // المساحة الفعلية للرسم داخل كل صفحة بعد خصم الهامش
  const usefulWpx = pageWpx - marginPxVal*2;
  const usefulHpx = pageHpx - marginPxVal*2;
  const usefulWmm = wMm - marginMmVal*2;
  const usefulHmm = hMm - marginMmVal*2;

  const opts = [];

  // جرّب أحجام شبكات من 2 إلى 8
  for (let rows=2; rows<=8; rows++) {
    for (let cols=2; cols<=8; cols++) {

      const finalWpx = usefulWpx * cols;
      const finalHpx = usefulHpx * rows;

      // كم لازم نكبر الصورة الأصلية؟
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
        qualityText = "قد تكون الصورة مشوَّهة";
      }

      // الحجم المتوقع على الحائط بالسنتيمتر
      const posterWcm = (usefulWmm * cols) / 10;
      const posterHcm = (usefulHmm * rows) / 10;

      // فلتر: لا نقترح شكل ممدود وغريب جداً مقارنة بنسبة الصورة
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

  // ترتيب الاقتراحات: أقل أوراق أولاً، ثم جودة أفضل
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

    // عند الضغط على الاقتراح: نعكس القيم في الحقول
    card.addEventListener("click", ()=>{
      colsInput.value = opt.cols;
      rowsInput.value = opt.rows;
      redrawPreview();
    });

    suggestionsList.appendChild(card);
  });
}


// =====================
// تحميل الصورة من المستخدم
// =====================

imageInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    loadedImage = img;
    imgNaturalW = img.naturalWidth;
    imgNaturalH = img.naturalHeight;

    // فعّل الأزرار
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

// أي تغيير إعداد أساسي يعيد الرسم والاقتراحات
[colsInput, rowsInput, marginInput, orientationSelect].forEach(el=>{
  el.addEventListener("input", ()=>{
    redrawPreview();
    buildSuggestions();
  });
});


// =====================
// توليد ملف PDF المقسّم
// =====================

generateBtn.addEventListener("click", () => {
  if (!loadedImage) return;

  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;
  const marginMm = parseFloat(marginInput.value) || 0;
  const showLabel = (labelMode.value === "on");
  const orientation = orientationSelect.value;

  // 1. تأكد أن jsPDF موجود
  // بعض المتصفحات / بعض نسخ jsPDF تحتاج النداء بهذه الطريقة:
  //   const pdf = new window.jspdf.jsPDF(...)
  // فنحددها بأمان:
  const jsPDFConstructor =
    (window.jspdf && window.jspdf.jsPDF)
      ? window.jspdf.jsPDF
      : (typeof jsPDF !== "undefined" ? jsPDF : null);

  if (!jsPDFConstructor) {
    alert("jsPDF غير محمّل. تأكد من وجود libs/jspdf.umd.min.js قبل main.js");
    return;
  }

  // 2. احسب أبعاد الورقة
  const { wPx:pageWpx, hPx:pageHpx, wMm:pageWmm, hMm:pageHmm } = getA4SizePx(orientation);

  const marginPx = mmToPx(marginMm);

  const usefulWpx = pageWpx - marginPx*2;
  const usefulHpx = pageHpx - marginPx*2;

  const finalWpx = usefulWpx * cols;
  const finalHpx = usefulHpx * rows;

  // 3. أنشئ كانفاس نهائي بالحجم الكامل للبوستر
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = finalWpx;
  finalCanvas.height = finalHpx;

  const fctx = finalCanvas.getContext("2d");
  fctx.imageSmoothingQuality = "high";

  // كبّر الصورة الأصلية لتملأ الحجم النهائي
  fctx.drawImage(loadedImage, 0, 0, finalWpx, finalHpx);

  // 4. أداة لقص جزء محدد من الكانفاس النهائي
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

  // 5. جهّز الـPDF
  const pdf = new jsPDFConstructor({
    orientation: (orientation === "landscape") ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // رسم الإطار + التسمية على الصفحة
  function drawGuides(currentRow, currentCol, cols, rows) {
    // مستطيل القص
    pdf.setDrawColor(150);
    pdf.setLineWidth(0.1);

    pdf.rect(
      marginMm,
      marginMm,
      pageWmm - marginMm*2,
      pageHmm - marginMm*2
    );
    pdf.stroke();

    if (!showLabel) return;

    // اسم الجزء
    pdf.setFontSize(10);
    pdf.setTextColor(0,0,0);

    const rowLetter = String.fromCharCode("A".charCodeAt(0) + currentRow);
    const labelText = rowLetter + (currentCol+1);

    pdf.text(
      `جزء ${labelText} (صف ${currentRow+1} / عمود ${currentCol+1})`,
      marginMm + 2,
      marginMm + 5
    );

    // نص الإرشاد للجمع
    let hint = "";
    if (currentCol > 0) {
      hint += "الصق يسار " + rowLetter + currentCol + "  ";
    }
    if (currentCol < cols-1) {
      hint += "الصق يمين " + rowLetter + (currentCol+2) + "  ";
    }
    if (currentRow > 0) {
      hint += "الصق أعلى " + String.fromCharCode("A".charCodeAt(0)+currentRow-1) + (currentCol+1) + "  ";
    }
    if (currentRow < rows-1) {
      hint += "الصق أسفل " + String.fromCharCode("A".charCodeAt(0)+currentRow+1) + (currentCol+1);
    }

    if (hint.trim().length>0){
      pdf.setFontSize(8);
      pdf.text(
        hint.trim(),
        marginMm + 2,
        marginMm + 10,
        {maxWidth: pageWmm - marginMm*2 - 4}
      );
    }
  }

  // 6. املأ صفحات الـPDF، صفحة لكل قطعة
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {

      // الصفحات الجديدة بعد الأولى
      if (!(r===0 && c===0)) {
        pdf.addPage();
      }

      // صورة الجزء الحالي
      const dataURL = getTileDataURL(c, r);

      // ضع الصورة في المساحة المفيدة ضمن الصفحة
      pdf.addImage(
        dataURL,
        "JPEG",
        marginMm,
        marginMm,
        pageWmm - marginMm*2,
        pageHmm - marginMm*2
      );

      // أضف الإطار والشرح
      drawGuides(r, c, cols, rows);
    }
  }

  // 7. احفظ الملف
  pdf.save("poster.pdf");
});
