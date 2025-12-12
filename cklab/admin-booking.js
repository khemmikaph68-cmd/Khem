/* admin-booking.js (Final: No Software Selection on Save) */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // Set Default Date Filter = Today
    const todayStr = new Date().toISOString().split('T')[0];
    const dateFilter = document.getElementById('bookingDateFilter');
    if(dateFilter) dateFilter.value = todayStr;

    // Render
    renderBookings();
});

// --- RENDER TABLE ---
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    const bookings = DB.getBookings();
    
    // Get Filters
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    // Filter Logic
    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองในวันนี้</td></tr>`;
        return;
    }

    // เรียงลำดับตามเวลาเริ่ม
    filtered.sort((a, b) => a.startTime.localeCompare(b.startTime));

    filtered.forEach(b => {
        let badgeClass = '', statusText = '', actionBtns = '';

        switch(b.status) {
            case 'pending':
                badgeClass = 'bg-warning text-dark'; statusText = 'รออนุมัติ';
                actionBtns = `
                    <button class="btn btn-sm btn-success me-1" onclick="updateStatus('${b.id}', 'approved')" title="อนุมัติ"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="updateStatus('${b.id}', 'rejected')" title="ปฏิเสธ"><i class="bi bi-x-lg"></i></button>
                `;
                break;
            case 'approved':
                badgeClass = 'bg-success'; statusText = 'อนุมัติแล้ว';
                actionBtns = `<button class="btn btn-sm btn-outline-danger" onclick="updateStatus('${b.id}', 'rejected')">ยกเลิก</button>`;
                break;
            case 'rejected':
                badgeClass = 'bg-secondary'; statusText = 'ไม่อนุมัติ';
                actionBtns = `<button class="btn btn-sm btn-outline-secondary" disabled>ยกเลิกแล้ว</button>`;
                break;
        }

        // Type Badge
        const typeBadge = b.type === 'AI' 
            ? '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="bi bi-robot me-1"></i>AI Station</span>' 
            : '<span class="badge bg-secondary bg-opacity-10 text-secondary border"><i class="bi bi-laptop me-1"></i>General</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold">${b.userName}</div>
                <div class="small text-muted">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${typeBadge}</td> 
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- HELPER: CHECK OVERLAP ---
function checkTimeOverlap(pcId, date, start, end) {
    const bookings = DB.getBookings();
    
    const toMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const newStart = toMinutes(start);
    const newEnd = toMinutes(end);

    return bookings.find(b => {
        if (b.pcId === String(pcId) && b.date === date && b.status !== 'rejected') {
            const bStart = toMinutes(b.startTime);
            const bEnd = toMinutes(b.endTime);
            // ถ้าเวลาจบคนเก่า = เวลาเริ่มคนใหม่ ถือว่าไม่ซ้อน (อนุญาตให้จองต่อกันได้)
            return (newStart < bEnd && newEnd > bStart); 
        }
        return false;
    });
}

// ✅ ฟังก์ชันใหม่: คำนวณว่าตอนนี้ควรขึ้นชื่อใคร (Smart Update)
function refreshPCStatus(pcId) {
    const todayStr = new Date().toISOString().split('T')[0];
    const bookings = DB.getBookings();
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    if (!pc) return;
    if (pc.status === 'in_use') return; // ถ้ากำลังใช้งานอยู่ อย่าไปยุ่ง

    // หาการจองของเครื่องนี้ ในวันนี้ ที่อนุมัติแล้ว
    const todayBookings = bookings.filter(b => 
        b.pcId === String(pcId) && 
        b.date === todayStr && 
        b.status === 'approved'
    );

    if (todayBookings.length === 0) {
        // ไม่มีคิวจอง -> คืนสถานะว่าง
        DB.updatePCStatus(pcId, 'available', null);
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const toMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    todayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let activeBooking = null;
    let nextBooking = null;

    for (let b of todayBookings) {
        const start = toMinutes(b.startTime);
        const end = toMinutes(b.endTime);

        if (currentMinutes >= start && currentMinutes < end) {
            activeBooking = b; // ถึงคิวแล้ว
            break;
        }
        if (start > currentMinutes && !nextBooking) {
            nextBooking = b; // คิวถัดไป
        }
    }

    if (activeBooking) {
        DB.updatePCStatus(pcId, 'reserved', activeBooking.userName);
    } else if (nextBooking) {
        // ยังไม่ถึงเวลา แต่มีคิวรอ -> ขึ้นชื่อคนถัดไปรอไว้
        DB.updatePCStatus(pcId, 'reserved', nextBooking.userName);
    } else {
        // จบวันแล้ว -> คืนสถานะว่าง
        DB.updatePCStatus(pcId, 'available', null);
    }
}

// --- ACTIONS ---

function updateStatus(id, newStatus) {
    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        bookings[index].status = newStatus;
        DB.saveBookings(bookings);
        
        // เมื่อเปลี่ยนสถานะ (เช่น ยกเลิก) ให้คำนวณหน้าจอใหม่ทันที
        const booking = bookings[index];
        const todayStr = new Date().toISOString().split('T')[0];
        if (booking.date === todayStr) {
            refreshPCStatus(booking.pcId);
        }
        
        renderBookings();
    }
}

function openBookingModal() {
    // โหลดรายชื่อ Software เข้าตัวกรอง (ถ้ามี element)
    if(document.getElementById('bkSoftwareFilter')) initSoftwareFilter();
    
    // โหลดรายชื่อ PC (เรียกครั้งแรกให้แสดงทั้งหมด)
    renderPCOptions(DB.getPCs());

    // 2. Set Defaults
    const now = new Date();
    document.getElementById('bkUser').value = '';
    document.getElementById('bkDate').value = now.toISOString().split('T')[0];
    document.getElementById('bkTimeSlot').selectedIndex = 0; 
    document.getElementById('bkType').value = 'General';
    document.getElementById('bkSoftwareFilter').value = '';

    if(bookingModal) bookingModal.show();
}

function initSoftwareFilter() {
    const filterSelect = document.getElementById('bkSoftwareFilter');
    const lib = DB.getSoftwareLib(); 
    const currentVal = filterSelect.value;
    
    filterSelect.innerHTML = '<option value="">🔍 ค้นหาจาก Software/AI...</option>';
    lib.forEach(item => {
        const fullName = `${item.name} (${item.version})`;
        const option = document.createElement('option');
        option.value = fullName;
        option.text = item.type === 'AI' ? `🤖 ${fullName}` : `💻 ${fullName}`;
        filterSelect.appendChild(option);
    });
    filterSelect.value = currentVal;
}

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
    
    // อัปเดต Dropdown
    renderPCOptions(filteredPcs);
    
    // ถ้ากรอง -> Auto Select Type AI
    if (filterVal) {
        document.getElementById('bkType').value = 'AI';
    }
}

function renderPCOptions(pcs) {
    const select = document.getElementById('bkPcSelect');
    select.innerHTML = '';
    
    if (pcs.length === 0) {
        const option = document.createElement('option');
        option.text = "-- ไม่พบเครื่องที่รองรับ --";
        select.appendChild(option);
        return;
    }

    // เรียงตามชื่อ
    pcs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    pcs.forEach(pc => {
        const option = document.createElement('option');
        option.value = pc.id;
        option.text = `${pc.name} (${pc.status})`;
        select.appendChild(option);
    });
}

// ✅ ฟังก์ชันบันทึก (ตัดส่วน Checkbox Software ออก)
function saveBooking() {
    const pcId = document.getElementById('bkPcSelect').value;
    const date = document.getElementById('bkDate').value;
    const inputUser = document.getElementById('bkUser').value.trim(); 
    
    const timeSlotVal = document.getElementById('bkTimeSlot').value;
    const [start, end] = timeSlotVal.split('-');
    const type = document.getElementById('bkType').value;

    if (!inputUser || !date) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    // 1. Resolve ID to Name
    let finalUserName = inputUser;
    let finalUserId = 'AdminKey'; 

    const regData = DB.checkRegAPI(inputUser);
    if (regData) {
        finalUserName = regData.prefix + regData.name;
        finalUserId = inputUser;
    } else {
        finalUserName = inputUser;
    }

    // 2. เช็คจองซ้อน
    const conflict = checkTimeOverlap(pcId, date, start, end);
    if (conflict) {
        alert(`❌ ไม่สามารถจองได้! \nเครื่องนี้ถูกจองแล้วในช่วงเวลา ${conflict.startTime} - ${conflict.endTime}\nโดย: ${conflict.userName}`);
        return;
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
        // bookedSoftware: [], // ตัดออก
        status: 'approved' 
    };

    let bookings = DB.getBookings();
    bookings.push(newBooking);
    DB.saveBookings(bookings);

    // 3. Smart Update Status
    const todayStr = new Date().toISOString().split('T')[0];
    if (date === todayStr) {
        refreshPCStatus(pcId); 
        alert(`✅ บันทึกการจองสำหรับ "${finalUserName}" สำเร็จ`);
    } else {
        alert('✅ บันทึกการจองล่วงหน้าสำเร็จ');
    }

    if(bookingModal) bookingModal.hide();
    renderBookings();
}