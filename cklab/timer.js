/* timer.js (ฉบับแก้ไขรวม Logic: นับเวลาปกติ และ นับถอยหลัง Slot) */

document.addEventListener('DOMContentLoaded', () => {
    // 1. ดึงข้อมูล Session
    const session = DB.getSession();

    // ถ้าไม่มี Session (เช่น เปิดไฟล์นี้ตรงๆ โดยไม่ผ่านหน้าแรก) ให้ดีดกลับ
    if (!session || !session.startTime) {
        alert('ไม่พบข้อมูลการใช้งาน กรุณาลงชื่อเข้าใช้ใหม่');
        window.location.href = 'index.html';
        return;
    }

    // 2. แสดงข้อมูลบนหน้าจอ
    const userName = session.user ? session.user.name : 'ผู้ใช้ไม่ระบุชื่อ';
    document.getElementById('userNameDisplay').innerText = userName;
    
    // แสดงเลขเครื่อง (เช่น PC-01)
    const pcIdDisplay = session.pcId ? session.pcId.toString().padStart(2,'0') : '??';
    document.getElementById('pcNameDisplay').innerText = `Station: PC-${pcIdDisplay}`;
    
    // 3. ตัดสินใจว่าจะใช้ระบบจับเวลาแบบไหน
    // ถ้ามี forceEndTime (เครื่อง AI ที่มีรอบเวลา) ให้ใช้นับถอยหลัง
    if (session.forceEndTime) {
        console.log("Mode: Countdown (Slot-based)");
        updateCountdownSlot(); // รันครั้งแรกทันที
        setInterval(updateCountdownSlot, 1000);
    } else {
        // ถ้าไม่มี forceEndTime (เครื่องทั่วไป) ให้ใช้นับเวลาเดินหน้า
        console.log("Mode: Normal Timer");
        updateTimer(); // รันครั้งแรกทันที
        setInterval(updateTimer, 1000);
    }
});

// --- ฟังก์ชัน 1: นับเวลาเดินหน้า (สำหรับเครื่องทั่วไป) ---
function updateTimer() {
    const session = DB.getSession(); // ดึง session ล่าสุด
    if (!session) return;

    const now = Date.now();
    const diff = now - session.startTime; // เวลาปัจจุบัน - เวลาเริ่ม

    // แปลงเป็น ชั่วโมง:นาที:วินาที
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');

    document.getElementById('timerDisplay').innerText = `${h}:${m}:${s}`;
    
    // (Optional) ตรวจสอบเวลาเกินกำหนด General Config ได้ที่นี่ถ้าต้องการ
}

// --- ฟังก์ชัน 2: นับถอยหลัง (สำหรับเครื่อง AI/Slot) ---
function updateCountdownSlot() {
    const session = DB.getSession();
    if (!session) return;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const currentSecs = now.getSeconds();
    
    // session.forceEndTime คือนาทีจบของ Slot (เช่น 10:30 = 630 นาที)
    const endMins = session.forceEndTime; 
    
    // เวลาปัจจุบันในหน่วยนาทีรวมทศนิยม (เพื่อความละเอียดวินาที)
    const nowTotalMins = currentMins + (currentSecs / 60);
    let remainingMins = endMins - nowTotalMins;

    if (remainingMins <= 0) {
        // 🚨 หมดเวลา! บังคับออก
        document.getElementById('timerDisplay').innerText = "00:00:00";
        alert("หมดเวลาใช้งานในรอบนี้แล้ว ระบบจะทำการ Check-out");
        doCheckout(true); // ส่ง true ไปบอกว่าเป็น Auto Checkout (ถ้าต้องการแยก Logic)
        return;
    }

    // แปลงเวลาที่เหลือเป็น ชม:นาที:วินาที เพื่อแสดงผล
    const h = Math.floor(remainingMins / 60).toString().padStart(2, '0');
    const m = Math.floor(remainingMins % 60).toString().padStart(2, '0');
    const s = Math.floor((remainingMins * 60) % 60).toString().padStart(2, '0');

    const timerDisplay = document.getElementById('timerDisplay');
    timerDisplay.innerText = `เหลือเวลา ${h}:${m}:${s}`;
    timerDisplay.style.color = 'red'; // เปลี่ยนสีตัวอักษรให้รู้ว่านับถอยหลัง
}

// --- ฟังก์ชัน Check-out (ปกติ) ---
function doCheckout(isAuto = false) {
    // ถ้าไม่ใช่ Auto (ผู้ใช้กดเอง) ให้ถามยืนยันก่อน
    if (!isAuto && !confirm('คุณต้องการเลิกใช้งานและออกจากระบบใช่หรือไม่?')) {
        return;
    }

    // 1. คำนวณระยะเวลาใช้งานที่ผ่านมา
    const session = DB.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const endTime = Date.now();
    const durationMilliseconds = endTime - session.startTime;
    const durationMinutes = Math.round(durationMilliseconds / 60000); 

    // 2. บันทึกระยะเวลาลงใน Session ชั่วคราว ก่อนส่งไปหน้า Feedback
    session.durationMinutes = durationMinutes; // อัปเดตลง object ก่อนบันทึก
    DB.setSession(session);
    
    // 3. ไปหน้าประเมินความพึงพอใจ (Feedback)
    window.location.href = 'feedback.html';
}

// --- ฟังก์ชัน Force Logout (ฉุกเฉิน/ไม่เอา Feedback) ---
function forceLogout() {
    const session = DB.getSession(); 
    
    if (!session) return;
    
    // 1. Log END_SESSION (แต่ไม่มีคะแนนความพึงพอใจ)
    DB.saveLog({
        action: 'Force Check-out',
        userId: session.user.id || 'N/A',
        userName: session.user.name || 'N/A',
        pcId: session.pcId,
        startTime: new Date(session.startTime).toISOString(),
        timestamp: new Date().toISOString(),
        durationMinutes: 0, 
        satisfactionScore: 'N/A',
    });

    // 2. อัปเดตสถานะ PC กลับเป็น 'available'
    DB.updatePCStatus(session.pcId, 'available', null);

    // 3. ล้าง Session และกลับไปหน้า Check-in
    DB.clearSession();
    alert("❌ ระบบทำการล็อคเอาท์ฉุกเฉินแล้ว");
    window.location.href = 'index.html';
}