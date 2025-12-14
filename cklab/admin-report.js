/* admin-report.js (Final Version: All Charts Fixed & Table Full Options) */

// --- Global Variables ---
let monthlyFacultyChartInstance, monthlyOrgChartInstance;
let pieChartInstance, pcAvgChartInstance, satisfactionChartInstance, topSoftwareChartInstance;
let allLogs; 

// --- Master Lists ---
const FACULTY_LIST = ["คณะวิทยาศาสตร์", "คณะเกษตรศาสตร์", "คณะวิศวกรรมศาสตร์", "คณะศิลปศาสตร์", "คณะเภสัชศาสตร์", "คณะบริหารศาสตร์", "คณะพยาบาลศาสตร์", "วิทยาลัยแพทยศาสตร์และการสาธารณสุข", "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์", "คณะนิติศาสตร์", "คณะรัฐศาสตร์", "คณะศึกษาศาสตร์"];
const ORG_LIST = ["สำนักคอมพิวเตอร์และเครือข่าย", "สำนักบริหารทรัพย์สินและสิทธิประโยชน์", "สำนักวิทยบริการ", "กองกลาง", "กองแผนงาน", "กองคลัง", "กองบริการการศึกษา", "กองการเจ้าหน้าที่", "สำนักงานส่งเสริมและบริหารงานวิจัย ฯ", "สำนักงานพัฒนานักศึกษา", "สำนักงานบริหารกายภาพและสิ่งแวดล้อม", "สำนักงานวิเทศสัมพันธ์", "สำนักงานกฏหมายและนิติการ", "สำนักงานตรวจสอบภายใน", "สำนักงานรักษาความปลอดภัย", "สภาอาจารย์", "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี", "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี", "ศูนย์การจัดการความรู้ (KM)", "ศูนย์การเรียนรู้และพัฒนา \"งา\" เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน", "สถานปฏิบัติการโรงแรมฯ (U-Place)", "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง ฯ", "ศูนย์เครื่องมือวิทยาศาสตร์", "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี"];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const session = DB.getSession();
    // if (!session || !session.user || session.user.role !== 'admin') window.location.href = 'admin-login.html';
    
    allLogs = DB.getLogs(); 
    populateFilterOptions(allLogs); 
    autoSetDates();
    renderLifetimeStats(); 
    initializeReports(allLogs); 
});

// ==========================================
// 1. FILTER LOGIC
// ==========================================
function populateFilterOptions(logs) {
    const faculties = new Set(FACULTY_LIST);
    const organizations = new Set(ORG_LIST);
    const levels = new Set();
    const years = new Set();
    const sortThai = (a, b) => String(a).localeCompare(String(b), 'th');
    const sortNum = (a, b) => parseInt(a) - parseInt(b);

    logs.forEach(log => {
        if (log.userLevel) levels.add(log.userLevel);
        if (log.userYear && log.userYear !== '-') years.add(log.userYear);
        if (log.userFaculty && !faculties.has(log.userFaculty) && !organizations.has(log.userFaculty)) {
             if (log.userFaculty.startsWith("คณะ") || log.userFaculty.startsWith("วิทยาลัย")) faculties.add(log.userFaculty);
             else if (log.userFaculty !== "บุคคลภายนอก" && log.userFaculty !== "ไม่ระบุสังกัด") organizations.add(log.userFaculty);
        }
    });

    populateSelect('filterFaculty', faculties, sortThai);
    populateSelect('filterOrganization', organizations, sortThai);
    populateSelect('filterLevel', levels, sortThai);
    populateSelect('filterYear', years, sortNum);
}
function populateSelect(id, set, sortFn) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    Array.from(set).sort(sortFn).forEach(val => { select.innerHTML += `<option value="${val}">${val}</option>`; });
}
function getFilterParams() {
    return {
        startDate: document.getElementById('filterStartDate').value,
        endDate: document.getElementById('filterEndDate').value,
        faculty: document.getElementById('filterFaculty').value,
        organization: document.getElementById('filterOrganization').value,
        userType: document.getElementById('filterUserType').value,
        level: document.getElementById('filterLevel').value,
        year: document.getElementById('filterYear').value,
    };
}
function applyFilters() { initializeReports(filterLogs(allLogs, getFilterParams())); }
function clearFilters() { document.getElementById('reportFilterForm').reset(); autoSetDates(); initializeReports(allLogs); }

