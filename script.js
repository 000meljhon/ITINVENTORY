// --- STATE MANAGEMENT ---
const SUPABASE_URL = "https://jisseeedzregpbqofjpy.supabase.co";
const SUPABASE_KEY = "sb_publishable_mtP0t5oSYN_qe-tL-1qrHw_RNFMhtBK";

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'bbmi-portal-auth-token',
        flowType: 'pkce' // <--- REQUIRED for secure Vercel / production environments
    }
});

let inventory = [
    { id: 'BBSI-LAP-001', category: 'Laptop', model: 'Dell Latitude 5430', serial: 'DL5430-99281', department: 'Cluster 1', status: 'Deployed', assignee: 'John Doe', prevOwner: 'Jane Smith' },
    { id: 'BBSI-MON-001', category: 'Monitor', model: 'Dell 24" P2422H', serial: 'MON-883721', department: 'Admin', status: 'Available', assignee: '-', prevOwner: 'Accounting Pool' },
    { id: 'BBSI-ACC-001', category: 'Mouse & Keyboard', model: 'Logitech MK295 Silent', serial: 'KBMS-44102', department: 'IT', status: 'Available', assignee: '-', prevOwner: '-' }
];

let clientDevices = [
    { clientName: 'Momentum', category: 'Laptop', model: 'Lenovo ThinkPad T14 Gen 3', serial: 'LNV-MOM-8812', status: 'Ready for Deployment', remarks: 'Configured with standard corporate image' },
    { clientName: 'Momentum', category: 'Desktop', model: 'HP ProDesk 600 G6', serial: 'HP-MOM-3321', status: 'Active On-Site Spare', remarks: 'Assigned to main floor backup pool' },
    { clientName: 'Marsh', category: 'Laptop', model: 'Dell Latitude 5530', serial: 'DL-MARSH-9012', status: 'Ready for Deployment', remarks: 'Fresh Windows 11 Pro install' },
    { clientName: 'Marsh', category: 'Peripherals', model: 'Logitech Wireless Combo MK295', serial: 'ACC-MARSH-441', status: 'Ready for Deployment', remarks: 'In IT storage box #2' },
    { clientName: 'Contour', category: 'Tablet', model: 'Microsoft Surface Pro 9', serial: 'SURF-CNT-1102', status: 'Active On-Site Spare', remarks: 'Executive emergency backup unit' },
    { clientName: 'Contour', category: 'Laptop', model: 'Lenovo ThinkPad X1 Carbon', serial: 'LNV-CNT-7734', status: 'Decommissioned / RMA', remarks: 'Pending motherboard replacement' }
];

let currentTab = 'internal';
let selectedClientFilter = 'All';

// --- AUTHENTICATION CHECK ---
if (localStorage.getItem('bbsi_authenticated') !== 'true') {
    window.location.href = 'login.html';
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    renderInternalInventory();
    renderClientDevices();
    lucide.createIcons();

    // Event Listeners for Live Searching
    document.getElementById('searchInput').addEventListener('input', (e) => renderInternalInventory(e.target.value));
    document.getElementById('clientSearchInput').addEventListener('input', (e) => renderClientDevices(e.target.value));
});

