/* admin-booking.js (Smart Auto-Select PC & AI) */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // 2. Set Default Date
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) dateFilter.valueAsDate = new Date();

    // 3. Listener for PC Select
    const pcSelect = document.getElementById('bkPcSelect');
    if (pcSelect) {
        pcSelect.addEventListener('change', updateSoftwareList);
    }

    // 4. Render Table
    renderBookings();
});

// ==========================================
// 1. RENDER TABLE
// ==========================================
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    const bookings = DB.getBookings();
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองตามเงื่อนไข</td></tr>`;
        return;
    }

    filtered.sort((a, b) => {
        const priority = { 'reserved': 1, 'in_use': 2, 'completed': 3, 'no_show': 4, 'rejected': 5 };
        const statusDiff = (priority[a.status] || 99) - (priority[b.status] || 99);
        if (statusDiff !== 0) return statusDiff;
        return a.startTime.localeCompare(b.startTime);
    });

    filtered.forEach(b => {
        let badgeClass = '', statusText = '', actionBtns = '';

        switch(b.status) {
            case 'pending':
                badgeClass = 'bg-warning text-dark'; statusText = 'รออนุมัติ';
                actionBtns = `<button class="btn btn-sm btn-danger" onclick="updateStatus('${b.id}', 'rejected')"><i class="bi bi-x-lg"></i></button>`;
                break;
            case 'reserved':
                badgeClass = 'bg-warning text-dark'; statusText = 'จอง (Reserved)';
                actionBtns = `
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="updateStatus('${b.id}', 'no_show')" title="แจ้ง No Show"><i class="bi bi-person-x"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="updateStatus('${b.id}', 'rejected')" title="ยกเลิก"><i class="bi bi-trash"></i></button>
                `;
                break;
            case 'in_use':
                badgeClass = 'bg-danger'; statusText = 'กำลังใช้งาน';
                actionBtns = `<button class="btn btn-sm btn-outline-success" onclick="updateStatus('${b.id}', 'completed')" title="จบการทำงาน"><i class="bi bi-check-lg"></i></button>`;
                break;
            case 'completed':
                badgeClass = 'bg-success'; statusText = 'เสร็จสิ้น'; break;
            case 'no_show':
                badgeClass = 'bg-secondary'; statusText = 'No Show'; break;
            case 'rejected':
                badgeClass = 'bg-secondary'; statusText = 'ยกเลิกแล้ว'; break;
        }

        let softwareDisplay = '-';
        if (b.softwareList && b.softwareList.length > 0) {
            softwareDisplay = b.softwareList.map(sw => `<span class="badge bg-info text-dark border border-info bg-opacity-25 me-1">${sw}</span>`).join('');
        } else if (b.type === 'General') {
            softwareDisplay = '<span class="badge bg-light text-secondary border">ทั่วไป</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary ps-4">${b.startTime} - ${b.endTime}</td>
            <td><div class="fw-bold">${b.userName}</div><div class="small text-muted">${b.userId}</div></td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${softwareDisplay}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStatus(id, newStatus) {
    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        const booking = bookings[index];
        booking.status = newStatus;
        DB.saveBookings(bookings);
        if (newStatus === 'no_show' || newStatus === 'rejected') {
            const pcs = DB.getPCs();
            const pc = pcs.find(p => String(p.id) === String(booking.pcId));
            if (pc && pc.status === 'reserved' && pc.currentUser === booking.userName) {
                DB.updatePCStatus(booking.pcId, 'available', null);
            }
        }
        renderBookings();
    }
}

function deleteBooking(id) {
    if(confirm('ต้องการลบรายการนี้ถาวรหรือไม่?')) {
        let bookings = DB.getBookings();
        bookings = bookings.filter(b => b.id !== id);
        DB.saveBookings(bookings);
        renderBookings();
    }
}

// ==========================================
// 2. MODAL & FORM LOGIC
// ==========================================

function openBookingModal() {
    initSoftwareFilter();
    renderPCOptions(DB.getPCs());

    const now = new Date();
    document.getElementById('bkUser').value = '';
    document.getElementById('bkDate').value = now.toISOString().split('T')[0];
    document.getElementById('bkTimeSlot').selectedIndex = 0; 
    document.getElementById('bkTypeSelect').value = 'General';
    document.getElementById('bkSoftwareFilter').value = '';
    
    toggleSoftwareList();
    if(bookingModal) bookingModal.show();
}

function initSoftwareFilter() {
    const filterSelect = document.getElementById('bkSoftwareFilter');
    const lib = DB.getSoftwareLib(); 
    filterSelect.innerHTML = '<option value="">🔍 ค้นหาจาก Software/AI...</option>';
    lib.forEach(item => {
        const fullName = `${item.name} (${item.version})`;
        const option = document.createElement('option');
        option.value = fullName;
        option.text = item.type === 'AI' ? `🤖 ${fullName}` : `💻 ${fullName}`;
        filterSelect.appendChild(option);
    });
}

// ✅ ฟังก์ชันนี้คือพระเอก: กรองเครื่อง + ล็อคเครื่อง + ติ๊กถูก
function filterPCList() {
    const filterVal = document.getElementById('bkSoftwareFilter').value;
    const allPcs = DB.getPCs();
    
    let filteredPcs = allPcs;
    if (filterVal) {
        filteredPcs = allPcs.filter(pc => 
            pc.installedSoftware && 
            pc.installedSoftware.some(sw => sw === filterVal)
        );
    }
    
    // 1. อัปเดตรายการเครื่องให้เหลือเฉพาะที่มี Software
    renderPCOptions(filteredPcs);
    
    // 2. ถ้าเลือก Software มา -> Auto Process
    if (filterVal) {
        // เปลี่ยนโหมดเป็น AI ทันที
        document.getElementById('bkTypeSelect').value = 'AI';
        toggleSoftwareList();

        // 🔥 3. ระบบช่วยเลือกเครื่องให้อัตโนมัติ (Auto-Lock)
        if (filteredPcs.length > 0) {
            const select = document.getElementById('bkPcSelect');
            
            // พยายามหาเครื่องที่ "ว่าง (available)" ก่อนเป็นอันดับแรก
            const bestChoice = filteredPcs.find(p => p.status === 'available');
            
            if (bestChoice) {
                select.value = bestChoice.id; // เลือกเครื่องว่าง
            } else {
                select.value = filteredPcs[0].id; // ถ้าไม่ว่าง เอาเครื่องแรกในลิสต์
            }

            // 🔥 4. สั่งโหลดรายการ Checkbox ของเครื่องที่ถูกเลือกทันที
            updateSoftwareList();
        }
    }
}

function renderPCOptions(pcs) {
    const select = document.getElementById('bkPcSelect');
    select.innerHTML = '<option value="">-- กรุณาเลือกเครื่อง --</option>';
    
    if (pcs.length === 0) {
        const option = document.createElement('option');
        option.text = "-- ไม่พบเครื่องที่รองรับ --";
        option.disabled = true;
        select.appendChild(option);
        return;
    }

    pcs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    pcs.forEach(pc => {
        const option = document.createElement('option');
        option.value = pc.id;
        option.text = `${pc.name} (${pc.status})`;
        if (pc.status === 'maintenance') option.disabled = true;
        select.appendChild(option);
    });
}

function updateSoftwareList() {
    const pcId = document.getElementById('bkPcSelect').value;
    const container = document.getElementById('aiCheckboxList');
    container.innerHTML = '';
    
    if (!pcId) {
        container.innerHTML = '<span class="text-muted small fst-italic">กรุณาเลือกเครื่องก่อน...</span>';
        return;
    }

    const pc = DB.getPCs().find(p => String(p.id) === String(pcId));
    if (!pc || !pc.installedSoftware || pc.installedSoftware.length === 0) {
        container.innerHTML = '<span class="text-muted small">เครื่องนี้ไม่มีรายการ Software/AI ติดตั้ง</span>';
        return;
    }

    // ดึงค่าจาก Filter เพื่อเอามาติ๊กถูกอัตโนมัติ
    const filterVal = document.getElementById('bkSoftwareFilter').value;

    pc.installedSoftware.forEach((sw, index) => {
        // ✅ ถ้าชื่อตรงกับที่ Filter ไว้ ให้ติ๊กถูกเลย (Auto-Check)
        const isChecked = (sw === filterVal) ? 'checked' : ''; 

        const html = `
            <div class="col-6">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="aiSelect" value="${sw}" id="sw_${index}" ${isChecked}>
                    <label class="form-check-label small" for="sw_${index}">${sw}</label>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function toggleSoftwareList() {
    const typeSelect = document.getElementById('bkTypeSelect');
    const isAI = typeSelect && typeSelect.value === 'AI';
    const box = document.getElementById('aiSelectionBox');
    
    if (box) {
        if (isAI) {
            box.classList.remove('d-none');
            updateSoftwareList(); 
        } else {
            box.classList.add('d-none');
        }
    }
}

