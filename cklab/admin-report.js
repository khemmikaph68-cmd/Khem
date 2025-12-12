/* admin-report.js (Updated: รายชื่อคณะ/หน่วยงานฉบับสมบูรณ์) */

// Global variables
let monthlyFacultyChartInstance, monthlyOrgChartInstance;
let pieChartInstance, pcAvgChartInstance, satisfactionChartInstance; 
let allLogs; 

// ✅ 1. รายชื่อคณะ (Faculty List)
const FACULTY_LIST = [
    "คณะวิทยาศาสตร์",
    "คณะเกษตรศาสตร์",
    "คณะวิศวกรรมศาสตร์",
    "คณะศิลปศาสตร์",
    "คณะเภสัชศาสตร์",
    "คณะบริหารศาสตร์",
    "คณะพยาบาลศาสตร์",
    "วิทยาลัยแพทยศาสตร์และการสาธารณสุข",
    "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์",
    "คณะนิติศาสตร์",
    "คณะรัฐศาสตร์",
    "คณะศึกษาศาสตร์"
];

// ✅ 2. รายชื่อหน่วยงาน (Organization List)
const ORG_LIST = [
    "สำนักคอมพิวเตอร์และเครือข่าย",
    "สำนักบริหารทรัพย์สินและสิทธิประโยชน์",
    "สำนักวิทยบริการ",
    "กองกลาง",
    "กองแผนงาน",
    "กองคลัง",
    "กองบริการการศึกษา",
    "กองการเจ้าหน้าที่",
    "สำนักงานส่งเสริมและบริหารงานวิจัย ฯ",
    "สำนักงานพัฒนานักศึกษา",
    "สำนักงานบริหารกายภาพและสิ่งแวดล้อม",
    "สำนักงานวิเทศสัมพันธ์",
    "สำนักงานกฏหมายและนิติการ",
    "สำนักงานตรวจสอบภายใน",
    "สำนักงานรักษาความปลอดภัย",
    "สภาอาจารย์",
    "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี",
    "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี",
    "ศูนย์การจัดการความรู้ (KM)",
    "ศูนย์การเรียนรู้และพัฒนา \"งา\" เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน",
    "สถานปฏิบัติการโรงแรมฯ (U-Place)",
    "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง ฯ",
    "ศูนย์เครื่องมือวิทยาศาสตร์",
    "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี"
];

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        // window.location.href = 'admin-login.html';
    }
    
    allLogs = DB.getLogs(); 
    populateFilterOptions(allLogs); // สร้างตัวเลือก Dropdown
    
    // ตั้งค่าวันเป็นเดือนนี้อัตโนมัติ
    autoSetDates();
    renderLifetimeStats(); 
    initializeReports(allLogs); 
});

// ==========================================
// 0. FILTER LOGIC & INITIALIZATION
// ==========================================

function populateFilterOptions(logs) {
    const faculties = new Set();
    const organizations = new Set();
    const levels = new Set();
    const years = new Set();
    
    const sortThai = (a, b) => String(a).localeCompare(String(b), 'th');
    const sortNum = (a, b) => parseInt(a) - parseInt(b);

    // 1. เพิ่มรายชื่อจาก Master List (เพื่อให้มีตัวเลือกครบถ้วนแม้ยังไม่มี Log)
    FACULTY_LIST.forEach(f => faculties.add(f));
    ORG_LIST.forEach(o => organizations.add(o));

    // 2. เติมข้อมูลเพิ่มจาก Log (เผื่อมีชื่อใหม่ๆ หรือการสะกดที่ต่างไป)
    logs.forEach(log => {
        const uFac = log.userFaculty;
        if (uFac && uFac !== "บุคคลภายนอก" && uFac !== "ไม่ระบุสังกัด") {
            // เช็คว่ามีในรายการหลักหรือยัง ถ้าไม่มีให้เพิ่มตาม Logic เดิม
            if (!faculties.has(uFac) && !organizations.has(uFac)) {
                if (uFac.startsWith("คณะ") || uFac.startsWith("วิทยาลัย")) {
                    faculties.add(uFac);
                } else {
                    organizations.add(uFac);
                }
            }
        }
        
        if (log.userLevel) levels.add(log.userLevel);
        if (log.userYear && log.userYear !== '-') years.add(log.userYear);
    });

    // 3. สร้าง Dropdown
    populateSelect('filterFaculty', faculties, sortThai);
    populateSelect('filterOrganization', organizations, sortThai);
    populateSelect('filterLevel', levels, sortThai);
    populateSelect('filterYear', years, sortNum);
}

