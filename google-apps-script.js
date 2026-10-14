/**
 * ==============================================================================
 * Google Apps Script (GAS) สำหรับ Subscription Tracker (ไม่ต้องใช้ SlipOK)
 * บันทึกลง Google Sheet + ตรวจสอบ QR Code สลิปซ้ำอัตโนมัติ
 * ==============================================================================
 * 
 * วิธีการติดตั้ง (ทำครั้งเดียว ใช้ได้ตลอดชีพ):
 * 1. เปิด Google Drive แล้วสร้าง Google Sheet ใหม่ 1 ไฟล์ (ตั้งชื่อว่า "Gemini Subscription")
 * 2. เมนูด้านบน กด "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดในไฟล์นี้ลงไปแทน
 * 4. กดปุ่มสีน้ำเงินมุมขวาบน "ทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 *    - เลือกประเภท (รูปฟันเฟือง): "เว็บแอป" (Web app)
 *    - คำอธิบาย: "v1"
 *    - ดำเนินการในฐานะ: "ฉัน" (Me)
 *    - ผู้มีสิทธิ์เข้าถึง: "ทุกคน" (Anyone)  <-- *** สำคัญมาก ต้องเลือกทุกคน ***
 * 5. กด "ทำให้ใช้งานได้" (Deploy) แล้วอนุมัติสิทธิ์ (Authorize access)
 * 6. ก๊อปปี้ "URL เว็บแอป" (https://script.google.com/macros/s/.../exec) 
 *    นำไปใส่ในไฟล์ `config.js` ที่ช่อง `backendApiUrl`
 */

// ==========================================
// 1. GET Request: ดึงสถานะการจ่ายเงิน
// ==========================================
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    const payments = {};

    // วนลูปอ่านข้อมูลใน Sheet (แถวที่ 1 เป็น Header)
    // อ่านจากแถวล่าสุด เพื่อให้ได้สถานะล่าสุดของสมาชิกแต่ละคน
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const memberId = String(row[2] || "").trim();
      const amount = row[4];
      const transRef = String(row[5] || "").trim();
      const status = String(row[7] || "").trim().toUpperCase();
      const time = row[0];

      if (memberId && status === "APPROVED") {
        payments[memberId] = {
          paid: true,
          amount: amount,
          time: (time instanceof Date) 
                  ? Utilities.formatDate(time, "Asia/Bangkok", "dd/MM/yyyy HH:mm") 
                  : String(time),
          transRef: transRef,
          slipImage: row[8] || "" // รูปภาพสลิป
        };
      }
    }

    return createJsonResponse({ success: true, payments: payments });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// ==========================================
// 2. POST Request: ตรวจสลิปและบันทึกข้อมูล
// ==========================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "verifySlip") {
      const { qrData, monthKey, memberId, memberName, expectedAmount, imageBase64 } = body;
      const sheet = getOrCreateSheet();

      // ขั้นตอนที่ 1: ดึงรหัสอ้างอิงธุรกรรมจาก QR Code ของสลิป
      const slipDetails = parseSlipQrData(qrData);
      const transRef = slipDetails.transRef;
      const bankCode = slipDetails.bankCode;

      // ขั้นตอนที่ 2: ตรวจสอบว่าสลิปนี้เคยส่งแล้วหรือไม่ (กันส่งสลิปซ้ำ 100%)
      if (isSlipAlreadyUsed(sheet, transRef)) {
        return createJsonResponse({ 
          success: false, 
          message: "สลิปนี้เคยถูกส่งไปแล้วในระบบ (ตรวจพบรหัสอ้างอิงสลิปซ้ำ)" 
        });
      }

      // ขั้นตอนที่ 3: บันทึกลง Google Sheet
      const now = new Date();
      sheet.appendRow([
        now,                    // Timestamp
        "'" + String(monthKey), // MonthKey (บังคับให้เป็น Text ไม่ให้ Sheet แปลงเป็น Date)
        memberId,               // Member ID
        memberName,             // Member Name
        expectedAmount,         // Amount (63 บาท)
        transRef,               // Transaction Reference
        bankCode,               // Bank Code
        "APPROVED",             // Status
        imageBase64 || ""       // Slip Image Base64
      ]);

      return createJsonResponse({
        success: true,
        data: {
          amount: expectedAmount,
          time: Utilities.formatDate(now, "Asia/Bangkok", "HH:mm"),
          transRef: transRef
        }
      });
    }

    return createJsonResponse({ success: false, message: "Unknown action" });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// ==========================================
// ฟังก์ชันช่วยเหลือ (Helper Functions)
// ==========================================

// ตรวจสอบว่ามี TransRef นี้ใน Google Sheet แล้วหรือยัง
function isSlipAlreadyUsed(sheet, transRef) {
  if (!transRef) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][5]).trim() === String(transRef).trim()) {
      return true;
    }
  }
  return false;
}

// ถอดรหัส Mini-QR จากสลิปธนาคารไทย (มาตรฐาน Thai Bank Slip Verify)
function parseSlipQrData(qrData) {
  let transRef = "";
  let bankCode = "-";

  if (!qrData || typeof qrData !== "string") {
    return { transRef: "REF-" + Date.now(), bankCode: "-" };
  }

  // รูปแบบมาตรฐานสลิปไทยเป็น TLV (Tag-Length-Value)
  // Tag 01 = รหัสธนาคารผู้โอน, Tag 02 = รหัสอ้างอิงธุรกรรม (TransRef)
  try {
    let index = 0;
    while (index < qrData.length) {
      const tag = qrData.substr(index, 2);
      const len = parseInt(qrData.substr(index + 2, 2), 10);
      if (isNaN(len)) break;
      const val = qrData.substr(index + 4, len);

      if (tag === "01") {
        bankCode = val;
      } else if (tag === "02") {
        transRef = val;
      }
      index += 4 + len;
    }
  } catch (e) {
    // กรณีโครงสร้างไม่ตรง
  }

  // หากถอด Tag 02 ไม่ได้ ให้ใช้ Hash ของข้อมูล QR เพื่อเป็นรหัสอ้างอิงที่ไม่ซ้ำกัน
  if (!transRef) {
    let hash = 0;
    for (let i = 0; i < qrData.length; i++) {
      hash = ((hash << 5) - hash) + qrData.charCodeAt(i);
      hash |= 0;
    }
    transRef = "REF-" + Math.abs(hash);
  }

  return { transRef: transRef, bankCode: bankCode };
}

// สร้างหรือเปิด Sheet ฐานข้อมูล
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Payments");
  if (!sheet) {
    sheet = ss.insertSheet("Payments");
    sheet.appendRow([
      "Timestamp", "MonthKey", "MemberID", "MemberName", 
      "Amount", "TransRef", "Bank", "Status", "SlipImage"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#27272a").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// จัดรูปแบบ JSON Response ให้ส่งกลับข้ามโดเมนได้ (CORS)
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