// ==========================================
// 3. SAVE BOOKING
// ==========================================
function saveBooking() {
    const pcId = document.getElementById('bkPcSelect').value;
    const date = document.getElementById('bkDate').value;
    const inputUser = document.getElementById('bkUser').value.trim(); 
    
    const timeSlotVal = document.getElementById('bkTimeSlot').value;
    const [start, end] = timeSlotVal.split('-'); 
    
    const type = document.getElementById('bkTypeSelect').value;

    if (!inputUser || !date || !pcId || !start) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    let finalUserName = inputUser;
    let finalUserId = inputUser;
    const regData = DB.checkRegAPI(inputUser);
    if (regData) finalUserName = regData.prefix + regData.name;

    const bookings = DB.getBookings();
    const conflict = bookings.find(b => {
        return String(b.pcId) === String(pcId) && 
               b.date === date && 
               ['reserved', 'in_use', 'approved'].includes(b.status) &&
               (start < b.endTime && end > b.startTime);
    });

    if (conflict) {
        alert(`❌ จองไม่ได้! ช่วงเวลาชนกับคุณ ${conflict.userName}`);
        return;
    }

    let selectedSoftware = [];
    if (type === 'AI') {
        const checkboxes = document.querySelectorAll('input[name="aiSelect"]:checked');
        selectedSoftware = Array.from(checkboxes).map(cb => cb.value);
    }

    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    const newBooking = {
        id: 'b' + Date.now(),
        userId: finalUserId,   
        userName: finalUserName,
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: date,
        startTime: start,
        endTime: end,
        type: type,
        softwareList: selectedSoftware, 
        status: 'reserved'
    };

    bookings.push(newBooking);
    DB.saveBookings(bookings);

    alert(`✅ บันทึกการจองสำเร็จ\nผู้จอง: ${finalUserName}\nเครื่อง: ${pc.name}`);
    if(bookingModal) bookingModal.hide();
    renderBookings();
}