function populateSelect(id, set, sortFn) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    Array.from(set).sort(sortFn).forEach(val => {
        select.innerHTML += `<option value="${val}">${val}</option>`;
    });
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

function applyFilters() {
    const params = getFilterParams();
    const filteredLogs = filterLogs(allLogs, params);
    initializeReports(filteredLogs); 
    console.log(`Reports updated with ${filteredLogs.length} logs.`);
}

function clearFilters() {
    document.getElementById('reportFilterForm').reset();
    autoSetDates();
    initializeReports(allLogs);
}

function filterLogs(logs, params) {
    let filtered = logs;
    const { startDate, endDate, faculty, organization, userType, level, year } = params;
    
    // Date Range
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start.getTime());
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end.getTime());
    }

    // Faculty & Organization
    if (faculty) filtered = filtered.filter(log => log.userFaculty === faculty);
    if (organization) filtered = filtered.filter(log => log.userFaculty === organization);
    
    // User Type
    if (userType) {
        if (userType === 'Internal') filtered = filtered.filter(log => log.userRole === 'student' || log.userRole === 'staff');
        else if (userType === 'External') filtered = filtered.filter(log => log.userRole === 'external');
    }

    // Level & Year
    if (level) filtered = filtered.filter(log => log.userLevel === level);
    if (year) filtered = filtered.filter(log => log.userYear === year);

    return filtered;
}

// ==========================================
// 1. CHARTS & RENDER
// ==========================================

function initializeReports(logs) {
    // Destroy old charts
    if (monthlyFacultyChartInstance) monthlyFacultyChartInstance.destroy();
    if (monthlyOrgChartInstance) monthlyOrgChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();
    if (pcAvgChartInstance) pcAvgChartInstance.destroy();
    if (satisfactionChartInstance) satisfactionChartInstance.destroy();
    
    renderLogHistory(logs); 

    const statsLogs = logs.filter(l => l.action === 'END_SESSION'); 
    if (statsLogs.length === 0) return;

    const processedData = processLogs(statsLogs);
    
    monthlyFacultyChartInstance = drawMonthlyChart(processedData.monthlyFacultyData, 'monthlyFacultyChart', 'คณะ/วิทยาลัย');
    monthlyOrgChartInstance = drawMonthlyChart(processedData.monthlyOrgData, 'monthlyOrgChart', 'หน่วยงาน');
    pieChartInstance = drawAIUsagePieChart(processedData.aiUsageData); 
    pcAvgChartInstance = drawPCAvgTimeChart(processedData.pcAvgTimeData);
    satisfactionChartInstance = drawSatisfactionChart(processedData.satisfactionData);
}

