/* admin-manage.js (Fixed: Safe Mode & General/AI Toggle) */

let pcModal; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็คว่ามี DB หรือไม่
    if (typeof DB === 'undefined') {
        alert("Error: ไม่พบไฟล์ mock-db.js กรุณาตรวจสอบการเชื่อมต่อ");
        return;
    }

    // 2. เช็คสิทธิ์ Admin
    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        // window.location.href = 'admin-login.html'; // เปิดบรรทัดนี้เมื่อใช้งานจริง
    }

    // 3. เริ่มต้น Modal
    const modalEl = document.getElementById('pcModal');
    if (modalEl) {
        pcModal = new bootstrap.Modal(modalEl);
    }

    // 4. วาดตาราง
    renderPCTable();
});

// --- 1. RENDER TABLE ---
function renderPCTable() {
    const tbody = document.getElementById('pcTableBody');
    if (!tbody) return;

    // ดึงข้อมูล PC (ถ้าไม่มีให้ใช้ Array ว่าง)
    let pcs = (DB.getPCs && typeof DB.getPCs === 'function') ? DB.getPCs() : [];
    
    // เรียงตามชื่อ
    pcs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    tbody.innerHTML = '';

    if (pcs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">ไม่พบข้อมูล (กดปุ่ม "เพิ่มเครื่องใหม่")</td></tr>`;
        return;
    }

    pcs.forEach(pc => {
        const id = pc.id || '?';
        const name = pc.name || 'Unknown';
        const status = pc.status || 'maintenance';
        
        const type = pc.pcType === 'AI' 
            ? '<span class="badge bg-primary"><i class="bi bi-robot me-1"></i>AI Station</span>' 
            : '<span class="badge bg-secondary">General</span>';
        
        // เช็คว่ามีข้อมูลเวลาไหม
        const timeSlot = pc.timeSlot || '<span class="text-muted">-</span>';
        
        let badgeClass = 'bg-secondary';
        if (status === 'available') badgeClass = 'bg-success';
        if (status === 'in_use') badgeClass = 'bg-danger';
        if (status === 'reserved') badgeClass = 'bg-warning text-dark';
        
        // แสดง Software แบบย่อ
        let softBadges = '<span class="text-muted small">-</span>';
        if (Array.isArray(pc.installedSoftware) && pc.installedSoftware.length > 0) {
            softBadges = pc.installedSoftware.map(s => {
                let sName = s || "";
                let isAI = sName.toLowerCase().includes('gpt') || sName.toLowerCase().includes('ai');
                let color = isAI ? 'bg-primary bg-opacity-10 text-primary border border-primary' : 'bg-light text-dark border';
                return `<span class="badge ${color} me-1 mb-1 fw-normal">${sName}</span>`;
            }).join('');
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold text-muted">#${id}</td>
                <td><span class="fw-bold text-primary">${name}</span></td>
                <td><span class="badge ${badgeClass}">${status.toUpperCase()}</span></td>
                <td>${type}</td>
                <td class="small">${timeSlot}</td>
                <td>${softBadges}</td>
                <td class="text-end pe-4">
                    <button onclick="openPCModal('${id}')" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-pencil-fill"></i></button>
                    <button onclick="deletePC('${id}')" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash-fill"></i></button>
                </td>
            </tr>
        `;
    });
}

// --- 2. OPEN MODAL ---
function openPCModal(id = null) {
    if (!pcModal) {
        alert("System Error: Modal ไม่ทำงาน (ตรวจสอบ bootstrap.js)");
        return;
    }

    const modalTitle = document.getElementById('pcModalTitle');
    
    // รีเซ็ตค่าฟอร์ม
    document.getElementById('editPcId').value = '';
    document.getElementById('editPcName').value = '';
    document.getElementById('editPcStatus').value = 'available';
    document.getElementById('editPcType').value = 'General'; 
    document.getElementById('editPcTime').value = '';

    // โหลดรายชื่อ Software รอไว้ (Safe Mode)
    renderSoftwareCheckboxes(id);

    if (id) {
        // โหมดแก้ไข
        modalTitle.innerText = `แก้ไข PC-${id}`;
        const pcs = DB.getPCs();
        const pc = pcs.find(p => String(p.id) === String(id));
        if (pc) {
            document.getElementById('editPcId').value = pc.id;
            document.getElementById('editPcName').value = pc.name;
            document.getElementById('editPcStatus').value = pc.status;
            document.getElementById('editPcType').value = pc.pcType || 'General';
            document.getElementById('editPcTime').value = pc.timeSlot || '';
        }
    } else {
        // โหมดเพิ่มใหม่
        modalTitle.innerText = 'เพิ่มเครื่องใหม่';
        const pcs = DB.getPCs();
        let maxId = 0;
        pcs.forEach(p => { let num = parseInt(p.id); if (!isNaN(num) && num > maxId) maxId = num; });
        document.getElementById('editPcName').value = `PC-${(maxId + 1).toString().padStart(2,'0')}`;
    }
    
    // เรียกฟังก์ชันปรับสถานะ Checkbox ให้ตรงกับ Type ที่เลือก
    toggleSoftwareRequire(); 
    pcModal.show();
}

// --- 3. SOFTWARE CHECKBOXES (Safe Mode) ---
function renderSoftwareCheckboxes(pcId) {
    const listContainer = document.getElementById('softwareCheckboxList');
    if (!listContainer) return;

    // ✅ ป้องกัน Error ถ้า DB.getSoftwareLib ไม่มีอยู่จริง
    let lib = [];
    if (DB.getSoftwareLib && typeof DB.getSoftwareLib === 'function') {
        lib = DB.getSoftwareLib();
    } else {
        console.warn("Warning: DB.getSoftwareLib not found. Using empty list.");
    }
    
    // หา Software ที่ติดตั้งอยู่แล้วของเครื่องนี้
    let installed = [];
    if (pcId) {
        const pcs = DB.getPCs();
        const pc = pcs.find(p => String(p.id) === String(pcId));
        if (pc && Array.isArray(pc.installedSoftware)) installed = pc.installedSoftware;
    }

    listContainer.innerHTML = '';
    
    if (lib.length === 0) {
        listContainer.innerHTML = '<div class="col-12 text-muted small text-center p-3">ไม่พบรายการ Software (หรือไม่ได้อัปเดต mock-db.js)</div>';
        return;
    }

    lib.forEach(item => {
        const fullName = `${item.name} (${item.version})`;
        const isChecked = installed.includes(fullName) ? 'checked' : '';
        
        const icon = item.type === 'AI' 
            ? '<i class="bi bi-robot text-primary"></i>' 
            : '<i class="bi bi-hdd-network text-secondary"></i>';

        listContainer.innerHTML += `
            <div class="col-md-6">
                <div class="form-check bg-white p-2 rounded border h-100 checkbox-wrapper">
                    <input class="form-check-input ms-1" type="checkbox" name="pcSoftware" 
                           value="${fullName}" id="sw_${item.id}" ${isChecked} 
                           data-sw-type="${item.type}">
                    <label class="form-check-label ms-2 small fw-bold w-100 cursor-pointer" for="sw_${item.id}">
                        ${icon} ${item.name} <span class="text-muted fw-normal">v.${item.version}</span>
                    </label>
                </div>
            </div>
        `;
    });
}

// --- 4. TOGGLE LOGIC (หัวใจสำคัญ) ---
function toggleSoftwareRequire() {
    const typeEl = document.getElementById('editPcType');
    const box = document.getElementById('softwareCheckboxList');
    
    // ป้องกัน Error ถ้าหา Element ไม่เจอ
    if (!typeEl || !box) return;

    const type = typeEl.value;
    const boxParent = box.parentElement; // div card ที่ครอบอยู่

    // UI Effect
    if (type === 'AI') {
        boxParent.classList.add('border-primary', 'shadow-sm');
        boxParent.classList.remove('border-0');
    } else {
        boxParent.classList.remove('border-primary', 'shadow-sm');
        boxParent.classList.add('border-0');
    }

    // Logic: ปิดการเลือก AI ถ้าเป็น General
    const checkboxes = document.querySelectorAll('input[name="pcSoftware"]');
    checkboxes.forEach(cb => {
        const swType = cb.getAttribute('data-sw-type');
        const wrapper = cb.closest('.form-check'); // หา div ครอบ

        if (type === 'General' && swType === 'AI') {
            cb.checked = false; // เอาติ๊กออกทันที
            cb.disabled = true; // ล็อก ห้ามกด
            if(wrapper) {
                wrapper.classList.add('bg-light', 'opacity-50'); 
                wrapper.classList.remove('bg-white');
            }
        } else {
            cb.disabled = false; // ปลดล็อก
            if(wrapper) {
                wrapper.classList.remove('bg-light', 'opacity-50');
                wrapper.classList.add('bg-white');
            }
        }
    });
}

// --- 5. SAVE DATA ---
function savePC() {
    const id = document.getElementById('editPcId').value;
    const name = document.getElementById('editPcName').value.trim();
    const status = document.getElementById('editPcStatus').value;
    const type = document.getElementById('editPcType').value;
    const timeSlot = document.getElementById('editPcTime').value.trim();

    if (!name) { alert("กรุณาระบุชื่อเครื่อง"); return; }

    const checkboxes = document.querySelectorAll('input[name="pcSoftware"]:checked');
    const selectedSoftware = Array.from(checkboxes).map(cb => cb.value);

    // Validation: AI ต้องเลือก Software
    if (type === 'AI' && selectedSoftware.length === 0) {
        alert("⚠️ สำหรับเครื่องประเภท AI Workstation\nกรุณาเลือก Software/AI ที่ติดตั้งอย่างน้อย 1 รายการ");
        return; 
    }

    let pcs = DB.getPCs();
    const pcData = {
        name, status, pcType: type, timeSlot: timeSlot, installedSoftware: selectedSoftware
    };

    if (id) {
        // Update
        const index = pcs.findIndex(p => String(p.id) === String(id));
        if (index !== -1) {
            pcs[index] = { ...pcs[index], ...pcData };
        }
    } else {
        // Create
        let maxId = 0;
        pcs.forEach(p => { let num = parseInt(p.id); if (!isNaN(num) && num > maxId) maxId = num; });
        const newId = (maxId + 1).toString();
        pcs.push({ id: newId, ...pcData });
    }

    DB.savePCs(pcs);
    if(pcModal) pcModal.hide();
    renderPCTable();
}

function deletePC(id) {
    if(confirm('ยืนยันลบเครื่องนี้?')) {
        let pcs = DB.getPCs();
        pcs = pcs.filter(p => String(p.id) !== String(id));
        DB.savePCs(pcs);
        renderPCTable();
    }
}