// Export Function for Management Report
        function exportToExcel() {
            const activeTab = document.getElementById('navInternalBtn').classList.contains('bg-indigo-600') ? 'Internal_Inventory' : 'Client_Spare_Devices';
            const table = document.querySelector('table');
            
            if (!table) {
                alert('No table data available to export.');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            const rows = table.querySelectorAll('tr');
            
            rows.forEach(row => {
                let cols = row.querySelectorAll('th, td');
                let rowData = [];
                cols.forEach(col => {
                    let text = col.innerText.replace(/(\r\n|\n|\r)/gm, "").trim();
                    rowData.push('"' + text + '"');
                });
                csvContent += rowData.join(",") + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `BBSI_${activeTab}_Report_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

async function handleLogout() {
    try {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
    } catch (err) {
        console.error("Sign out error:", err);
    } finally {
        // FIX: Clear the flag on logout
        localStorage.removeItem('bbsi_authenticated');
        window.location.href = 'login.html';
    }
}

// --- TAB SWITCHING LOGIC ---
function switchTab(tab) {
    currentTab = tab;
    const internalView = document.getElementById('internalView');
    const clientView = document.getElementById('clientView');
    const navInternalBtn = document.getElementById('navInternalBtn');
    const navClientBtn = document.getElementById('navClientBtn');
    const mobileInternalBtn = document.getElementById('mobileInternalBtn');
    const mobileClientBtn = document.getElementById('mobileClientBtn');
    const btnAddText = document.getElementById('btnAddText');

    if (tab === 'internal') {
        internalView.classList.remove('hidden');
        clientView.classList.add('hidden');
        
        navInternalBtn.className = "px-4 py-1.5 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white shadow";
        navClientBtn.className = "px-4 py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-slate-200";
        mobileInternalBtn.className = "px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white";
        mobileClientBtn.className = "px-3 py-1 rounded text-xs font-semibold text-slate-400";
        btnAddText.innerText = "Add New Device";
    } else {
        internalView.classList.add('hidden');
        clientView.classList.remove('hidden');
        
        navClientBtn.className = "px-4 py-1.5 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white shadow";
        navInternalBtn.className = "px-4 py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-slate-200";
        mobileClientBtn.className = "px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white";
        mobileInternalBtn.className = "px-3 py-1 rounded text-xs font-semibold text-slate-400";
        btnAddText.innerText = "Register Client Spare";
    }
}

// --- MODAL CONTROLS ---
function openModal() {
    if (currentTab === 'internal') {
        document.getElementById('deviceModal').classList.remove('hidden');
    } else {
        document.getElementById('clientModal').classList.remove('hidden');
    }
}

function closeModal() {
    document.getElementById('deviceModal').classList.add('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.add('hidden');
}

function closeEditClientModal() {
    document.getElementById('editClientModal').classList.add('hidden');
}

// --- RENDER INTERNAL INVENTORY ---
function renderInternalInventory(searchQuery = '') {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';

    const categories = ['Laptop', 'Monitor', 'Mouse & Keyboard', 'Headset'];
    let categoryCounts = { Laptop: 0, Monitor: 0, 'Mouse & Keyboard': 0, Headset: 0 };
    let categoryTotals = { Laptop: 0, Monitor: 0, 'Mouse & Keyboard': 0, Headset: 0 };

    inventory.forEach(item => {
        if(categoryCounts[item.category] !== undefined) {
            categoryTotals[item.category]++;
            if(item.status === 'Available') categoryCounts[item.category]++;
        }
    });

    // Render Metrics Cards (4 columns)
    const metricsContainer = document.getElementById('categoryMetrics');
    metricsContainer.innerHTML = categories.map(cat => `
        <div class="bg-slate-800/50 border border-slate-700/60 backdrop-blur-md p-5 rounded-xl">
            <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">${cat}</p>
            <div class="flex items-baseline justify-between mt-2">
                <h3 class="text-2xl font-bold text-emerald-400">${categoryCounts[cat]}</h3>
                <span class="text-xs text-slate-400">Total: ${categoryTotals[cat]}</span>
            </div>
        </div>
    `).join('');

    // Filter and Render Table Rows
    const filtered = inventory.filter(item => {
        const query = searchQuery.toLowerCase();
        return item.id.toLowerCase().includes(query) ||
               item.model.toLowerCase().includes(query) ||
               item.serial.toLowerCase().includes(query) ||
               item.department.toLowerCase().includes(query) ||
               item.assignee.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500">No hardware devices found.</td></tr>`;
        return;
    }

    filtered.forEach((item, index) => {
        const statusColor = item.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            item.status === 'Deployed' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-4 font-mono font-medium text-xs text-indigo-300">${item.id}</td>
                <td class="p-4">${item.category}</td>
                <td class="p-4 font-medium">${item.model}</td>
                <td class="p-4 font-mono text-xs text-slate-400">${item.serial}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 border border-slate-700">${item.department}</span></td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-medium border ${statusColor}">${item.status}</span></td>
                <td class="p-4">${item.assignee}</td>
                <td class="p-4 text-slate-400">${item.prevOwner}</td>
                <td class="p-4 text-right">
                    <button onclick="openEditModal(${index})" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition">Change Status</button>
                </td>
            </tr>
        `;
    });
}

// --- RENDER CLIENT SPARE DEVICES ---
function renderClientDevices(searchQuery = '') {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = '';

    // Calculate metrics
    let totalClientSpares = clientDevices.length;
    let readyCount = clientDevices.filter(d => d.status === 'Ready for Deployment').length;
    let activeOrRmaCount = clientDevices.filter(d => d.status !== 'Ready for Deployment').length;

    document.getElementById('clientMetricTotal').innerText = totalClientSpares;
    document.getElementById('clientMetricReady').innerText = readyCount;
    document.getElementById('clientMetricActive').innerText = activeOrRmaCount;

    // Filter by Client Tab and Search Input
    const filtered = clientDevices.filter(item => {
        const matchesClient = selectedClientFilter === 'All' || item.clientName === selectedClientFilter;
        const query = searchQuery.toLowerCase();
        const matchesSearch = item.clientName.toLowerCase().includes(query) ||
                              item.model.toLowerCase().includes(query) ||
                              item.serial.toLowerCase().includes(query) ||
                              item.remarks.toLowerCase().includes(query);
        return matchesClient && matchesSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">No client spare devices found.</td></tr>`;
        return;
    }

    filtered.forEach((item, index) => {
        const statusColor = item.status === 'Ready for Deployment' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            item.status === 'Active On-Site Spare' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

        const clientBadgeColor = item.clientName === 'Momentum' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' :
                                 item.clientName === 'Marsh' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-semibold border ${clientBadgeColor}">${item.clientName}</span></td>
                <td class="p-4">${item.category}</td>
                <td class="p-4 font-medium">${item.model}</td>
                <td class="p-4 font-mono text-xs text-slate-400">${item.serial}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-medium border ${statusColor}">${item.status}</span></td>
                <td class="p-4 text-slate-400 text-xs">${item.remarks}</td>
                <td class="p-4 text-right">
                    <button onclick="openEditClientModal(${index})" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition">Edit Details</button>
                </td>
            </tr>
        `;
    });
}

function filterByClient(clientName) {
    selectedClientFilter = clientName;
    ['All', 'Momentum', 'Marsh', 'Contour'].forEach(c => {
        let btn = document.getElementById(`chip-${c}`);
        if(btn) {
            if(c === clientName) {
                btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow transition";
            } else {
                btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition";
            }
        }
    });
    renderClientDevices(document.getElementById('clientSearchInput').value);
}

// --- FORM SUBMISSIONS ---
function handleFormSubmit(event) {
    event.preventDefault();
    const category = document.getElementById('formCategory').value;
    const status = document.getElementById('formStatus').value;
    const department = document.getElementById('formDepartment').value;
    const model = document.getElementById('formModel').value;
    const serial = document.getElementById('formSerial').value;
    const assignee = document.getElementById('formAssignee').value;
    const prevOwner = document.getElementById('formPrevOwner').value;

    const prefixMap = { 'Laptop': 'LAP', 'Monitor': 'MON', 'Mouse & Keyboard': 'ACC', 'Headset': 'HSD' };
    const count = inventory.filter(i => i.category === category).length + 1;
    const newId = `BBSI-${prefixMap[category]}-${String(count).padStart(3, '0')}`;

    inventory.unshift({ id: newId, category, model, serial, department, status, assignee, prevOwner });
    closeModal();
    document.getElementById('deviceForm').reset();
    renderInternalInventory();
}

function handleClientFormSubmit(event) {
    event.preventDefault();
    const clientName = document.getElementById('formClientName').value;
    const category = document.getElementById('formClientCategory').value;
    const model = document.getElementById('formClientModel').value;
    const serial = document.getElementById('formClientSerial').value;
    const status = document.getElementById('formClientStatus').value;
    const remarks = document.getElementById('formClientRemarks').value;

    clientDevices.unshift({ clientName, category, model, serial, status, remarks });
    closeClientModal();
    document.getElementById('clientForm').reset();
    renderClientDevices();
}

function openEditModal(index) {
    const item = inventory[index];
    document.getElementById('editIndex').value = index;
    document.getElementById('editStatus').value = item.status;
    document.getElementById('editDepartment').value = item.department;
    document.getElementById('editAssignee').value = item.assignee;
    document.getElementById('editPrevOwner').value = item.prevOwner;
    document.getElementById('editModel').value = item.model;
    document.getElementById('editSerial').value = item.serial;
    document.getElementById('editModal').classList.remove('hidden');
}

function handleEditFormSubmit(event) {
    event.preventDefault();
    const index = document.getElementById('editIndex').value;
    inventory[index].status = document.getElementById('editStatus').value;
    inventory[index].department = document.getElementById('editDepartment').value;
    inventory[index].assignee = document.getElementById('editAssignee').value;
    inventory[index].prevOwner = document.getElementById('editPrevOwner').value;
    inventory[index].model = document.getElementById('editModel').value;
    inventory[index].serial = document.getElementById('editSerial').value;

    closeEditModal();
    renderInternalInventory();
}

function openEditClientModal(index) {
    const item = clientDevices[index];
    document.getElementById('editClientIndex').value = index;
    document.getElementById('editClientName').value = item.clientName;
    document.getElementById('editClientStatus').value = item.status;
    document.getElementById('editClientModel').value = item.model;
    document.getElementById('editClientSerial').value = item.serial;
    document.getElementById('editClientRemarks').value = item.remarks;
    document.getElementById('editClientModal').classList.remove('hidden');
}

function handleEditClientFormSubmit(event) {
    event.preventDefault();
    const index = document.getElementById('editClientIndex').value;
    clientDevices[index].clientName = document.getElementById('editClientName').value;
    clientDevices[index].status = document.getElementById('editClientStatus').value;
    clientDevices[index].model = document.getElementById('editClientModel').value;
    clientDevices[index].serial = document.getElementById('editClientSerial').value;
    clientDevices[index].remarks = document.getElementById('editClientRemarks').value;

    closeEditClientModal();
    renderClientDevices();
}