function filterLogs(logs, params) {
    let filtered = logs;
    const { startDate, endDate, faculty, organization, userType, level, year } = params;
    if (startDate) filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= new Date(startDate).setHours(0,0,0,0));
    if (endDate) filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= new Date(endDate).setHours(23,59,59,999));
    if (faculty) filtered = filtered.filter(log => log.userFaculty === faculty);
    if (organization) filtered = filtered.filter(log => log.userFaculty === organization);
    if (userType) {
        if (userType === 'Internal') filtered = filtered.filter(log => log.userRole === 'student' || log.userRole === 'staff');
        else if (userType === 'External') filtered = filtered.filter(log => log.userRole === 'external');
    }
    if (level) filtered = filtered.filter(log => log.userLevel === level);
    if (year) filtered = filtered.filter(log => log.userYear === year);
    return filtered;
}

// ==========================================
// 2. MAIN RENDER FUNCTION
// ==========================================

function initializeReports(logs) {
    // Clear old charts
    [monthlyFacultyChartInstance, monthlyOrgChartInstance, pieChartInstance, pcAvgChartInstance, satisfactionChartInstance, topSoftwareChartInstance].forEach(chart => {
        if (chart) chart.destroy();
    });

    renderLogHistory(logs); // Render Table

    const statsLogs = logs.filter(l => l.action === 'END_SESSION'); 
    if (statsLogs.length === 0) return;

    const data = processLogs(statsLogs);
    
    // Draw Charts
    monthlyFacultyChartInstance = drawBeautifulLineChart(data.monthlyFacultyData, 'monthlyFacultyChart', 5);
    monthlyOrgChartInstance = drawBeautifulLineChart(data.monthlyOrgData, 'monthlyOrgChart', 5);
    topSoftwareChartInstance = drawTopSoftwareChart(data.softwareStats);
    pieChartInstance = drawAIUsagePieChart(data.aiUsageData); 
    pcAvgChartInstance = drawPCAvgTimeChart(data.pcAvgTimeData);
    satisfactionChartInstance = drawSatisfactionChart(data.satisfactionData);
}

function processLogs(logs) {
    const result = {
        monthlyFacultyData: {}, monthlyOrgData: {}, aiUsageData: { ai: 0, nonAI: 0 },
        pcAvgTimeData: [], satisfactionData: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0 },
        softwareStats: {}
    };
    const pcUsageMap = new Map();

    logs.forEach(log => {
        const monthYear = new Date(log.timestamp).toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
        const faculty = log.userFaculty || 'Unknown';
        
        let target = null;
        if (FACULTY_LIST.includes(faculty) || faculty.startsWith("คณะ") || faculty.startsWith("วิทยาลัย")) target = result.monthlyFacultyData;
        else if (faculty !== "บุคคลภายนอก") target = result.monthlyOrgData;

        if (target) {
            if (!target[monthYear]) target[monthYear] = {};
            target[monthYear][faculty] = (target[monthYear][faculty] || 0) + 1;
        }

        if (log.isAIUsed) result.aiUsageData.ai++; else result.aiUsageData.nonAI++;

        if (Array.isArray(log.usedSoftware)) {
            log.usedSoftware.forEach(sw => {
                const name = sw.split('(')[0].trim();
                result.softwareStats[name] = (result.softwareStats[name] || 0) + 1;
            });
        }

        const pcId = log.pcId || 'Unknown';
        if (!pcUsageMap.has(pcId)) pcUsageMap.set(pcId, { total: 0, count: 0 });
        pcUsageMap.get(pcId).total += (log.durationMinutes || 0);
        pcUsageMap.get(pcId).count++;

        if (log.satisfactionScore) {
            const score = parseInt(log.satisfactionScore);
            if (score >= 1 && score <= 5) {
                result.satisfactionData[score]++;
                result.satisfactionData.total++;
            }
        }
    });

    result.pcAvgTimeData = Array.from(pcUsageMap.entries()).map(([id, d]) => ({ pcId: `PC-${id}`, avgTime: (d.total/d.count).toFixed(1) }));
    return result;
}

// ==========================================
// 3. CHART DRAWING FUNCTIONS
// ==========================================

