// ========================================================
// Subscription Manager Client Logic (Minimal & Clean)
// ========================================================

let state = {
    selectedMemberId: null,
    currentMonthKey: "",
    payments: {},
    isProcessing: false
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initMonthAndDates();
    renderStaticConfig();
    renderMembers();
    renderMemberSelectButtons();
    setupDropzoneAndEvents();
    loadPaymentsData();

    if (CONFIG.members.length > 0) {
        selectMember(CONFIG.members[0].id);
    }
});

// 1. Month and Date formatting
function initMonthAndDates() {
    const now = new Date();
    const thaiMonths = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const monthName = thaiMonths[now.getMonth()];
    const thaiYear = now.getFullYear() + 543;
    
    state.currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const monthEl = document.getElementById("currentMonthYear");
    if (monthEl) {
        monthEl.textContent = `${monthName} ${thaiYear}`;
    }
}

// 2. Render static elements
function renderStaticConfig() {
    document.getElementById("headerServiceTag").textContent = CONFIG.serviceName;
    document.getElementById("totalAmountText").textContent = Number(CONFIG.totalAmount).toLocaleString();
    document.getElementById("qrPayAmount").textContent = Number(CONFIG.amountPerPerson).toLocaleString();
    document.getElementById("receiverNameText").textContent = CONFIG.receiver.name;
    document.getElementById("receiverNumberText").textContent = formatPhoneNumber(CONFIG.receiver.promptpayNumber);

    // Due Date Notice
    const dueDay = CONFIG.dueDay || 13;
    const headerDueEl = document.getElementById("dueDateHeaderBadge");
    if (headerDueEl) {
        headerDueEl.textContent = `โอนก่อนวันที่ ${dueDay}`;
    }
    const dueNoticeEl = document.getElementById("dueDayNoticeText");
    if (dueNoticeEl) {
        dueNoticeEl.textContent = dueDay;
    }

    const demoEl = document.getElementById("demoModeIndicator");
    if (!CONFIG.backendApiUrl && CONFIG.demoMode) {
        demoEl.textContent = "Demo Mode · พร้อมทดสอบการสแกนสลิป";
    } else {
        demoEl.textContent = "ระบบเชื่อมต่อกับฐานข้อมูลอัตโนมัติ";
    }

    // Copy PromptPay Number
    document.getElementById("copyNumberBtn").addEventListener("click", () => {
        navigator.clipboard.writeText(CONFIG.receiver.promptpayNumber);
        const originalText = document.getElementById("copyNumberBtn").textContent;
        document.getElementById("copyNumberBtn").textContent = "คัดลอกแล้ว";
        setTimeout(() => {
            document.getElementById("copyNumberBtn").textContent = originalText;
        }, 1500);
    });

    // Refresh button
    document.getElementById("refreshBtn").addEventListener("click", () => {
        const icon = document.getElementById("refreshIcon");
        icon.classList.add("animate-spin");
        loadPaymentsData().finally(() => {
            setTimeout(() => icon.classList.remove("animate-spin"), 500);
        });
    });

    // Modal Close
    document.getElementById("closeSlipModal").addEventListener("click", () => {
        document.getElementById("slipModal").classList.add("hidden");
    });
}

