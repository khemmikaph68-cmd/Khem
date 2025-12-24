/* auth.js - Fixed Station Version (Final: Dynamic Time Slots & Lab Status) */

// ==========================================
// 🔧 SYSTEM CONFIG: ดึงเลขเครื่องจาก URL
// ==========================================
function getSystemPCId() {
    if (window.location.hash) {
        let id = window.location.hash.replace('#', '').replace(/pc-/i, '');
        return parseInt(id).toString();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('pc');
}

const FIXED_PC_ID = getSystemPCId(); 
// ==========================================

let verifiedUserData = null;
let activeTab = 'internal';

document.addEventListener('DOMContentLoaded', () => {
    // เช็ค PC ID
    if (!FIXED_PC_ID || isNaN(parseInt(FIXED_PC_ID))) {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100 flex-column text-center">
                <h2 class="text-danger">⚠️ ไม่พบหมายเลขเครื่อง (PC ID)</h2>
                <p class="text-muted">กรุณาระบุเลขเครื่องใน URL<br>ตัวอย่าง: <code>index.html?pc=1</code></p>
                <a href="index.html?pc=1" class="btn btn-primary mt-3">เข้าใช้งานเครื่องที่ 1</a>
            </div>
        `;
        return;
    }

    checkMachineStatus();

    const extInputs = document.querySelectorAll('#formExternal input');
    extInputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });
});

function checkMachineStatus() {
    const displayId = document.getElementById('fixedPcIdDisplay');
    if(displayId) displayId.innerText = `PC-${FIXED_PC_ID.padStart(2, '0')}`;

    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    
    if (!pc) {
        alert(`System Error: ไม่พบข้อมูลเครื่อง PC-${FIXED_PC_ID}`);
        return;
    }
    
    // Status Indicator
    const indicator = document.querySelector('.status-indicator');
    if(indicator) {
        indicator.className = 'status-indicator';
        indicator.classList.add(
            `bg-${pc.status === 'available' ? 'success' : 
                   pc.status === 'in_use' ? 'danger' : 
                   pc.status === 'reserved' ? 'warning' : 'secondary'}`
        );
        indicator.title = pc.status.toUpperCase();
    }

    // Auto Resume Session
    if (pc.status === 'in_use') {
         const currentSession = DB.getSession();
         if (!currentSession || currentSession.pcId != FIXED_PC_ID) {
              DB.setSession({
                   pcId: FIXED_PC_ID,
                   user: { name: pc.currentUser || 'Unknown User' },
                   startTime: pc.startTime || Date.now()
              });
         }
         window.location.href = 'timer.html';
    } 
}

function switchTab(type) {
    activeTab = type;
    verifiedUserData = null;
    
    // จัดการ Class ปุ่ม Tab
    document.getElementById('tab-internal').classList.toggle('active', type === 'internal');
    document.getElementById('tab-external').classList.toggle('active', type === 'external');
    document.getElementById('formInternal').classList.toggle('d-none', type !== 'internal');
    document.getElementById('formExternal').classList.toggle('d-none', type !== 'external');
    document.getElementById('internalVerifyCard').style.display = 'none';
    
    // เคลียร์ค่า input
    if (type === 'internal') {
        document.getElementById('ubuUser').value = '';
    }

    // จัดการปุ่ม Radio Button
    const radioBooking = document.querySelector('input[value="booking"]');
    const radioWalkin = document.querySelector('input[value="walkin"]');
    const radioBookingLabel = radioBooking.closest('.btn'); 

    if (type === 'external') {
        radioWalkin.checked = true;
        radioBooking.disabled = true;
        if(radioBookingLabel) {
            radioBookingLabel.classList.add('opacity-50', 'pe-none'); 
        }
    } else {
        radioBooking.disabled = false;
        if(radioBookingLabel) {
            radioBookingLabel.classList.remove('opacity-50', 'pe-none');
        }
    }

    validateForm();
}

function verifyUBUUser() {
    const id = document.getElementById('ubuUser').value.trim();
    if(!id) return alert("กรุณากรอกรหัส");
    
    const user = DB.checkRegAPI(id);
    const verifyCard = document.getElementById('internalVerifyCard');
    
    if (user) {
        verifiedUserData = { 
            id: id, 
            name: user.prefix + user.name, 
            faculty: user.faculty, 
            role: user.role, 
            level: user.level, 
            year: user.year 
        };

        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        document.getElementById('showRole').innerText = verifiedUserData.role.toUpperCase();
        
        verifyCard.style.display = 'block';
        validateForm();
    } else {
        alert("❌ ไม่พบข้อมูลในระบบ");
        verifyCard.style.display = 'none';
        verifiedUserData = null;
        validateForm();
    }
}

function validateForm() {
    let isUserValid = false;
    const btn = document.getElementById('btnConfirm');
    
    if (activeTab === 'internal') {
        isUserValid = (verifiedUserData !== null);
    } else {
        const id = document.getElementById('extIdCard').value.trim();
        const name = document.getElementById('extName').value.trim();
        isUserValid = (id !== '' && name !== '');
    }
    
    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    
    const isAccessible = pc && (pc.status === 'available' || pc.status === 'reserved');

    if (isUserValid && isAccessible) {
        btn.disabled = false;
        btn.classList.replace('btn-secondary', 'btn-success');
        
        if (pc.status === 'reserved') {
            btn.innerHTML = `<i class="bi bi-calendar-check me-2"></i>ยืนยันการเข้าใช้งาน (จองไว้)`;
        } else {
            btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>เข้าสู่ระบบและเริ่มใช้งาน`;
        }
    } else {
        btn.disabled = true;
        btn.classList.replace('btn-success', 'btn-secondary');
        if (!isAccessible) {
            btn.textContent = `❌ เครื่องไม่ว่าง (${pc.status})`;
        } else {
            btn.textContent = 'กรุณากรอกข้อมูลให้ครบ';
        }
    }
}

// ✅ ฟังก์ชันยืนยันการเข้าใช้งาน (Check-in) ฉบับสมบูรณ์
function confirmCheckIn() {
    // ✅✅✅ 1. ตรวจสอบสถานะห้อง (Lab Status) ✅✅✅
    const config = DB.getGeneralConfig();
    if (config.labStatus === 'closed') {
        alert(`⛔ ขออภัย ห้องปิดให้บริการชั่วคราว\n\nข้อความจากเจ้าหน้าที่: "${config.adminMessage}"\n\nหากท่านมีคิวจอง กรุณาติดต่อเจ้าหน้าที่เมื่อห้องเปิดเพื่อขอชดเชยเวลา`);
        return; // ห้ามเข้า
    }

    // 2. ตรวจสอบข้อมูลผู้ใช้
    if (!verifiedUserData && activeTab === 'internal') {
        alert('กรุณาตรวจสอบข้อมูลผู้ใช้ก่อน (กดปุ่มตรวจสอบ)');
        return;
    }

    if (activeTab === 'external') {
        verifiedUserData = {
            id: document.getElementById('extIdCard').value.trim(),
            name: document.getElementById('extName').value.trim(),
            faculty: document.getElementById('extOrg').value.trim() || 'บุคคลทั่วไป',
            role: 'external',
            level: 'N/A',
            year: 'N/A'
        };
    }

    const pcId = FIXED_PC_ID; 

    // ✅✅✅ 3. ตรวจสอบรอบเวลา AI (Dynamic Slots) ✅✅✅
    const now = new Date();
    const currentHm = now.getHours() * 60 + now.getMinutes();
    let currentSlot = null;

    // ดึงข้อมูล Slot จาก Database (ไม่ใช่ตัวแปร Global แล้ว)
    const allSlots = DB.getAiTimeSlots ? DB.getAiTimeSlots() : [];
    // กรองเฉพาะรอบที่เปิด (Active)
    const activeSlots = allSlots.filter(s => s.active);

    activeSlots.forEach(slot => {
        const [sh, sm] = slot.start.split(':').map(Number);
        const [eh, em] = slot.end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        // อนุญาตให้เข้าก่อนเวลาได้ 15 นาที และต้องไม่เกินเวลาจบ
        if (currentHm >= (startMins - 15) && currentHm < endMins) {
            currentSlot = { ...slot, endMins }; 
        }
    });

    const pcInfo = DB.getPCs().find(p => String(p.id) === String(pcId));
    
    // ถ้าเป็นเครื่อง AI แล้วไม่อยู่ในรอบเวลา -> ห้ามเข้า
    if (pcInfo && pcInfo.pcType === 'AI' && !currentSlot) {
         // สร้างข้อความแจ้งเตือนรอบที่เปิดอยู่จริง
         let availableTimes = activeSlots.map(s => s.label || `${s.start}-${s.end}`).join(', ');
         if (!availableTimes) availableTimes = "ไม่มีรอบเปิดให้บริการขณะนี้";

         alert(`⛔ ขณะนี้ไม่อยู่ในช่วงเวลาให้บริการ AI Station\n\nรอบที่เปิดให้บริการ:\n${availableTimes}`);
         return; 
    }
    // ✅✅✅ จบส่วนตรวจสอบเวลา ✅✅✅


    // 4. ตรวจสอบประเภทการใช้งาน (Walk-in vs Booking)
    const usageTypeEl = document.querySelector('input[name="usageType"]:checked');
    const usageType = usageTypeEl ? usageTypeEl.value : 'walkin';

    if (usageType === 'booking') {
        const bookings = DB.getBookings(); 
        const todayStr = new Date().toLocaleDateString('en-CA');

        const validBooking = bookings.find(b => 
            String(b.pcId) === String(pcId) &&     
            b.date === todayStr &&                  
            b.status === 'approved' &&              
            b.userName === verifiedUserData.name    
        );

        if (!validBooking) {
            alert(`⚠️ ไม่พบข้อมูลการจอง!\n\nคุณ ${verifiedUserData.name} ไม่ได้จองเครื่อง PC-${pcId} ไว้ในวันนี้\n\nกรุณาเลือก "Walk-in" หรือตรวจสอบเครื่องที่ท่านจองครับ`);
            return; 
        }

        DB.updateBookingStatus(validBooking.id, 'completed');
    }

    // 5. บันทึก Session และเปลี่ยนหน้า
    const sessionData = {
        user: {
            id: verifiedUserData.id,
            name: verifiedUserData.name,
            userType: verifiedUserData.role,
            faculty: verifiedUserData.faculty
        },
        pcId: pcId,
        startTime: Date.now(),
        loginMethod: usageType,

        // เพิ่มข้อมูล Slot และเวลาบังคับจบ (เฉพาะ AI)
        slotId: currentSlot ? currentSlot.id : null,
        forceEndTime: currentSlot ? currentSlot.endMins : null 
    };

    DB.setSession(sessionData); 
    DB.updatePCStatus(pcId, 'in_use', verifiedUserData.name); 

    DB.saveLog({
        action: 'START_SESSION',
        userId: verifiedUserData.id,
        userName: verifiedUserData.name,
        userRole: verifiedUserData.role,
        userFaculty: verifiedUserData.faculty,
        pcId: pcId,
        startTime: new Date().toISOString(),
        details: usageType === 'booking' ? 'User Check-in (Booking)' : 'User Check-in (Walk-in)',
        slotId: currentSlot ? currentSlot.id : null 
    });

    window.location.href = 'timer.html';
}