// 1. Line Chart (Monthly Stats) - Smooth
function drawBeautifulLineChart(data, canvasId, topN = 5) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const months = Object.keys(data).sort((a, b) => {
        const monthMap = { "ม.ค.":0, "ก.พ.":1, "มี.ค.":2, "เม.ย.":3, "พ.ค.":4, "มิ.ย.":5, "ก.ค.":6, "ส.ค.":7, "ก.ย.":8, "ต.ค.":9, "พ.ย.":10, "ธ.ค.":11 };
        const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
        return new Date(parseInt(yA)-543, monthMap[mA]) - new Date(parseInt(yB)-543, monthMap[mB]);
    });

    const totals = {};
    months.forEach(m => Object.keys(data[m]).forEach(k => totals[k] = (totals[k]||0) + data[m][k]));
    const topKeys = Object.keys(totals).sort((a,b) => totals[b] - totals[a]).slice(0, topN);
    const others = Object.keys(totals).filter(k => !topKeys.includes(k));

    const datasets = topKeys.map((k, i) => ({
        label: k, data: months.map(m => data[m][k] || 0),
        borderColor: getChartColor(i), backgroundColor: getChartColor(i),
        borderWidth: 2.5, tension: 0.4, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2, fill: false
    }));
    
    if (others.length > 0) {
        datasets.push({
            label: 'อื่นๆ', data: months.map(m => others.reduce((s, k) => s + (data[m][k]||0), 0)),
            borderColor: '#adb5bd', backgroundColor: '#adb5bd',
            borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0, fill: false
        });
    }

    return new Chart(ctx, {
        type: 'line', data: { labels: months, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: "'Prompt', sans-serif" } } } },
            scales: { 
                x: { grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif" } } }, 
                y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#f0f0f0' }, ticks: { font: { family: "'Prompt', sans-serif" } } } 
            }
        }
    });
}

// 2. Top Software (Minimal Gradient Bar)
function drawTopSoftwareChart(data) {
    const ctx = document.getElementById('topSoftwareChart');
    if(!ctx) return;
    const sorted = Object.entries(data).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 400, 0);
    gradient.addColorStop(0, '#4e73df'); gradient.addColorStop(1, '#36b9cc');

    return new Chart(ctx, {
        type: 'bar',
        data: { labels: sorted.map(x=>x[0]), datasets: [{ label: 'จำนวนการใช้งาน', data: sorted.map(x=>x[1]), backgroundColor: gradient, borderRadius: 10, barPercentage: 0.6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { legend: {display:false}, tooltip: { callbacks: { label: (c) => ` ${c.raw} ครั้ง` } } }, 
            scales: { x: { beginAtZero: true, grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif" } } }, y: { grid: {display:false}, ticks: { font: { family: "'Prompt', sans-serif", weight: '500' } } } } 
        }
    });
}

// 3. Satisfaction (Horizontal Bar + Avg Score)
function drawSatisfactionChart(data) {
    const ctx = document.getElementById('satisfactionChart').getContext('2d');
    const total = data.total || 1;
    const avg = ((data[5]*5 + data[4]*4 + data[3]*3 + data[2]*2 + data[1]*1) / total).toFixed(2);
    const labels = [5,4,3,2,1].map(i => `${i} ดาว (${((data[i]/total)*100).toFixed(0)}%)`);
    const values = [data[5], data[4], data[3], data[2], data[1]];
    const colors = ['#198754','#28a745','#ffc107','#fd7e14','#dc3545'];
    
    return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 10, barPercentage: 0.6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { 
                title: { display: true, text: `⭐ คะแนนเฉลี่ย: ${avg} / 5.00`, font: {size:16, family:"'Prompt'"}, padding: {bottom:10} }, 
                legend: {display:false} 
            }, 
            scales: { x: {display:false}, y: {grid:{display:false}, ticks: { font: { family: "'Prompt', sans-serif" } }} } 
        }
    });
}

// 4. PC Avg Time (Minimal Bar with Gradient)
function drawPCAvgTimeChart(d) { 
    const ctx = document.getElementById('pcAvgTimeChart').getContext('2d');
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#fd7e14'); gradient.addColorStop(1, '#f6c23e');

    return new Chart(ctx, { 
        type: 'bar', 
        data: { labels: d.map(x=>x.pcId), datasets: [{ label: 'นาที', data: d.map(x=>x.avgTime), backgroundColor: gradient, borderRadius: 10 }] }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: {display:false} },
            scales: { 
                y: { beginAtZero:true, grid: { borderDash: [2, 4], color: '#f0f0f0' }, ticks: { font: { family: "'Prompt', sans-serif" } } },
                x: { grid: {display:false}, ticks: { font: { family: "'Prompt', sans-serif" } } }
            } 
        } 
    }); 
}

