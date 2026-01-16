/* admin-booking.js (Final: Validation on Save Only) */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // 2. Set Default Date
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) dateFilter.valueAsDate = new Date();

    // 3. Render Table
    renderBookings();
    
    // 4. Init Options
    initFormOptions();

    // ✅ เพิ่ม Event Listener: เมื่อเปลี่ยน "วันที่" หรือ "เวลา" ให้เช็คสถานะเครื่องใหม่ทันที
    document.getElementById('bkDate').addEventListener('change', filterPCList);
    document.getElementById('bkTimeSlot').addEventListener('change', filterPCList);
});

// ==========================================
// 0. INIT OPTIONS
// ==========================================
function initFormOptions() {
    // โหลดรายชื่อ Software ลงตัวกรอง
    const swFilter = document.getElementById('bkSoftwareFilter');
    if (swFilter) {
        const lib = DB.getSoftwareLib();
        if (lib && lib.length > 0) {
            swFilter.innerHTML = '<option value="">-- ไม่ระบุ (แสดงทั้งหมด) --</option>';
            lib.sort((a, b) => a.name.localeCompare(b.name));
            lib.forEach(sw => {
                swFilter.innerHTML += `<option value="${sw.name}">${sw.name}</option>`;
            });
        } else {
            swFilter.innerHTML = '<option value="">(ไม่พบข้อมูล Software)</option>';
            swFilter.disabled = true;
        }
    }
    
    // โหลด PC ครั้งแรก (ใช้ค่า Default วัน/เวลา)
    filterPCList();
}

// ==========================================
// 🔍 FILTER & AVAILABILITY LOGIC (หัวใจสำคัญ)
// ==========================================
function filterPCList() {
    const pcSelect = document.getElementById('bkPcSelect');
    if (!pcSelect) return;

    // 1. ดึงค่า Filter ต่างๆ
    const swName = document.getElementById('bkSoftwareFilter').value.toLowerCase();
    const selDate = document.getElementById('bkDate').value;
    const selTimeSlot = document.getElementById('bkTimeSlot').value; // ex. "09:00-10:30"

    // ถ้ายังไม่เลือกวันเวลา (เผื่อเคสหลุด)
    if (!selDate || !selTimeSlot) {
        pcSelect.innerHTML = '<option value="">-- กรุณาเลือกวันและเวลาก่อน --</option>';
        return;
    }

    // แกะเวลา Start/End ที่เลือก
    const [selStart, selEnd] = selTimeSlot.split('-');

    // ดึงข้อมูล
    const pcs = DB.getPCs();
    const bookings = DB.getBookings();
    
    // เรียงชื่อเครื่อง
    pcs.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    // เก็บค่าที่เลือกไว้เดิม (เพื่อคงการเลือกไว้ถ้ายังเลือกได้)
    const currentValue = pcSelect.value;

    pcSelect.innerHTML = '<option value="">-- เลือกเครื่อง --</option>';
    let count = 0;

    pcs.forEach(pc => {
        // --- A. กรองด้วย Software ---
        let hasSoftware = true;
        if (swName !== "") {
            hasSoftware = pc.installedSoftware && pc.installedSoftware.some(s => s.toLowerCase().includes(swName));
        }

        if (!hasSoftware) return; // ข้ามถ้าไม่มี Software ที่ต้องการ

        // --- B. เช็คสถานะ "ปิดปรับปรุง" (Maintenance) ---
        // ถ้าเครื่องเสีย ไม่ว่าจะวันไหนก็ห้ามจอง
        if (pc.status === 'maintenance') {
            pcSelect.innerHTML += `<option value="${pc.id}" disabled style="color: #6c757d;">🔴 ${pc.name} (แจ้งซ่อม/ปิดปรับปรุง)</option>`;
            count++;
            return;
        }

        // --- C. เช็คคิวว่าง (Availability Check) ---
        // วนลูปดู Booking ทั้งหมด หาดูว่ามีอันไหนชนกับ วัน+เวลา ที่เราเลือกไหม
        const isConflict = bookings.some(b => {
            // เช็คว่าเป็นเครื่องเดียวกัน + วันเดียวกัน + สถานะที่เป็นการจอง (Approved/Pending/InUse)
            if (String(b.pcId) !== String(pc.id)) return false;
            if (b.date !== selDate) return false;
            if (!['approved', 'pending', 'in_use'].includes(b.status)) return false; // status อื่นๆ เช่น canceled ไม่นับ

            // เช็คเวลาชน (Time Overlap Logic)
            // (Start A < End B) and (End A > Start B)
            return (selStart < b.endTime && selEnd > b.startTime);
        });

        // --- D. สร้าง Option ---
        if (isConflict) {
            // ถ้าชน -> แสดงว่าไม่ว่าง (Disable)
            pcSelect.innerHTML += `<option value="${pc.id}" disabled style="color: #dc3545;">❌ ${pc.name} (ไม่ว่าง - จองแล้ว)</option>`;
        } else {
            // ถ้าไม่ชน -> แสดงว่าว่าง (Enable)
            const selected = (String(pc.id) === String(currentValue)) ? 'selected' : '';
            pcSelect.innerHTML += `<option value="${pc.id}" ${selected} style="color: #198754;">🟢 ${pc.name} (ว่าง)</option>`;
        }
        count++;
    });

    if (count === 0) {
        pcSelect.innerHTML = `<option value="" disabled>❌ ไม่พบเครื่องที่มีโปรแกรมนี้</option>`;
    }
    
    // เรียก updateSoftwareList เพื่อเคลียร์ UI ส่วน AI เมื่อมีการเปลี่ยน Filter
    updateSoftwareList();
}

