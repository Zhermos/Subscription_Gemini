// ==========================================
// การตั้งค่าระบบ Subscription (Minimal Setup)
// ==========================================

const CONFIG = {
    // 1. ข้อมูลบริการ Subscription
    serviceName: "Gemini Advanced",
    dueDay: 13, // กำหนดโอนก่อนวันที่ 13 ของทุกเดือน
    totalAmount: 189, // ยอดรวมต่อเดือน (บาท) (คนละ 63 บาท)

    // 2. บัญชีผู้รับเงิน
    receiver: {
        name: "นาย สิรภพ นารีรักษ์",
        promptpayType: "phone",
        promptpayNumber: "0973411447", // ใส่เบอร์พร้อมเพย์ (ตัวเลขล้วน)
        customQrImage: "scb-qr.png" // รูปมายคิวอาร์ SCB ที่แคปมา
    },

    // 3. รายชื่อสมาชิก
    members: [
        {
            id: "member-1",
            name: "ปุน",
            nickname: "ปุน",
        },
        {
            id: "member-2",
            name: "ธี",
            nickname: "ธี",
        },
        {
            id: "member-3",
            name: "พีท",
            nickname: "พีท",
        }
    ],

    // 4. URL Google Apps Script (เมื่อนำไปต่อหลังบ้าน)
    backendApiUrl: "https://script.google.com/macros/s/AKfycbwrYkm-Hp2CoW8uswG7WWs8MxnaG0SDW4tZpK7x6W4Ski7sPA6LspLkOx3uCxd96Rrf/exec",

    // 5. โหมดทดสอบ (เปิดไว้ทดสอบระบบสแกนสลิป)
    demoMode: false
};

// ยอดเงินที่ต้องโอนต่อคน (บาท)
CONFIG.amountPerPerson = 63;