function processLogs(filteredStatsLogs) {
    const monthlyFacultyData = {};
    const monthlyOrgData = {};
    const aiUsageData = { ai: 0, nonAI: 0 };
    const pcUsageMap = new Map();
    const satisfactionData = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0 };

    filteredStatsLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const monthYear = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
        const faculty = log.userFaculty || 'Unknown';
        const duration = log.durationMinutes || 0;
        const pcId = log.pcId || 'Unknown';
        
        // แยกข้อมูลลงกราฟ 2 ชุด (ใช้ Logic เดิม + รายชื่อใหม่)
        // ถ้าอยู่ในรายการ FACULTY_LIST หรือขึ้นต้นด้วย คณะ/วิทยาลัย
        if (FACULTY_LIST.includes(faculty) || faculty.startsWith("คณะ") || faculty.startsWith("วิทยาลัย")) {
            if (!monthlyFacultyData[monthYear]) monthlyFacultyData[monthYear] = {};
            monthlyFacultyData[monthYear][faculty] = (monthlyFacultyData[monthYear][faculty] || 0) + 1;
        } else {
            // ที่เหลือลงหน่วยงาน (ยกเว้น Guest)
            if (faculty !== "บุคคลภายนอก" && faculty !== "ไม่ระบุสังกัด") {
                if (!monthlyOrgData[monthYear]) monthlyOrgData[monthYear] = {};
                monthlyOrgData[monthYear][faculty] = (monthlyOrgData[monthYear][faculty] || 0) + 1;
            }
        }

        // AI Usage
        if (log.isAIUsed) aiUsageData.ai++;
        else aiUsageData.nonAI++;

        // PC Avg Time
        if (!pcUsageMap.has(pcId)) pcUsageMap.set(pcId, { totalDuration: 0, count: 0 });
        pcUsageMap.get(pcId).totalDuration += duration;
        pcUsageMap.get(pcId).count++;

        // Satisfaction
        if (log.satisfactionScore) {
            const score = parseInt(log.satisfactionScore);
            if (score >= 1 && score <= 5) {
                satisfactionData[score]++;
                satisfactionData.total++;
            }
        }
    });

    const pcAvgTimeData = Array.from(pcUsageMap.entries()).map(([pcId, data]) => ({
        pcId: `PC-${pcId}`,
        avgTime: (data.totalDuration / data.count).toFixed(1)
    }));

    return { monthlyFacultyData, monthlyOrgData, aiUsageData, pcAvgTimeData, satisfactionData };
}

const CHART_COLORS = [
    'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 
    'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)', 'rgba(83, 109, 254, 0.8)', 'rgba(255, 99, 71, 0.8)'
];

function drawMonthlyChart(data, canvasId, labelPrefix) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const labels = Object.keys(data).sort((a, b) => new Date(a) - new Date(b)); 
    const allGroups = Array.from(new Set(Object.values(data).flatMap(Object.keys)));
    
    const datasets = allGroups.map((group, index) => {
        return {
            label: group,
            data: labels.map(month => data[month][group] || 0),
            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
            stack: 'Stack 0',
        };
    });

    return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, title: { display: true, text: 'เดือน' } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'จำนวนครั้ง' } }
            },
            plugins: { 
                legend: { display: allGroups.length > 0 && allGroups.length < 20, position: 'bottom' }
            }
        }
    });
}

function drawSatisfactionChart(data) {
    const ctx = document.getElementById('satisfactionChart').getContext('2d');
    const total = data.total || 1; 
    
    const p1 = ((data[1]/total)*100).toFixed(1);
    const p2 = ((data[2]/total)*100).toFixed(1);
    const p3 = ((data[3]/total)*100).toFixed(1);
    const p4 = ((data[4]/total)*100).toFixed(1);
    const p5 = ((data[5]/total)*100).toFixed(1);

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`1 ดาว (${p1}%)`, `2 ดาว (${p2}%)`, `3 ดาว (${p3}%)`, `4 ดาว (${p4}%)`, `5 ดาว (${p5}%)`],
            datasets: [{
                data: [data[1], data[2], data[3], data[4], data[5]],
                backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#198754'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                title: { display: true, text: `รวม ${data.total} ความเห็น` }
            }
        }
    });
}