function updateSoftwareList() {
    const pcId = document.getElementById('bkPcSelect').value;
    const container = document.getElementById('aiCheckboxList');
    
    // เคลียร์ Hint text ด้านล่าง
    const hint = document.getElementById('pcSoftwareHint');
    if(hint) hint.innerText = "";

    if (!container) return;

    // เคลียร์ Checkbox เก่า
    container.innerHTML = '';

    // ถ้ายังไม่เลือกเครื่อง
    if (!pcId) {
        container.innerHTML = '<span class="text-muted small fst-italic">กรุณาเลือกเครื่องก่อน...</span>';
        return;
    }

    // หาข้อมูลเครื่อง PC ที่เลือก
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    // สร้าง Checkbox ตามรายการ Software ที่ติดตั้งในเครื่องนั้น
    if (pc && pc.installedSoftware && pc.installedSoftware.length > 0) {
        pc.installedSoftware.forEach((sw, index) => {
            const div = document.createElement('div');
            div.className = 'form-check form-check-inline mb-1';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" id="sw_chk_${index}" value="${sw}">
                <label class="form-check-label small" for="sw_chk_${index}">${sw}</label>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<span class="text-muted small">- ไม่พบรายการ Software ในเครื่องนี้ -</span>';
    }
}

// ==========================================
// 1. RENDER TABLE (ส่วนแสดงตารางรายการจอง)
// ==========================================
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    let bookings = DB.getBookings();
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5">ไม่มีรายการจองในช่วงเวลานี้</td></tr>`;
        return;
    }

    filtered.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });

    filtered.forEach(b => {
        let badgeClass = '', statusText = '', actionBtns = '';

        switch(b.status) {
            case 'pending': 
            case 'approved':
                badgeClass = 'bg-warning text-dark border border-warning'; 
                statusText = '🟡 จองแล้ว (Booked)';
                actionBtns = `
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="updateStatus('${b.id}', 'no_show')" title="แจ้ง No Show"><i class="bi bi-person-x"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="updateStatus('${b.id}', 'rejected')" title="ยกเลิก"><i class="bi bi-trash"></i></button>
                `;
                break;
            case 'completed':
                badgeClass = 'bg-success'; statusText = '🟢 ใช้งานเสร็จสิ้น'; break;
            case 'no_show':
                badgeClass = 'bg-secondary'; statusText = '⚪ No Show'; break;
            case 'rejected':
                badgeClass = 'bg-danger bg-opacity-75'; statusText = '❌ ยกเลิกแล้ว'; break;
        }

        let softwareDisplay = '-';
        if (b.softwareList && b.softwareList.length > 0) {
            softwareDisplay = b.softwareList.map(sw => `<span class="badge bg-info text-dark border border-info bg-opacity-25 me-1">${sw}</span>`).join('');
        } else if (b.type === 'General') {
            softwareDisplay = '<span class="badge bg-light text-secondary border">ทั่วไป</span>';
        } else if (b.type === 'AI') {
            softwareDisplay = '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="bi bi-robot me-1"></i>AI Workstation</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 fw-bold text-dark">${formatDate(b.date)}</td>
            <td class="text-primary fw-bold">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold text-dark">${b.userName}</div>
                <div class="small text-muted" style="font-size: 0.75rem;">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${softwareDisplay}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(dateStr) {
    if(!dateStr) return "-";
    const parts = dateStr.split('-');
    if(parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function updateStatus(id, newStatus) {
    if (newStatus === 'rejected' && !confirm("ยืนยันการยกเลิกรายการจองนี้?")) return;

    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        const booking = bookings[index];
        booking.status = newStatus;
        DB.saveBookings(bookings);
        
        // ถ้าเป็นการยกเลิก/No Show -> คืนสถานะ PC เป็นว่าง (ถ้าสถานะเครื่องยังเป็น reserved อยู่)
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

// ==========================================
// 2. MODAL & SAVE LOGIC (แก้ไขตาม request)
// ==========================================

function openBookingModal() {
    const today = new Date().toISOString().split('T')[0];
    
    const dateInput = document.getElementById('bkDate');
    if(dateInput) {
        dateInput.value = today;
        
        // ✅ ปลดล็อค: ลบการจำกัด min/max ออก เพื่อให้เลือกวันที่ในปฏิทินได้อิสระ
        dateInput.removeAttribute('min');
        dateInput.removeAttribute('max');
    }

    if(document.getElementById('bkPcSelect')) document.getElementById('bkPcSelect').value = '';
    if(document.getElementById('bkTimeSlot')) document.getElementById('bkTimeSlot').value = '09:00-10:30';
    if(document.getElementById('bkUser')) document.getElementById('bkUser').value = '';
    if(document.getElementById('bkTypeSelect')) document.getElementById('bkTypeSelect').value = 'General';
    if(document.getElementById('bkSoftwareFilter')) document.getElementById('bkSoftwareFilter').value = '';
    
    filterPCList(); 
    toggleSoftwareList(); 
    
    const hint = document.getElementById('pcSoftwareHint');
    if(hint) hint.innerText = '';

    if(bookingModal) bookingModal.show();
}

function saveBooking() {
    const pcId = document.getElementById('bkPcSelect').value;
    const date = document.getElementById('bkDate').value;
    const timeSlotStr = document.getElementById('bkTimeSlot').value; 
    const userId = document.getElementById('bkUser').value.trim();
    const type = document.getElementById('bkTypeSelect').value;

    if (!pcId || !date || !timeSlotStr || !userId) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    // --- ✅ ด่านตรวจเช็ควัน (Validation on Save) ---
    // สร้างวันที่แบบเที่ยงคืนเพื่อเปรียบเทียบ
    const parts = date.split('-');
    const selDate = new Date(parts[0], parts[1] - 1, parts[2]); // วันที่เลือก
    const today = new Date(); // วันนี้
    today.setHours(0,0,0,0); // รีเซ็ตเวลาเป็น 00:00

    // คำนวณความต่างวัน
    const diffTime = selDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // เช็คว่าเกิน 1 วันหรือไม่ (เช่น วันนี้จองพรุ่งนี้ได้ แต่จองมะรืนไม่ได้)
    if (diffDays > 1) {
        alert("⚠️ ไม่สามารถจองล่วงหน้าเกิน 1 วันได้\n(ระบบอนุญาตให้จองได้เฉพาะวันนี้และพรุ่งนี้เท่านั้น)");
        return;
    }
    
    // (Optional) ถ้าไม่ต้องการให้จองย้อนหลัง ก็เปิดบรรทัดนี้ได้
    /*
    if (diffDays < 0) {
        alert("⚠️ ไม่สามารถเลือกวันที่ย้อนหลังได้");
        return;
    }
    */
    // --------------------------------------------------

    const [start, end] = timeSlotStr.split('-');

    // Double Check Conflict
    const bookings = DB.getBookings();
    const isDup = bookings.some(b => 
        b.date === date && 
        String(b.pcId) === String(pcId) && 
        ['approved', 'pending', 'in_use'].includes(b.status) &&
        (start < b.endTime && end > b.startTime)
    );

    if (isDup) {
        alert("⚠️ เครื่องนี้ถูกจองไปแล้วในช่วงเวลาดังกล่าว กรุณาเลือกเครื่องอื่น");
        return;
    }
    
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    // ดึงรายการ Software AI
    let selectedSoftware = [];
    const checkboxes = document.querySelectorAll('#aiCheckboxList input:checked');
    checkboxes.forEach(cb => {
        selectedSoftware.push(cb.value);
    });

    const newBooking = {
        id: 'b_' + Date.now(),
        userId: userId,
        userName: userId, 
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: date,
        startTime: start,
        endTime: end,
        status: 'approved',
        type: type,
        softwareList: selectedSoftware 
    };

    bookings.push(newBooking);
    DB.saveBookings(bookings);
    
    alert("บันทึกการจองเรียบร้อย");
    if(bookingModal) bookingModal.hide();
    renderBookings();
}

function deleteBooking(id) {
    if(!confirm("ยืนยันลบข้อมูลการจองนี้?")) return;
    let bookings = DB.getBookings();
    bookings = bookings.filter(b => b.id !== id);
    DB.saveBookings(bookings);
    renderBookings();
}

function toggleSoftwareList() {
    const type = document.getElementById('bkTypeSelect').value;
    const box = document.getElementById('aiSelectionBox');
    if (box) {
        if (type === 'AI') box.classList.remove('d-none');
        else box.classList.add('d-none');
    }
}

function handleImport(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { processCSVData(e.target.result); };
    reader.readAsText(file);
    input.value = ''; 
}

// ==========================================
// 3. IMPORT CSV LOGIC
// ==========================================

function processCSVData(csvText) {
    const lines = csvText.split(/\r\n|\n/).map(l => l.trim()).filter(l => l);

    if (lines.length < 2) {
        alert("❌ ไฟล์ CSV ต้องมีอย่างน้อย 2 บรรทัด (Header + Data)");
        return;
    }

    const header = lines[0];
    const commaCount = (header.match(/,/g) || []).length;
    const semiCount = (header.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const dataLines = lines.slice(1);
    let successCount = 0;
    let failCount = 0;
    let errorLog = [];

    const bookings = DB.getBookings();
    const newBookings = [];

    dataLines.forEach((line, index) => {
        if (!line) return;

        try {
            const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length < 8) {
                throw new Error(`คอลัมน์ไม่ครบ`);
            }

            const userId = cols[0];
            const userName = cols[1];
            const resourceName = cols[5]; 
            const dateStr = cols[6];      
            const timeRange = cols[7];    

            const isoDate = convertDateToISO(dateStr);
            if (!isoDate) throw new Error(`รูปแบบวันที่ผิด`);

            if (!timeRange.includes('-')) throw new Error(`รูปแบบเวลาผิด`);
            const [startTime, endTime] = timeRange.split('-');

            const pcInfo = findPcFromResourceName(resourceName);
            if (!pcInfo) throw new Error(`ไม่พบเครื่อง "${resourceName}"`);

            const newBooking = {
                id: 'b_imp_' + Date.now() + Math.floor(Math.random() * 10000),
                userId: userId,
                userName: userName,
                pcId: pcInfo.id,
                pcName: pcInfo.name,
                date: isoDate,
                startTime: startTime.trim(),
                endTime: endTime.trim(),
                status: 'approved',
                type: (resourceName.toLowerCase().includes('ai') || resourceName.toLowerCase().includes('chatgpt')) ? 'AI' : 'General',
                softwareList: [] 
            };

            newBookings.push(newBooking);
            successCount++;

        } catch (err) {
            failCount++;
            if (errorLog.length < 5) {
                errorLog.push(`บรรทัด ${index + 2}: ${err.message}`);
            }
        }
    });

    if (successCount > 0) {
        const updatedBookings = [...bookings, ...newBookings];
        DB.saveBookings(updatedBookings);
        renderBookings();
        
        let msg = `✅ นำเข้าสำเร็จ: ${successCount} รายการ`;
        if (failCount > 0) {
            msg += `\n⚠️ ล้มเหลว: ${failCount} รายการ\n\nตัวอย่างข้อผิดพลาด:\n${errorLog.join('\n')}`;
        }
        alert(msg);
    } else {
        alert(`❌ ไม่สามารถนำเข้าข้อมูลได้เลย (${failCount} รายการ)\n\nสาเหตุ:\n${errorLog.join('\n')}`);
    }
}

function convertDateToISO(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    let year = parseInt(parts[2]);

    if (year > 2400) year -= 543; 
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findPcFromResourceName(resourceName) {
    const pcs = DB.getPCs();
    const cleanName = resourceName.toLowerCase().trim();

    const matches = cleanName.match(/(\d+)/); 
    if (matches) {
        const number = parseInt(matches[0]).toString(); 
        let found = pcs.find(p => String(p.id) === number);
        if (found) return found;
        found = pcs.find(p => p.name.includes(number.padStart(2, '0')));
        if (found) return found;
    }

    return pcs.find(p => cleanName.includes(p.name.toLowerCase()));
}