// 3. Render Member Cards (Compact 3-in-a-row)
function renderMembers() {
    const container = document.getElementById("membersContainer");
    container.innerHTML = "";

    let paidCount = 0;

    CONFIG.members.forEach(member => {
        const payment = state.payments[member.id];
        const isPaid = payment && payment.paid;
        const isSelected = state.selectedMemberId === member.id;
        if (isPaid) paidCount++;

        const card = document.createElement("div");
        card.className = `minimal-card rounded-lg p-2.5 sm:p-3 flex flex-col justify-between transition-all ${
            isPaid
                ? "border-zinc-700/60 bg-zinc-900/30"
                : isSelected
                    ? "border-zinc-500 bg-zinc-800/40"
                    : "border-zinc-800/80 hover:border-zinc-700 cursor-pointer"
        }`;

        card.innerHTML = `
            <div class="flex items-center justify-between gap-1 mb-2">
                <span class="text-xs sm:text-sm font-semibold text-white truncate">${member.nickname}</span>
                ${
                    isPaid
                        ? `<span class="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium shrink-0">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            จ่ายแล้ว
                           </span>`
                        : `<span class="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-medium shrink-0">
                            <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                            ยังไม่จ่าย
                           </span>`
                }
            </div>

            <div class="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 text-[11px]">
                <span class="text-zinc-500 text-[10px] sm:text-[11px]">${member.amount || CONFIG.amountPerPerson} บ.</span>
                ${
                    isPaid
                        ? `<button onclick="event.stopPropagation(); viewSlip('${member.id}')" class="text-[10px] sm:text-[11px] text-zinc-400 hover:text-white underline">
                            ดูสลิป
                           </button>`
                        : `<button onclick="event.stopPropagation(); selectMember('${member.id}')" class="text-[10px] sm:text-[11px] text-zinc-300 hover:text-white px-2 py-0.5 rounded border border-zinc-700 hover:border-zinc-500 transition-colors">
                            เลือก
                           </button>`
                }
            </div>
        `;

        if (!isPaid) {
            card.onclick = () => selectMember(member.id);
        }

        container.appendChild(card);
    });

    // Update Overall Badge
    document.getElementById("paymentProgressText").textContent = `${paidCount} / ${CONFIG.members.length}`;
    const overallBadge = document.getElementById("statusBadgeOverall");
    if (paidCount === CONFIG.members.length) {
        overallBadge.className = "w-2 h-2 rounded-full bg-emerald-500";
    } else {
        overallBadge.className = "w-2 h-2 rounded-full bg-amber-500";
    }

    lucide.createIcons();
}

// 4. Render Segmented Member Selector
function renderMemberSelectButtons() {
    const container = document.getElementById("memberSelectButtons");
    container.innerHTML = "";

    CONFIG.members.forEach(member => {
        const btn = document.createElement("button");
        btn.id = `select-btn-${member.id}`;
        btn.type = "button";
        btn.onclick = () => selectMember(member.id);

        const isSelected = state.selectedMemberId === member.id;
        btn.className = `py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            isSelected
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
        }`;

        btn.textContent = member.nickname;
        container.appendChild(btn);
    });
}

function selectMember(memberId) {
    state.selectedMemberId = memberId;
    const member = CONFIG.members.find(m => m.id === memberId);
    const amount = member ? (member.amount || CONFIG.amountPerPerson) : CONFIG.amountPerPerson;

    // Update payment amount text
    const amountEl = document.getElementById("qrPayAmount");
    if (amountEl) {
        amountEl.textContent = Number(amount).toLocaleString();
    }

    renderMembers();
    renderMemberSelectButtons();
    generatePromptPayQr(CONFIG.receiver.promptpayNumber, amount);
}

// 5. PromptPay / SCB My QR Code Display
function generatePromptPayQr(target, amount) {
    const qrContainer = document.getElementById("promptpayQrCode");
    qrContainer.innerHTML = "";

    // หากมีการระบุรูปภาพ My QR (เช่น รูปจาก SCB EASY) ให้แสดงรูปนั้นโดยตรง
    if (CONFIG.receiver.customQrImage && CONFIG.receiver.customQrImage.trim() !== "") {
        const img = document.createElement("img");
        img.src = CONFIG.receiver.customQrImage;
        img.alt = "SCB My QR";
        img.className = "w-full max-w-[150px] h-auto object-contain rounded";
        qrContainer.appendChild(img);
        return;
    }

    // กรณีไม่มีรูป: สร้าง QR พร้อมเพย์มาตรฐานอัตโนมัติ
    const payload = buildPromptPayPayload(target, amount);

    new QRCode(qrContainer, {
        text: payload,
        width: 128,
        height: 128,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });
}

function buildPromptPayPayload(target, amount) {
    const cleanTarget = target.replace(/[^0-9]/g, "");
    let targetType = "01";
    let formattedTarget = cleanTarget;

    if (cleanTarget.length === 10) {
        targetType = "01";
        formattedTarget = "0066" + cleanTarget.substring(1);
    } else if (cleanTarget.length === 13) {
        targetType = "02";
        formattedTarget = cleanTarget;
    }

    const f = (tag, val) => tag + String(val.length).padStart(2, "0") + val;

    const aid = f("00", "A000000677010111");
    const recipient = f(targetType, formattedTarget);
    const tag29 = f("29", aid + recipient);

    const tag00 = f("00", "01");
    const tag01 = f("01", amount ? "12" : "11");
    const tag53 = f("53", "764");
    const tag54 = amount ? f("54", Number(amount).toFixed(2)) : "";
    const tag58 = f("58", "TH");

    const rawPayload = tag00 + tag01 + tag29 + tag53 + tag54 + tag58 + "6304";
    const crc = computeCrc16(rawPayload);

    return rawPayload + crc;
}

