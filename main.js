// ملاحظات مهمة:
// - نفترض طباعة 300 DPI تقريباً؟ هذا عالي. للبوستر الجداري يكفي 150 DPI.
//   بنبدأ بـ 150 DPI عشان ما يصير PDF ضخم جداً.
// - A4 (مم): 210 x 297 عمودي. نحولها بالبكسل = (mm / 25.4 inch/mm) * DPI.

const DPI = 150; // دقة الطباعة المقترحة

const mmToPx = (mm) => (mm / 25.4) * DPI;

// مقاسات A4 حسب الاتجاه
function getA4SizePx(orientation) {
  if (orientation === "landscape") {
    return {
      wPx: mmToPx(297),
      hPx: mmToPx(210),
      wMm: 297,
      hMm: 210
    };
  } else {
    // portrait
    return {
      wPx: mmToPx(210),
      hPx: mmToPx(297),
      wMm: 210,
      hMm: 297
    };
  }
}

const imageInput = document.getElementById("imageInput");
const colsInput = document.getElementById("colsInput");
const rowsInput = document.getElementById("rowsInput");
const marginInput = document.getElementById("marginInput");
const labelMode = document.getElementById("labelMode");
const orientationSelect = document.getElementById("orientation");
const generateBtn = document.getElementById("generateBtn");
const previewCanvas = document.getElementById("previewCanvas");
const infoBox = document.getElementById("infoBox");

let loadedImage = null; // Image object
let imgNaturalW = 0;
let imgNaturalH = 0;

// تحميل الصورة
imageInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    loadedImage = img;
    imgNaturalW = img.naturalWidth;
    imgNaturalH = img.naturalHeight;

    redrawPreview();
    generateBtn.disabled = false;
  };
  img.src = url;
});

// ارسم المعاينة مع الشبكة
function redrawPreview() {
  if (!loadedImage) {
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

  // نخلي المعاينة تحتوي الصورة الأصلية بنسبة مصغرة
  const maxPreviewW = 600;
  const scale = imgNaturalW > maxPreviewW ? (maxPreviewW / imgNaturalW) : 1;

  const dispW = imgNaturalW * scale;
  const dispH = imgNaturalH * scale;

  previewCanvas.width = dispW;
  previewCanvas.height = dispH;

  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0,0,dispW,dispH);

  ctx.drawImage(loadedImage, 0, 0, dispW, dispH);

  // ارسم الشبكة (كم سيتم تقطيع الصورة)
  const cellW = dispW / cols;
  const cellH = dispH / rows;

  ctx.strokeStyle = "rgba(255,0,0,0.6)";
  ctx.lineWidth = 1;

  for (let c=1; c<cols; c++) {
    const x = c*cellW;
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,dispH);
    ctx.stroke();
  }
  for (let r=1; r<rows; r++) {
    const y = r*cellH;
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(dispW,y);
    ctx.stroke();
  }

  // معلومات أسفل المعاينة
  const {wMm,hMm} = getPosterPhysicalSizeMm();
  const totalPages = rows*cols;
  infoBox.textContent =
    `عدد الصفحات: ${totalPages} ورقة A4
الحجم النهائي التقريبي على الحائط:
≈ ${wMm.toFixed(1)} سم × ${hMm.toFixed(1)} سم`;
}

// احسب الأبعاد الفعلية للبوستر النهائي بالسنتيمتر
function getPosterPhysicalSizeMm() {
  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;
  const { wMm, hMm } = getA4SizePx(orientationSelect.value);

  // نطرح الهوامش؟ الفكرة: داخل الصفحة فيه هامش للطابعة.
  // الهامش marginInput بالـ mm، فالعرض المفيد = عرض الصفحة - (هامش يمين + هامش يسار)
  const marginMm = parseFloat(marginInput.value) || 0;
  const usefulWmm = wMm - (marginMm*2);
  const usefulHmm = hMm - (marginMm*2);

  return {
    wMm: (usefulWmm * cols) / 10, // سم
    hMm: (usefulHmm * rows) / 10  // سم
  };
}

// كل ما يغيّر المستخدم أي إعداد، نعيد المعاينة
[colsInput, rowsInput, marginInput, orientationSelect].forEach(el=>{
  el.addEventListener("input", redrawPreview);
});