function drawAIUsagePieChart(data) {
    const ctx = document.getElementById('aiUsagePieChart').getContext('2d');
    const total = data.ai + data.nonAI || 1;
    
    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [`ใช้งาน AI (${((data.ai/total)*100).toFixed(1)}%)`, `ใช้งานทั่วไป (${((data.nonAI/total)*100).toFixed(1)}%)`],
            datasets: [{
                data: [data.ai, data.nonAI],
                backgroundColor: ['#42A5F5', '#FF6384'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function drawPCAvgTimeChart(data) {
    const ctx = document.getElementById('pcAvgTimeChart').getContext('2d');
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.pcId),
            datasets: [{
                label: 'นาที/ครั้ง',
                data: data.map(d => d.avgTime),
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// ==========================================
// 2. HELPER & UTILITIES
// ==========================================

function autoSetDates() {
    const period = document.getElementById('filterPeriod').value;
    const today = new Date();
    let start, end;

    switch(period) {
        case 'today': start = end = today; break;
        case 'this_month': 
            start = new Date(today.getFullYear(), today.getMonth(), 1); 
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
            break;
        case 'this_year': 
            start = new Date(today.getFullYear(), 0, 1); 
            end = new Date(today.getFullYear(), 11, 31); 
            break;
        default: return; 
    }
    document.getElementById('filterStartDate').value = formatDateForInput(start);
    document.getElementById('filterEndDate').value = formatDateForInput(end);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDateStr(date) {
    return date.toISOString().split('T')[0];
}

function exportReport(mode) {
    const today = new Date();
    let startDate, endDate, fileNamePrefix;

    switch(mode) {
        case 'daily':
            startDate = endDate = new Date(today);
            fileNamePrefix = `Daily_Report_${formatDateStr(today)}`;
            break;
        case 'monthly':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            fileNamePrefix = `Monthly_Report_${today.getFullYear()}_${today.getMonth()+1}`;
            break;
        case 'quarterly':
            const q = Math.floor(today.getMonth() / 3);
            startDate = new Date(today.getFullYear(), q * 3, 1);
            endDate = new Date(today.getFullYear(), (q * 3) + 3, 0);
            fileNamePrefix = `Quarterly_Report_${today.getFullYear()}_Q${q+1}`;
            break;
        case 'yearly':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            fileNamePrefix = `Yearly_Report_${today.getFullYear()}`;
            break;
        default: exportCSV(); return;
    }
    generateCSV(startDate, endDate, fileNamePrefix);
}

function renderLifetimeStats() {
    const allLogs = DB.getLogs();
    const total = allLogs.length;
    let internalCount = 0;
    let externalCount = 0;
    allLogs.forEach(log => {
        if (log.userRole === 'external' || log.userRole === 'Guest') {
            externalCount++;
        } else {
            internalCount++;
        }
    });
    document.getElementById('lifetimeTotalCount').innerText = total.toLocaleString();
    document.getElementById('lifetimeInternal').innerText = internalCount.toLocaleString();
    document.getElementById('lifetimeExternal').innerText = externalCount.toLocaleString();
    const intPercent = total > 0 ? (internalCount / total) * 100 : 0;
    const extPercent = total > 0 ? (externalCount / total) * 100 : 0;
    document.getElementById('progInternal').style.width = `${intPercent}%`;
    document.getElementById('progExternal').style.width = `${extPercent}%`;
}

function generateCSV(startDateObj, endDateObj, fileNamePrefix) {
    const allLogs = DB.getLogs();
    const filteredLogs = allLogs.filter(log => {
        const logDate = new Date(log.timestamp).setHours(0,0,0,0);
        return logDate >= startDateObj.setHours(0,0,0,0) && 
               logDate <= endDateObj.setHours(0,0,0,0);
    });

    if (filteredLogs.length === 0) {
        alert('ไม่พบข้อมูลในช่วงเวลาดังกล่าว');
        return;
    }

    let csvContent = "ลำดับ,วันที่,เวลาเข้า,เวลาออก,ชื่อผู้ใช้,รหัส/ID,คณะ/หน่วยงาน,ประเภท,PC ID,Software/AI ที่ใช้,ระยะเวลา(นาที),ความพึงพอใจ\n";

    filteredLogs.forEach((log, index) => {
        const dateStr = new Date(log.timestamp).toLocaleDateString('th-TH');
        const timeIn = log.startTime ? new Date(log.startTime).toLocaleTimeString('th-TH') : '-';
        const timeOut = new Date(log.timestamp).toLocaleTimeString('th-TH');
        let swStr = (log.usedSoftware && log.usedSoftware.length > 0) ? log.usedSoftware.join('; ') : "-";
        const clean = (text) => text ? String(text).replace(/,/g, " ") : "-";

        const row = [
            index + 1, dateStr, timeIn, timeOut, clean(log.userName), clean(log.userId), clean(log.userFaculty),
            clean(getUserType(log)), clean(log.pcId), `"${swStr}"`, log.durationMinutes || 0, log.satisfactionScore || "-"
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileNamePrefix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCSV() {
    const filteredLogs = filterLogs(allLogs, getFilterParams());
    if (filteredLogs.length === 0) {
        alert("ไม่พบข้อมูล Log ตามเงื่อนไขที่เลือกสำหรับดาวน์โหลด");
        return;
    }
    const headers = ["ลำดับ", "วันที่", "เวลาเข้า", "เวลาออก", "ผู้ใช้ / ID", "คณะ / สังกัด", "PC ที่ใช้", "AI/Software ที่ใช้", "สถานะ", "ระยะเวลา (นาที)", "ความพึงพอใจ (Score)"];
    const csvRows = filteredLogs.map((log, index) => {
        const startTimeStr = log.startTime ? formatExportDateTime(log.startTime) : formatExportDateTime(log.timestamp);
        const endTimeStr = formatExportDateTime(log.timestamp);
        const userNameDisplay = log.userName || log.userId || '';
        const userFaculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '');
        const pcName = `PC-${log.pcId || 'N/A'}`;
        const softwareList = formatSoftwareForCSV(log.usedSoftware);
        let statusText = log.action;
        if (log.action === 'START_SESSION') statusText = 'Check in';
        else if (log.action === 'END_SESSION') statusText = 'Check out';
        else if (!statusText) statusText = 'Undefined';
        const durationMinutes = log.durationMinutes ? log.durationMinutes.toFixed(0) : '';
        const satisfactionScore = log.satisfactionScore !== undefined ? log.satisfactionScore : '';
        return [`"${index + 1}"`, `"${endTimeStr.split(' ')[0]}"`, `"${startTimeStr.split(' ')[1]}"`, `"${endTimeStr.split(' ')[1]}"`, `"${userNameDisplay}"`, `"${userFaculty}"`, `"${pcName}"`, `"${softwareList}"`, `"${statusText}"`, `"${durationMinutes}"`, `"${satisfactionScore}"`].join(',');
    });
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Usage_Report_Filtered_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert(`✅ ดาวน์โหลดไฟล์ CSV ${filteredLogs.length} รายการ เรียบร้อยแล้ว`);
    }
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
    if (lines.length < 2) {
        alert("ไฟล์ CSV ว่างเปล่าหรือรูปแบบไม่ถูกต้อง");
        return;
    }

    let successCount = 0;
    
    // เริ่มที่ i=1 เพื่อข้าม Header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = parseCSVLine(line);
        // เช็คว่ามีอย่างน้อย 11 คอลัมน์ (ตาม Format Export ปัจจุบัน)
        if (columns.length < 11) continue; 

        // Mapping ข้อมูลให้ตรงกับ Export Format
        // [0]ลำดับ, [1]วันที่, [2]เวลาเข้า, [3]เวลาออก, [4]ผู้ใช้/ID, [5]คณะ, [6]PC, [7]Software, [8]สถานะ, [9]นาที, [10]คะแนน

        const dateStr = columns[1];      // YYYY-MM-DD
        const timeInStr = columns[2];    // HH:mm
        const timeOutStr = columns[3];   // HH:mm
        
        // แปลงวันที่ (รองรับทั้ง YYYY-MM-DD และ DD/MM/YYYY)
        const timestamp = convertToISO(dateStr, timeOutStr);
        const startTime = convertToISO(dateStr, timeInStr);

        // แกะ PC ID (ลบคำว่า "PC-" ออก)
        let pcIdRaw = columns[6] || "";
        let pcIdClean = pcIdRaw.replace("PC-", "").trim();

        // แกะ Software
        let softwareArr = [];
        let cleanSoftwareStr = columns[7].replace(/^"|"$/g, '');
        if (cleanSoftwareStr && cleanSoftwareStr !== '-') {
            softwareArr = cleanSoftwareStr.split(';').map(s => s.trim());
        }

        // กำหนด User Role คร่าวๆ จากคณะ
        let userFaculty = columns[5];
        let userRole = 'student'; // Default
        if (userFaculty === 'บุคคลภายนอก' || userFaculty === 'External') userRole = 'external';
        else if (userFaculty.includes('สำนัก') || userFaculty.includes('กอง')) userRole = 'staff';

        const newLog = {
            action: 'Imported Log',
            timestamp: timestamp,
            startTime: startTime,
            
            userName: columns[4], // ใช้ช่องรวมชื่อ/ID ใส่ไปก่อน
            userId: columns[4],   // (เนื่องจาก Export รวมช่องมา)
            userFaculty: userFaculty,
            userRole: userRole,
            
            pcId: pcIdClean,
            pcName: pcIdRaw, // เก็บชื่อเต็มไว้ด้วย
            
            usedSoftware: softwareArr,
            isAIUsed: softwareArr.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('gpt')),
            
            durationMinutes: parseInt(columns[9]) || 0,
            satisfactionScore: parseInt(columns[10]) || null
        };

        DB.saveLog(newLog);
        successCount++;
    }

    alert(`✅ นำเข้าข้อมูลสำเร็จ ${successCount} รายการ`);
    location.reload(); 
}

// Helper: รองรับวันที่ทั้ง 2 แบบ (YYYY-MM-DD จาก Export และ DD/MM/YYYY แบบไทย)
function convertToISO(dateStr, timeStr) {
    if (!dateStr || dateStr === '-') return new Date().toISOString();
    
    // ตั้งค่าเวลา Default
    let timePart = (timeStr && timeStr !== '-') ? timeStr : "00:00:00";
    if (timePart.length === 5) timePart += ":00"; // เติมวินาทีถ้าไม่มี

    try {
        let day, month, year;

        if (dateStr.includes('-')) {
            // กรณี YYYY-MM-DD (จากไฟล์ Export)
            [year, month, day] = dateStr.split('-');
        } else if (dateStr.includes('/')) {
            // กรณี DD/MM/YYYY (เผื่อไฟล์จากแหล่งอื่น)
            [day, month, year] = dateStr.split('/');
            // แปลง พ.ศ. -> ค.ศ.
            if (parseInt(year) > 2400) year = parseInt(year) - 543;
        }

        return new Date(`${year}-${month}-${day}T${timePart}`).toISOString();
    } catch (e) {
        console.error("Date Parse Error", e);
        return new Date().toISOString();
    }
}
function parseCSVLine(text) {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') inQuotes = !inQuotes;
        else if (text[i] === ',' && !inQuotes) {
            result.push(text.substring(start, i));
            start = i + 1;
        }
    }
    result.push(text.substring(start));
    return result;
}

function convertToISO(dateStr, timeStr) {
    if (!dateStr || dateStr === '-') return new Date().toISOString();
    try {
        const [day, month, year] = dateStr.split('/');
        let jsYear = parseInt(year);
        if (jsYear > 2400) jsYear -= 543;
        const timePart = (timeStr && timeStr !== '-') ? timeStr : "00:00:00";
        return new Date(`${jsYear}-${month}-${day}T${timePart}`).toISOString();
    } catch (e) { return new Date().toISOString(); }
}

function getUserType(log) {
    if (log.userRole === 'external' || log.userRole === 'Guest') return 'External';
    return 'Internal';
}

function formatExportDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
           date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatSoftwareForCSV(softwareArray) {
    if (!Array.isArray(softwareArray) || softwareArray.length === 0) return '';
    return softwareArray.join('; ');
}

function getSatisfactionDisplay(score) {
    if (score === undefined || score === null) return '<span class="text-muted">-</span>';
    const scoreNum = parseFloat(score);
    if (scoreNum >= 4) return `<span class="badge bg-success fw-bold"><i class="bi bi-star-fill"></i> ${score}</span>`;
    else if (scoreNum >= 2) return `<span class="badge bg-warning text-dark"><i class="bi bi-star-half"></i> ${score}</span>`;
    else return `<span class="badge bg-danger"><i class="bi bi-star"></i> ${score}</span>`;
}

function formatLogDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString); 
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatLogTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString); 
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function renderLogHistory(logs) {
    const tbody = document.getElementById('logHistoryTableBody');
    const COLSPAN_COUNT = 10;
    if (!tbody) return;
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="text-center text-muted p-4">ไม่พบข้อมูลประวัติการใช้งาน</td></tr>`;
        return;
    }
    const sortedLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    tbody.innerHTML = sortedLogs.map((log, index) => {
        const displayNameOrId = log.userName || log.userId || 'N/A';
        const displayFaculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : 'ไม่ระบุสังกัด');
        const userNameDisplay = `<span class="fw-bold text-dark">${displayNameOrId}</span><br><span class="small text-muted">${displayFaculty}</span>`;
        let statusText = log.action || 'Undefined';
        let statusClass = 'bg-secondary';
        let rowClass = '';
        switch(log.action) {
            case 'START_SESSION': statusText = 'Check in'; statusClass = 'bg-primary'; rowClass = 'table-info bg-opacity-10'; break;
            case 'END_SESSION': statusText = 'Check out'; statusClass = 'bg-success'; rowClass = 'table-success bg-opacity-10'; break;
            case 'Admin Check-in': statusText = 'Admin Check-in'; statusClass = 'bg-warning text-dark'; rowClass = 'table-warning bg-opacity-10'; break;
            case 'Force Check-out': statusText = 'Force Check-out'; statusClass = 'bg-danger'; rowClass = 'table-danger bg-opacity-10'; break;
            default: statusClass = 'bg-secondary'; statusText = log.action;
        }
        let softUsedDisplay = '<span class="text-muted">-</span>';
        if (Array.isArray(log.usedSoftware) && log.usedSoftware.length > 0) {
            softUsedDisplay = log.usedSoftware.map(s => {
                let isAI = s.toLowerCase().includes('gpt') || s.toLowerCase().includes('ai') || s.toLowerCase().includes('gemini');
                let color = isAI ? 'bg-info text-dark border-info' : 'bg-light text-dark border';
                return `<span class="badge ${color} border fw-normal mb-1 me-1">${s}</span>`;
            }).join('');
        }
        const startTime = log.startTime || log.timestamp;
        const endTime = log.timestamp;
        const durationText = log.durationMinutes ? `${log.durationMinutes.toFixed(0)} min` : '-';
        const satisfactionScoreDisplay = getSatisfactionDisplay(log.satisfactionScore);
        return `<tr class="${rowClass}"><td class="text-center">${index + 1}</td><td class="small text-nowrap">${formatLogDate(endTime)}</td><td class="small text-nowrap">${formatLogTime(startTime)}</td><td class="small text-nowrap">${formatLogTime(endTime)}</td><td>${userNameDisplay}</td><td><span class="badge bg-dark fw-normal">PC-${log.pcId || '-'}</span></td><td>${softUsedDisplay}</td><td><span class="badge ${statusClass} fw-normal">${statusText}</span></td><td class="text-end text-nowrap">${durationText}</td><td class="text-center">${satisfactionScoreDisplay}</td></tr>`;
    }).join('');
}