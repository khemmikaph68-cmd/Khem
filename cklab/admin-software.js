/* admin-software.js (Updated: Manage Software + Manage Time Slots) */

let softwareModal;

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็คสิทธิ์ Admin
    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    // 2. Init Modal
    const modalEl = document.getElementById('softwareModal');
    if(modalEl) softwareModal = new bootstrap.Modal(modalEl);

    // 3. Render Data
    renderTable();      // วาดตาราง Software
    renderTimeSlots();  // ✅ วาดปุ่มจัดการเวลา (ส่วนที่ขาดไป)
});

// ==========================================
// ✅✅✅ TIME SLOT MANAGEMENT (ส่วนที่เพิ่ม) ✅✅✅
// ==========================================

function renderTimeSlots() {
    const container = document.getElementById('timeSlotContainer');
    if (!container) return;

    // ดึงข้อมูลจาก DB (ถ้าไม่มีฟังก์ชันนี้ ให้เช็ค mock-db.js อีกที)
    const slots = (DB.getAiTimeSlots && typeof DB.getAiTimeSlots === 'function') 
                  ? DB.getAiTimeSlots() 
                  : [];

    container.innerHTML = '';

    if (slots.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-3">ไม่พบข้อมูลรอบเวลา</div>';
        return;
    }

    slots.forEach(slot => {
        // เช็คว่า Active หรือไม่ เพื่อกำหนดสีและสถานะสวิตช์
        const isChecked = slot.active ? 'checked' : '';
        const statusText = slot.active ? 'เปิดให้บริการ' : 'ปิดชั่วคราว';
        const statusClass = slot.active ? 'text-success' : 'text-muted';
        const cardBorder = slot.active ? 'border-primary' : 'border-secondary';
        const bgClass = slot.active ? 'bg-white' : 'bg-light';

        container.innerHTML += `
            <div class="col-md-3 col-sm-6">
                <div class="card h-100 ${bgClass} ${cardBorder} border-opacity-25 shadow-sm">
                    <div class="card-body d-flex flex-column align-items-center justify-content-center py-3">
                        <h5 class="fw-bold mb-1">${slot.start} - ${slot.end}</h5>
                        <small class="fw-bold ${statusClass} mb-3">● ${statusText}</small>
                        
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" 
                                   id="slot_${slot.id}" ${isChecked} 
                                   onchange="toggleTimeSlot(${slot.id})">
                            <label class="form-check-label small text-muted" for="slot_${slot.id}">สถานะ</label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

function toggleTimeSlot(id) {
    let slots = DB.getAiTimeSlots();
    const index = slots.findIndex(s => s.id === id);
    if (index !== -1) {
        slots[index].active = !slots[index].active; // สลับค่า True/False
        DB.saveAiTimeSlots(slots);
        renderTimeSlots(); // รีเฟรชหน้าจอ
    }
}

function resetDefaultSlots() {
    if(confirm("ต้องการรีเซ็ตเวลากลับเป็นค่าเริ่มต้น (เปิดทุกรอบ) หรือไม่?")) {
        localStorage.removeItem('ck_ai_slots'); // ลบค่าที่แก้ไว้ออก
        renderTimeSlots(); // โหลดใหม่จาก Default ใน mock-db
    }
}

// ==========================================
// 💻 SOFTWARE MANAGEMENT (ส่วนเดิม)
// ==========================================

function renderTable() {
    const tbody = document.getElementById('softwareTableBody');
    let lib = DB.getSoftwareLib(); 

    // --- ส่วนที่ 1: อัปเดตตัวเลขการ์ดสถิติ ---
    const total = lib.length;
    const aiCount = lib.filter(i => i.type === 'AI').length;
    const swCount = lib.filter(i => i.type === 'Software').length;

    if(document.getElementById('countTotal')) document.getElementById('countTotal').innerText = total;
    if(document.getElementById('countAI')) document.getElementById('countAI').innerText = aiCount;
    if(document.getElementById('countSW')) document.getElementById('countSW').innerText = swCount;

    // --- ส่วนที่ 2: ระบบค้นหา ---
    const searchInput = document.getElementById('softwareSearch');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (searchVal) {
        lib = lib.filter(item => 
            item.name.toLowerCase().includes(searchVal) || 
            item.version.toLowerCase().includes(searchVal)
        );
    }

    // --- ส่วนที่ 3: วาดตาราง ---
    tbody.innerHTML = '';

    if (lib.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    lib.forEach(item => {
        // Badge สวยๆ ตามดีไซน์
        let typeBadge = item.type === 'AI' 
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-robot me-1"></i>AI Tool</span>' 
            : '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle"><i class="bi bi-hdd me-1"></i>Software</span>';

        // เช็ควันหมดอายุ
        let expireHtml = '';
        if (item.expire) {
            const today = new Date().toLocaleDateString('en-CA');
            const isExpired = item.expire < today;
            const colorClass = isExpired ? 'text-danger fw-bold' : 'text-muted';
            const icon = isExpired ? 'bi-exclamation-circle-fill' : 'bi-clock-history';
            expireHtml = `<div class="${colorClass} mt-1" style="font-size: 0.75rem;"><i class="bi ${icon} me-1"></i>Exp: ${item.expire}</div>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold text-dark">${item.name}</div>
                    ${expireHtml}
                </td>
                <td><span class="text-secondary">${item.version}</span></td>
                <td>${typeBadge}</td>
                <td class="text-end pe-4">
                    <button onclick="openModal('${item.id}')" class="btn btn-sm btn-light border text-primary me-1" title="แก้ไข">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button onclick="deleteItem('${item.id}')" class="btn btn-sm btn-light border text-danger" title="ลบ">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function openModal(id = null) {
    const modalTitle = document.getElementById('modalTitle');
    
    // Reset Form
    document.getElementById('editId').value = '';
    document.getElementById('editName').value = '';
    document.getElementById('editVersion').value = '';
    document.getElementById('editExpire').value = '';
    
    // Reset Type Selection (Default = Software)
    document.getElementById('editType').value = 'Software';
    updateTypeCardUI('Software');

    if (id) {
        modalTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>แก้ไขข้อมูล';
        const lib = DB.getSoftwareLib();
        const item = lib.find(i => i.id == id);
        if (item) {
            document.getElementById('editId').value = item.id;
            document.getElementById('editName').value = item.name;
            document.getElementById('editVersion').value = item.version;
            document.getElementById('editExpire').value = item.expire || '';
            
            // Set Type และอัปเดตการ์ดให้ Active
            document.getElementById('editType').value = item.type;
            updateTypeCardUI(item.type);
        }
    } else {
        modalTitle.innerHTML = '<i class="bi bi-plus-lg me-2"></i>เพิ่มรายการใหม่';
    }

    if(softwareModal) softwareModal.show();
}

// ฟังก์ชันช่วยเลือกการ์ด (ทำงานคู่กับ HTML ใหม่)
function updateTypeCardUI(type) {
    const cards = document.querySelectorAll('.software-type-card');
    cards.forEach(card => card.classList.remove('active'));
    
    if (type === 'Software') {
        if(cards[0]) cards[0].classList.add('active');
    } else {
        if(cards[1]) cards[1].classList.add('active');
    }
}

function saveSoftware() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();
    const version = document.getElementById('editVersion').value.trim();
    const type = document.getElementById('editType').value;
    const expire = document.getElementById('editExpire').value;

    if (!name || !version) return alert("กรุณากรอกชื่อและเวอร์ชันให้ครบถ้วน");

    let lib = DB.getSoftwareLib();
    const data = { name, version, type, expire };

    if (id) {
        // Edit
        const idx = lib.findIndex(i => i.id == id);
        if (idx !== -1) {
            lib[idx] = { ...lib[idx], ...data };
        }
    } else {
        // Add
        const newId = 'sw_' + Date.now();
        lib.push({ id: newId, ...data });
    }

    DB.saveSoftwareLib(lib);
    if(softwareModal) softwareModal.hide();
    renderTable();
}

function deleteItem(id) {
    if (confirm('ยืนยันลบรายการนี้?')) {
        let lib = DB.getSoftwareLib().filter(i => i.id != id);
        DB.saveSoftwareLib(lib);
        renderTable();
    }
}