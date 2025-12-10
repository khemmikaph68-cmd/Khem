/* auth.js */

let scannedPcId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. ตรวจสอบว่ามี QR Code param มาหรือไม่? (เช่น index.html?pc=1)
    const urlParams = new URLSearchParams(window.location.search);
    const pcParam = urlParams.get('pc');

    if (pcParam) {
        scannedPcId = pcParam;
        // แสดงสถานะว่าสแกนแล้ว
        const qrStatus = document.getElementById('qrStatus');
        const scanPcId = document.getElementById('scanPcId');
        if (qrStatus && scanPcId) {
            qrStatus.classList.remove('d-none');
            scanPcId.innerText = `PC-${pcParam.padStart(2, '0')}`;
        }
        
        // *สำคัญ* เช็คสถานะเครื่องจาก DB ว่าเครื่องนี้ว่างไหม
        const pcs = DB.getPCs();
        const targetPC = pcs.find(p => p.id == pcParam);
        if (targetPC && targetPC.status === 'in_use') {
            alert('⚠️ เครื่องนี้กำลังถูกใช้งานอยู่ กรุณาติดต่อเจ้าหน้าที่');
        }
    }
    
    // Auto clear session เก่าเมื่อกลับมาหน้าแรก
    DB.clearSession();
});

// ฟังก์ชันสลับแท็บ
function switchTab(type) {
    document.getElementById('tab-internal').classList.toggle('active', type === 'internal');
    document.getElementById('tab-external').classList.toggle('active', type === 'external');
    document.getElementById('formInternal').style.display = (type === 'internal') ? 'block' : 'none';
    document.getElementById('formExternal').style.display = (type === 'external') ? 'block' : 'none';
}

// Helper: ดึงประเภทการใช้งาน (Walk-in / Booking)
function getUsageType() {
    if(document.getElementById('typeWalkin').checked) return 'walk-in';
    if(document.getElementById('typeBooking').checked) return 'booking';
    return 'walk-in';
}

// Login: Internal
function loginInternal() {
    const id = document.getElementById('intId').value.trim();
    if (!id) return alert("กรุณากรอกรหัสนักศึกษา/UBU WiFi");

    // จำลองเรียก External System (REG API)
    const regData = DB.checkUser(id); 

    if (regData) {
        const usageType = getUsageType();
        
        // สร้าง User Object
        const userObj = {
            id: id,
            name: `${regData.title}${regData.name}`,
            faculty: regData.faculty,
            userType: 'internal',
            role: regData.type, // Student/Staff
            usageType: usageType
        };

        proceedNext(userObj);
    } else {
        alert("ไม่พบข้อมูลในระบบ REG API (Hint: ลองใช้ 66123456)");
    }
}

// Login: External
function loginExternal() {
    const card = document.getElementById('extCard').value.trim();
    const name = document.getElementById('extName').value.trim();
    const org = document.getElementById('extOrg').value.trim();

    if (!card || !name || !org) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");

    const usageType = getUsageType();

    const userObj = {
        id: card,
        name: name,
        faculty: org, // ใช้ field faculty เก็บหน่วยงานแทน
        userType: 'external',
        role: 'guest',
        usageType: usageType
    };

    proceedNext(userObj);
}

// ฟังก์ชันไปหน้าถัดไป (ตัดสินใจว่าจะไป Map หรือ Confirm)
function proceedNext(userObj) {
    // 1. บันทึก User ลง Session
    // ถ้าสแกน QR มา ให้บันทึก pcId ลง Session เลย
    let sessionData = { user: userObj };
    if (scannedPcId) {
        sessionData.pcId = scannedPcId;
    }

    DB.setSession(sessionData);

    // 2. ตัดสินใจ Routing
    if (scannedPcId) {
        // Case A: สแกน QR Code มา -> ข้ามไปหน้า Confirm เลย
        window.location.href = 'confirm.html';
    } else {
        // Case B: Kiosk กลาง (ไม่ได้ระบุเครื่อง) -> ไปหน้าเลือกเครื่อง
        window.location.href = 'map.html';
    }
}