function computeCrc16(data) {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function formatPhoneNumber(num) {
    const clean = num.replace(/[^0-9]/g, "");
    if (clean.length === 10) {
        return clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    }
    return clean;
}

// 6. Setup Drag & Drop, File Upload, and Clipboard Paste
function setupDropzoneAndEvents() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("slipFileInput");

    dropzone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            processSlipImageFile(e.target.files[0]);
        }
    });

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("border-zinc-400", "bg-zinc-800/40");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("border-zinc-400", "bg-zinc-800/40");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-zinc-400", "bg-zinc-800/40");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processSlipImageFile(e.dataTransfer.files[0]);
        }
    });

    // Clipboard Paste (Ctrl + V)
    window.addEventListener("paste", (e) => {
        const items = e.clipboardData ? e.clipboardData.items : [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                processSlipImageFile(blob);
                break;
            }
        }
    });
}

// 7. Process & Scan Slip Image with jsQR
function processSlipImageFile(file) {
    if (state.isProcessing) return;
    state.isProcessing = true;

    hideStatusBoxes();
    showVerifyStep("กำลังอ่านไฟล์...", "กำลังประมวลผลความละเอียดภาพ");

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageBase64 = e.target.result;
        const img = new Image();
        img.onload = () => {
            scanQrFromImage(img, imageBase64);
        };
        img.onerror = () => {
            showError("ไม่สามารถเปิดไฟล์รูปได้", "โปรดตรวจสอบไฟล์รูปสลิปอีกครั้ง");
            state.isProcessing = false;
        };
        img.src = imageBase64;
    };
    reader.readAsDataURL(file);
}

function scanQrFromImage(img, imageBase64) {
    showVerifyStep("กำลังสแกนหา QR Code...", "ตรวจสอบความถูกต้องของสลิป");

    const canvas = document.getElementById("qrScanCanvas");
    const ctx = canvas.getContext("2d");

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const maxDim = 1600;

    if (width > maxDim || height > maxDim) {
        if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
        } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
        }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    
    let code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
    });

    if (!code) {
        code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
        });
    }

    if (!code || !code.data) {
        showError(
            "ไม่พบ QR Code ในสลิป",
            "โปรดตรวจสอบว่ารูปสลิปมี QR Code ครบถ้วนและไม่เบลอ"
        );
        state.isProcessing = false;
        return;
    }

    verifySlipData(code.data, imageBase64);
}

// 8. Auto-Verify Slip
async function verifySlipData(qrData, imageBase64) {
    showVerifyStep(
        "กำลังตรวจสอบกับระบบ...",
        "ตรวจสอบยอดเงิน บัญชี และประวัติการโอน"
    );

    const selectedMember = CONFIG.members.find(m => m.id === state.selectedMemberId);
    const memberName = selectedMember ? selectedMember.name : "สมาชิก";

    // A. Backend API Call
    if (CONFIG.backendApiUrl && CONFIG.backendApiUrl.trim() !== "") {
        try {
            const memberExpectedAmount = selectedMember ? (selectedMember.amount || CONFIG.amountPerPerson) : CONFIG.amountPerPerson;

            const response = await fetch(CONFIG.backendApiUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "verifySlip",
                    qrData: qrData,
                    monthKey: state.currentMonthKey,
                    memberId: state.selectedMemberId,
                    memberName: memberName,
                    expectedAmount: memberExpectedAmount,
                    imageBase64: imageBase64
                })
            });

            const result = await response.json();

            if (!result.success) {
                showError("ตรวจสอบไม่ผ่าน", result.message || "ข้อมูลสลิปไม่ตรงตามเงื่อนไข");
                state.isProcessing = false;
                return;
            }

            handleVerificationSuccess({
                memberId: state.selectedMemberId,
                amount: result.data.amount || memberExpectedAmount,
                time: result.data.time || new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
                transRef: result.data.transRef || "REF-" + Date.now(),
                slipImage: imageBase64
            });

        } catch (err) {
            console.error("API Error:", err);
            showError("เกิดข้อผิดพลาดในการเชื่อมต่อ", "ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้");
            state.isProcessing = false;
        }
        return;
    }

    // B. Demo Mode
    if (CONFIG.demoMode) {
        setTimeout(() => {
            const usedSlips = JSON.parse(localStorage.getItem("used_slip_refs") || "[]");
            const dummyRef = "REF-" + Math.abs(hashCode(qrData));

            if (usedSlips.includes(dummyRef)) {
                showError("สลิปนี้เคยถูกส่งไปแล้ว", "ไม่สามารถส่งสลิปเดิมซ้ำได้");
                state.isProcessing = false;
                return;
            }

            usedSlips.push(dummyRef);
            localStorage.setItem("used_slip_refs", JSON.stringify(usedSlips));

            handleVerificationSuccess({
                memberId: state.selectedMemberId,
                amount: selectedMember ? (selectedMember.amount || CONFIG.amountPerPerson) : CONFIG.amountPerPerson,
                time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
                transRef: dummyRef,
                slipImage: imageBase64
            });
        }, 1000);
    }
}