// توليد الـ PDF
generateBtn.addEventListener("click", async () => {
  if (!loadedImage) return;

  const cols = parseInt(colsInput.value,10) || 1;
  const rows = parseInt(rowsInput.value,10) || 1;
  const marginMm = parseFloat(marginInput.value) || 0;
  const showLabel = (labelMode.value === "on");
  const orientation = orientationSelect.value;

  // مقاس صفحة A4 بالبكسل (على DPI اللي اخترناه)
  const { wPx:pageWpx, hPx:pageHpx, wMm:pageWmm, hMm:pageHmm } = getA4SizePx(orientation);

  // سنبني كانفاس كبير في الذاكرة يمثل البوستر النهائي
  // البوستر النهائي راح يكون بعرض = cols صفحات مفيدة
  // لكن انتبه: داخل كل صفحة فيه هامش, فلازم نعرف المساحة المفيدة للرسم.
  const marginPx = mmToPx(marginMm);

  const usefulWpx = pageWpx - marginPx*2;
  const usefulHpx = pageHpx - marginPx*2;

  const finalWpx = usefulWpx * cols;
  const finalHpx = usefulHpx * rows;

  // الآن نحتاج نكبر الصورة الأصلية لتملأ هذا الحجم النهائي
  // ننشئ كانفاس "finalCanvas" بالحجم النهائي
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = finalWpx;
  finalCanvas.height = finalHpx;

  const fctx = finalCanvas.getContext("2d");
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(loadedImage, 0, 0, finalWpx, finalHpx);

  // نجهز jsPDF
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: (orientation === "landscape") ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // helper: يحول canvas جزء صغير إلى dataURL
  function getTileDataURL(colIndex, rowIndex) {
    // نقتطع من finalCanvas الجزء المناسب
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

  // دالة لإضافة مربع النص (رمز القطعة) و علامات القص
  function drawGuides() {
    const ctx = pdf; // نسميه ctx للتسهيل لكن هو pdf

    // إطار قص خفيف
    ctx.setDrawColor(150);
    ctx.setLineWidth(0.1);

    // نرسم مستطيل حول المساحة المفيدة
    ctx.rect(
      marginMm,
      marginMm,
      pageWmm - marginMm*2,
      pageHmm - marginMm*2
    );
    ctx.stroke();

    // العلامة النصية
    if (showLabel) {
      ctx.setFontSize(10);
      ctx.setTextColor(0,0,0);

      // اسم الصف بالحروف: A,B,C...
      const rowLetter = String.fromCharCode("A".charCodeAt(0) + currentRow);
      const labelText = rowLetter + (currentCol+1);

      ctx.text(
        `جزء ${labelText} (صف ${currentRow+1} / عمود ${currentCol+1})`,
        marginMm + 2,
        marginMm + 5
      );

      // إرشادات التجميع البسيطة:
      // مثال: "ضعها يمين A1" ... بنعطي تلميح أفقي/رأسي
      let hint = "";
      if (currentCol > 0) hint += "الصق يسار جزء " + rowLetter + currentCol + "  ";
      if (currentCol < cols-1) hint += "الصق يمين جزء " + rowLetter + (currentCol+2) + "  ";
      if (currentRow > 0) hint += "الصق أعلى صف " + String.fromCharCode("A".charCodeAt(0)+currentRow-1) + (currentCol+1) + "  ";
      if (currentRow < rows-1) hint += "الصق أسفل صف " + String.fromCharCode("A".charCodeAt(0)+currentRow+1) + (currentCol+1);

      if (hint.trim().length>0){
        ctx.setFontSize(8);
        ctx.text(hint.trim(), marginMm + 2, marginMm + 10, {maxWidth: pageWmm - marginMm*2 - 4});
      }
    }
  }

  // حلقة توليد الصفحات
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {

      const currentRow = r;
      const currentCol = c;

      // لو مش أول صفحة لا تنس تضيف صفحة جديدة
      if (!(r===0 && c===0)) {
        pdf.addPage();
      }

      // جيب صورة الجزء الحالي
      const dataURL = getTileDataURL(c, r);

      // أضف الصورة في الـ PDF داخل المساحة المفيدة
      pdf.addImage(
        dataURL,
        "JPEG",
        marginMm,
        marginMm,
        pageWmm - marginMm*2,
        pageHmm - marginMm*2
      );

      // أضف الإرشادات/الإطار
      drawGuides();
    }
  }

  // حمّل الملف
  pdf.save("poster.pdf");
});
