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
        flowType: 'pkce'
    }
});

let inventory = [];
let clientDevices = [];

let currentTab = 'internal';
let selectedClientFilter = 'All';

// --- AUTHENTICATION CHECK ---
if (localStorage.getItem('bbsi_authenticated') !== 'true') {
    window.location.href = 'login.html';
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await fetchCloudData();
    lucide.createIcons();

    // Event Listeners for Live Searching
    document.getElementById('searchInput').addEventListener('input', (e) => renderInternalInventory(e.target.value));
    document.getElementById('clientSearchInput').addEventListener('input', (e) => renderClientDevices(e.target.value));
});

// --- FETCH DATA FROM SUPABASE ---
async function fetchCloudData() {
    try {
        // Fetch Internal Inventory
        const { data: invData, error: invError } = await supabaseClient.from('inventory').select('*');
        if (!invError && invData) {
            inventory = invData.map(item => ({
                id: item.id,
                category: item.category,
                model: item.model,
                serial: item.serial,
                department: item.department,
                status: item.status,
                assignee: item.assignee,
                prevOwner: item.prev_owner
            }));
        }

        // Fetch Client Devices
        const { data: clientData, error: clientError } = await supabaseClient.from('client_devices').select('*');
        if (!clientError && clientData) {
            clientDevices = clientData.map(item => ({
                id: item.id,
                clientName: item.client_name,
                category: item.category,
                model: item.model,
                serial: item.serial,
                status: item.status,
                remarks: item.remarks
            }));
        }
    } catch (err) {
        console.error("Error fetching cloud data:", err);
    }

    renderInternalInventory();
    renderClientDevices();
}

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
                <td class="p-4 text-right flex items-center justify-end space-x-2">
                    <button onclick="openEditModal(${index})" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition">Change Status</button>
                    <button onclick="deleteInternalItem(${index})" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold transition">Delete</button>
                </td>
            </tr>
        `;
    });
}

// --- RENDER CLIENT SPARE DEVICES ---
function renderClientDevices(searchQuery = '') {
    const tbody = document.getElementById('clientTableBody');
    tbody.innerHTML = '';

    let totalClientSpares = clientDevices.length;
    let readyCount = clientDevices.filter(d => d.status === 'Ready for Deployment').length;
    let activeOrRmaCount = clientDevices.filter(d => d.status !== 'Ready for Deployment').length;

    document.getElementById('clientMetricTotal').innerText = totalClientSpares;
    document.getElementById('clientMetricReady').innerText = readyCount;
    document.getElementById('clientMetricActive').innerText = activeOrRmaCount;

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
                <td class="p-4 text-right flex items-center justify-end space-x-2">
                    <button onclick="openEditClientModal(${index})" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition">Edit Details</button>
                    <button onclick="deleteClientItem(${index})" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold transition">Delete</button>
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

// --- FORM SUBMISSIONS (CLOUD SYNCED) ---
async function handleFormSubmit(event) {
    event.preventDefault();
    const customId = document.getElementById('formCustomId').value.trim();
    const category = document.getElementById('formCategory').value;
    const status = document.getElementById('formStatus').value;
    const department = document.getElementById('formDepartment').value;
    const model = document.getElementById('formModel').value;
    const serial = document.getElementById('formSerial').value;
    const assignee = document.getElementById('formAssignee').value;
    const prevOwner = document.getElementById('formPrevOwner').value;

    const dbPayload = { 
        id: customId, 
        category, 
        model, 
        serial, 
        department, 
        status, 
        assignee, 
        prev_owner: prevOwner 
    };

    const { error } = await supabaseClient.from('inventory').insert([dbPayload]);
    if (error) {
        alert('Error saving to cloud: ' + error.message);
        return;
    }

    inventory.unshift({ id: customId, category, model, serial, department, status, assignee, prevOwner });
    closeModal();
    document.getElementById('deviceForm').reset();
    renderInternalInventory();
}

async function handleClientFormSubmit(event) {
    event.preventDefault();
    const clientName = document.getElementById('formClientName').value;
    const category = document.getElementById('formClientCategory').value;
    const model = document.getElementById('formClientModel').value;
    const serial = document.getElementById('formClientSerial').value;
    const status = document.getElementById('formClientStatus').value;
    const remarks = document.getElementById('formClientRemarks').value;

    const dbPayload = { client_name: clientName, category, model, serial, status, remarks };

    const { data, error } = await supabaseClient.from('client_devices').insert([dbPayload]).select();
    if (error) {
        alert('Error saving to cloud: ' + error.message);
        return;
    }

    if (data) {
        clientDevices.unshift({
            id: data[0].id,
            clientName, category, model, serial, status, remarks
        });
    }

    closeClientModal();
    document.getElementById('clientForm').reset();
    renderClientDevices();
}

function openEditModal(index) {
    const item = inventory[index];
    document.getElementById('editIndex').value = index;
    document.getElementById('editCustomId').value = item.id; // Populate Asset ID
    document.getElementById('editStatus').value = item.status;
    document.getElementById('editDepartment').value = item.department;
    document.getElementById('editAssignee').value = item.assignee;
    document.getElementById('editPrevOwner').value = item.prevOwner;
    document.getElementById('editModel').value = item.model;
    document.getElementById('editSerial').value = item.serial;
    document.getElementById('editModal').classList.remove('hidden');
}

async function handleEditFormSubmit(event) {
    event.preventDefault();
    const index = document.getElementById('editIndex').value;
    const item = inventory[index];
    const newCustomId = document.getElementById('editCustomId').value.trim();

    // If the primary key (Asset ID) is changed, we delete the old record and insert the updated one 
    // to avoid primary key constraint conflicts in Supabase.
    if (item.id !== newCustomId) {
        // Delete old row
        await supabaseClient.from('inventory').delete().eq('id', item.id);

        // Insert new row with updated ID
        const dbPayload = {
            id: newCustomId,
            category: item.category,
            model: document.getElementById('editModel').value,
            serial: document.getElementById('editSerial').value,
            department: document.getElementById('editDepartment').value,
            status: document.getElementById('editStatus').value,
            assignee: document.getElementById('editAssignee').value,
            prev_owner: document.getElementById('editPrevOwner').value
        };

        const { error } = await supabaseClient.from('inventory').insert([dbPayload]);
        if (error) {
            alert('Error updating Asset ID: ' + error.message);
            return;
        }

        item.id = newCustomId;
    }

    // Update local state values
    item.status = document.getElementById('editStatus').value;
    item.department = document.getElementById('editDepartment').value;
    item.assignee = document.getElementById('editAssignee').value;
    item.prevOwner = document.getElementById('editPrevOwner').value;
    item.model = document.getElementById('editModel').value;
    item.serial = document.getElementById('editSerial').value;

    // Update standard fields in Supabase
    await supabaseClient.from('inventory').update({
        status: item.status,
        department: item.department,
        assignee: item.assignee,
        prev_owner: item.prevOwner,
        model: item.model,
        serial: item.serial
    }).eq('id', item.id);

    closeEditModal();
    renderInternalInventory(document.getElementById('searchInput').value);
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

async function handleEditClientFormSubmit(event) {
    event.preventDefault();
    const index = document.getElementById('editClientIndex').value;
    const item = clientDevices[index];

    item.clientName = document.getElementById('editClientName').value;
    item.status = document.getElementById('editClientStatus').value;
    item.model = document.getElementById('editClientModel').value;
    item.serial = document.getElementById('editClientSerial').value;
    item.remarks = document.getElementById('editClientRemarks').value;

    if (item.id) {
        await supabaseClient.from('client_devices').update({
            client_name: item.clientName,
            status: item.status,
            model: item.model,
            serial: item.serial,
            remarks: item.remarks
        }).eq('id', item.id);
    }

    closeEditClientModal();
    renderClientDevices();
}

// --- DELETIONS (CLOUD SYNCED) ---
async function deleteInternalItem(index) {
    if (confirm("Are you sure you want to delete this internal hardware record?")) {
        const item = inventory[index];
        await supabaseClient.from('inventory').delete().eq('id', item.id);
        
        inventory.splice(index, 1);
        renderInternalInventory(document.getElementById('searchInput').value);
    }
}

async function deleteClientItem(index) {
    if (confirm("Are you sure you want to delete this client spare device record?")) {
        const item = clientDevices[index];
        if (item.id) {
            await supabaseClient.from('client_devices').delete().eq('id', item.id);
        }
        
        clientDevices.splice(index, 1);
        renderClientDevices(document.getElementById('clientSearchInput').value);
    }
}