// 9. Handle Success
function handleVerificationSuccess(paymentInfo) {
    state.payments[paymentInfo.memberId] = {
        paid: true,
        amount: paymentInfo.amount,
        time: paymentInfo.time,
        transRef: paymentInfo.transRef,
        slipImage: paymentInfo.slipImage
    };

    savePaymentsToLocalStorage();
    renderMembers();

    document.getElementById("verifyStatusBox").classList.add("hidden");
    const successBox = document.getElementById("verifySuccessBox");
    successBox.classList.remove("hidden");
    document.getElementById("verifySuccessDesc").textContent = 
        `ตรวจสอบยอด ${paymentInfo.amount} บาท ถูกต้อง บันทึกสถานะเรียบร้อย`;

    state.isProcessing = false;
}

// 10. Load / Save Payments Data
async function loadPaymentsData() {
    if (CONFIG.backendApiUrl && CONFIG.backendApiUrl.trim() !== "") {
        try {
            const url = `${CONFIG.backendApiUrl}?action=getPayments&monthKey=${state.currentMonthKey}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success && data.payments) {
                state.payments = data.payments;
                renderMembers();
                return;
            }
        } catch (e) {
            console.warn("Could not fetch remote payments:", e);
        }
    }

    const localKey = `sub_payments_${state.currentMonthKey}`;
    const saved = localStorage.getItem(localKey);
    if (saved) {
        try {
            state.payments = JSON.parse(saved);
        } catch (e) {
            state.payments = {};
        }
    }
    renderMembers();
}

function savePaymentsToLocalStorage() {
    const localKey = `sub_payments_${state.currentMonthKey}`;
    localStorage.setItem(localKey, JSON.stringify(state.payments));
}

// 11. Modal: View Slip
window.viewSlip = function(memberId) {
    const payment = state.payments[memberId];
    if (!payment || !payment.slipImage) return;

    const modal = document.getElementById("slipModal");
    const img = document.getElementById("modalSlipImage");
    const meta = document.getElementById("modalSlipMeta");

    img.src = payment.slipImage;
    meta.innerHTML = `
        <div class="flex justify-between py-1 border-b border-zinc-800">
            <span class="text-zinc-500">รหัสอ้างอิง</span>
            <span class="text-zinc-300 font-mono">${payment.transRef || "-"}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-zinc-800">
            <span class="text-zinc-500">ยอดเงิน</span>
            <span class="text-zinc-200 font-medium">${payment.amount} บาท</span>
        </div>
        <div class="flex justify-between py-1">
            <span class="text-zinc-500">เวลาที่บันทึก</span>
            <span class="text-zinc-400">${payment.time || "-"}</span>
        </div>
    `;

    modal.classList.remove("hidden");
};

// UI Status Helpers
function showVerifyStep(title, desc) {
    const box = document.getElementById("verifyStatusBox");
    box.classList.remove("hidden");
    document.getElementById("verifyStepTitle").textContent = title;
    document.getElementById("verifyStepDesc").textContent = desc;
}

function showError(title, desc) {
    hideStatusBoxes();
    const box = document.getElementById("verifyErrorBox");
    box.classList.remove("hidden");
    document.getElementById("verifyErrorTitle").textContent = title;
    document.getElementById("verifyErrorDesc").textContent = desc;
}

function hideStatusBoxes() {
    document.getElementById("verifyStatusBox").classList.add("hidden");
    document.getElementById("verifyErrorBox").classList.add("hidden");
    document.getElementById("verifySuccessBox").classList.add("hidden");
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}