// 5. Pie Chart (Minimal Doughnut)
function drawAIUsagePieChart(d) { 
    return new Chart(document.getElementById('aiUsagePieChart'), { 
        type: 'doughnut', 
        data: { labels: ['AI Tools', 'General Use'], datasets: [{ data: [d.ai, d.nonAI], backgroundColor: ['#4e73df', '#e2e6ea'], borderWidth: 0 }] }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position:'bottom', labels: { usePointStyle: true, font: { family: "'Prompt', sans-serif" } } } },
            cutout: '70%' 
        } 
    }); 
}

function getChartColor(i) { return ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1'][i%6]; }

// ==========================================
// 4. TABLE & EXPORT
// ==========================================

// ✅ ฟังก์ชันแสดงตาราง (ครบทุกคอลัมน์ + Limit 100)
function renderLogHistory(logs) {
    const tbody = document.getElementById('logHistoryTableBody');
    const COLSPAN_COUNT = 11;
    if (!tbody) return;
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="text-center text-muted p-4">ไม่พบข้อมูล</td></tr>`;
        return;
    }
    
    // เรียงลำดับล่าสุด -> เก่าสุด และตัดเหลือ 100 รายการ
    const displayLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);

    tbody.innerHTML = displayLogs.map((log, index) => {
        const userId = log.userId || '-';
        const name = log.userName || '-';
        
        let softwareDisplay = '-';
        if (Array.isArray(log.usedSoftware) && log.usedSoftware.length > 0) {
            softwareDisplay = log.usedSoftware.slice(0, 2).map(s => 
                `<span class="badge bg-light text-dark border fw-normal me-1">${s}</span>`
            ).join('') + (log.usedSoftware.length > 2 ? '...' : '');
        }

        const end = new Date(log.timestamp);
        const start = log.startTime ? new Date(log.startTime) : end;
        const dateStr = end.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeRange = `${start.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`;
        
        const faculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '-');
        
        let roleBadge = '<span class="badge bg-secondary">ไม่ระบุ</span>';
        if (log.userRole === 'student') roleBadge = '<span class="badge bg-info text-dark">นักศึกษา</span>';
        else if (log.userRole === 'staff') roleBadge = '<span class="badge bg-warning text-dark">บุคลากร/อาจารย์</span>';
        else if (log.userRole === 'external' || log.userRole === 'Guest') roleBadge = '<span class="badge bg-success">บุคคลภายนอก</span>';

        const pcName = `PC-${log.pcId || '?'}`;
        const duration = log.durationMinutes ? `${log.durationMinutes} น.` : '-';
        const satisfactionScoreDisplay = getSatisfactionDisplay(log.satisfactionScore);

        return `<tr>
            <td class="text-center">${index + 1}</td>
            <td><span class="fw-bold text-primary">${userId}</span></td>
            <td>${name}</td>
            <td>${softwareDisplay}</td>
            <td>${dateStr}</td>
            <td>${timeRange}</td>
            <td>${faculty}</td>
            <td>${roleBadge}</td>
            <td>${pcName}</td>
            <td class="text-end">${duration}</td>
            <td class="text-center">${satisfactionScoreDisplay}</td>
        </tr>`;
    }).join('');

    if (logs.length > 100) {
        tbody.innerHTML += `<tr><td colspan="${COLSPAN_COUNT}" class="text-center text-muted small p-2 bg-light">... มีข้อมูลอีก ${logs.length - 100} รายการ (กรุณากด Export Data เพื่อดูทั้งหมด) ...</td></tr>`;
    }
}

// --- Helper Functions ---
function autoSetDates() { const p = document.getElementById('filterPeriod').value; const t = new Date(); let s, e; if(p==='today'){s=e=t;}else if(p==='this_month'){s=new Date(t.getFullYear(),t.getMonth(),1);e=new Date(t.getFullYear(),t.getMonth()+1,0);}else if(p==='this_year'){s=new Date(t.getFullYear(),0,1);e=new Date(t.getFullYear(),11,31);} if(s){document.getElementById('filterStartDate').value=s.toISOString().split('T')[0]; document.getElementById('filterEndDate').value=e.toISOString().split('T')[0];} }
function renderLifetimeStats() { const logs = DB.getLogs(); document.getElementById('lifetimeTotalCount').innerText = logs.length.toLocaleString(); }
function exportReport(mode) { exportCSV(); }
function exportCSV() { 
    const filteredLogs = filterLogs(allLogs, getFilterParams());
    if (filteredLogs.length === 0) { alert("ไม่พบข้อมูล Log ตามเงื่อนไขที่เลือก"); return; }
    
    const headers = ["ลำดับ", "วันที่", "เวลาเข้า", "เวลาออก", "ผู้ใช้ / ID", "คณะ / สังกัด", "PC ที่ใช้", "AI/Software ที่ใช้", "สถานะ", "ระยะเวลา (นาที)", "ความพึงพอใจ (Score)"];
    const csvRows = filteredLogs.map((log, index) => {
        const startTimeStr = log.startTime ? formatExportDateTime(log.startTime) : formatExportDateTime(log.timestamp);
        const endTimeStr = formatExportDateTime(log.timestamp);
        const userNameDisplay = log.userName || log.userId || '';
        const userFaculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '');
        const pcName = `PC-${log.pcId || 'N/A'}`;
        const softwareList = formatSoftwareForCSV(log.usedSoftware);
        let statusText = log.action;
        if (log.action === 'START_SESSION') statusText = 'Check in'; else if (log.action === 'END_SESSION') statusText = 'Check out';
        const durationMinutes = log.durationMinutes ? log.durationMinutes.toFixed(0) : '';
        const satisfactionScore = log.satisfactionScore !== undefined ? log.satisfactionScore : '';
        return [`"${index + 1}"`, `"${endTimeStr.split(' ')[0]}"`, `"${startTimeStr.split(' ')[1]}"`, `"${endTimeStr.split(' ')[1]}"`, `"${userNameDisplay}"`, `"${userFaculty}"`, `"${pcName}"`, `"${softwareList}"`, `"${statusText}"`, `"${durationMinutes}"`, `"${satisfactionScore}"`].join(',');
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.setAttribute('href', URL.createObjectURL(blob)); link.setAttribute('download', `Usage_Report_${new Date().toISOString().slice(0, 10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
function processImportCSV(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { parseAndSaveCSV(e.target.result); };
    reader.readAsText(file);
    inputElement.value = '';
}
function parseAndSaveCSV(csvText) {
    const lines = csvText.split(/\r\n|\n/);
    if (lines.length < 2) { alert("รูปแบบไฟล์ไม่ถูกต้อง"); return; }
    let successCount = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const columns = parseCSVLine(line);
        if (columns.length < 11) continue;
        const dateStr = columns[1];
        const timeOutStr = columns[3];
        const timestamp = convertToISO(dateStr, timeOutStr);
        let softwareArr = [];
        let cleanSoftwareStr = columns[7].replace(/^"|"$/g, '');
        if (cleanSoftwareStr && cleanSoftwareStr !== '-') softwareArr = cleanSoftwareStr.split(';').map(s => s.trim());
        const newLog = {
            action: 'Imported Log', timestamp: timestamp, startTime: convertToISO(dateStr, columns[2]),
            userName: columns[4], userId: columns[4], userFaculty: columns[5],
            userRole: 'student', pcId: columns[6].replace("PC-", "").trim(),
            usedSoftware: softwareArr, durationMinutes: parseInt(columns[9]) || 0, satisfactionScore: parseInt(columns[10]) || null
        };
        DB.saveLog(newLog); successCount++;
    }
    alert(`✅ นำเข้าข้อมูลสำเร็จ ${successCount} รายการ`); location.reload();
}
function parseCSVLine(text) { const result = []; let start = 0; let inQuotes = false; for (let i = 0; i < text.length; i++) { if (text[i] === '"') inQuotes = !inQuotes; else if (text[i] === ',' && !inQuotes) { result.push(text.substring(start, i)); start = i + 1; } } result.push(text.substring(start)); return result; }
function convertToISO(dateStr, timeStr) { if (!dateStr || dateStr === '-') return new Date().toISOString(); try { const [day, month, year] = dateStr.split('/'); let jsYear = parseInt(year); if (jsYear > 2400) jsYear -= 543; const timePart = (timeStr && timeStr !== '-') ? timeStr : "00:00:00"; return new Date(`${jsYear}-${month}-${day}T${timePart}`).toISOString(); } catch (e) { return new Date().toISOString(); } }
function formatDateForInput(date) { return date.toISOString().split('T')[0]; }
function formatDateStr(date) { return date.toISOString().split('T')[0]; }
function formatExportDateTime(isoString) { if (!isoString) return ''; const date = new Date(isoString); return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function formatSoftwareForCSV(softwareArray) { if (!Array.isArray(softwareArray) || softwareArray.length === 0) return ''; return softwareArray.join('; '); }
function getSatisfactionDisplay(score) { if (!score) return '-'; const c = score>=4?'success':(score>=2?'warning text-dark':'danger'); return `<span class="badge bg-${c}"><i class="bi bi-star-fill"></i> ${score}</span>`; }