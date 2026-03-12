/**
 * ============================================================================
 * ADMIN DASHBOARD LOGIC
 * ============================================================================
 * Handles static login, data fetching from Supabase, metrics calculation, 
 * data table rendering, filtering, and record deletion.
 * Relies on supabaseClient initialized in js/config.js.
 * ============================================================================
 */

// --- Admin Credentials ---
const ADMIN_EMAIL = 'admin@tech4ag.my';
const ADMIN_PASS = 'ppdag@12345';

// --- State Variables ---
let allRecords = []; // Stores all fetched records
let currentFilter = 'ALL'; // 'ALL', 'MIKRO', 'AI'

// --- DOM Elements ---
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');

const metricTotalRM = document.getElementById('metricTotalRM');
const metricTotalKuantiti = document.getElementById('metricTotalKuantiti');
const metricTotalMikro = document.getElementById('metricTotalMikro');
const metricTotalAI = document.getElementById('metricTotalAI');

const dataTableBody = document.getElementById('dataTableBody');
const tableLoading = document.getElementById('tableLoading');
const recordCountDisplay = document.getElementById('recordCountDisplay');

const btnFilterAll = document.getElementById('filterAll');
const btnFilterMikro = document.getElementById('filterMikro');
const btnFilterAI = document.getElementById('filterAI');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
});

/**
 * Check if admin is already logged in during this session
 */
function checkSession() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        showDashboard();
    } else {
        showLogin();
    }
}

/**
 * Setup all UI event listeners
 */
function setupEventListeners() {
    // Login Form Submit
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const pass = document.getElementById('adminPassword').value.trim();

        if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            Swal.fire({
                icon: 'success',
                title: 'Log Masuk Berjaya',
                text: 'Selamat datang ke Papan Pemuka Admin.',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                showDashboard();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Akses Ditolak',
                text: 'Emel atau kata laluan tidak sah.',
                confirmButtonColor: '#ef4444'
            });
        }
    });

    // Logout Button
    logoutBtn.addEventListener('click', () => {
        Swal.fire({
            title: 'Log Keluar?',
            text: "Anda pasti ingin log keluar dari sistem?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: 'Ya, Log Keluar',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                sessionStorage.removeItem('adminLoggedIn');
                showLogin();
            }
        });
    });

    // Refresh Button
    refreshBtn.addEventListener('click', () => {
        fetchData();
    });

    // Filter Buttons
    btnFilterAll.addEventListener('click', () => applyFilter('ALL'));
    btnFilterMikro.addEventListener('click', () => applyFilter('MIKRO'));
    btnFilterAI.addEventListener('click', () => applyFilter('AI'));
}

/**
 * View Management: Show Login Modal
 */
function showLogin() {
    loginModal.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loginForm.reset();
}

/**
 * View Management: Show Dashboard & Load Data
 */
function showDashboard() {
    loginModal.classList.add('hidden');
    dashboard.classList.remove('hidden');
    dashboard.classList.add('flex');
    fetchData();
}

/**
 * Fetch Data from Supabase
 */
async function fetchData() {
    tableLoading.classList.remove('hidden');
    
    try {
        // Assuming table 'myrc_tempahan' has columns: id, created_at, nama_sekolah, kod_sekolah, nama_penempah, no_telefon, kuantiti_mikro, kuantiti_ai, jumlah_rm, resit_url
        const { data, error } = await supabaseClient
            .from('myrc_tempahan')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allRecords = data || [];
        processDataForDisplay();

    } catch (error) {
        console.error("Error fetching data:", error);
        Swal.fire({
            icon: 'error',
            title: 'Ralat Pangkalan Data',
            text: 'Gagal memuat turun rekod tempahan: ' + error.message,
            confirmButtonColor: '#ef4444'
        });
    } finally {
        tableLoading.classList.add('hidden');
    }
}

/**
 * Apply selected filter and update UI
 */
function applyFilter(filterType) {
    currentFilter = filterType;
    
    // Update active button styles
    const activeClass = ['bg-gray-800', 'text-white'];
    const inactiveClass = ['bg-white', 'text-gray-700', 'hover:bg-gray-50'];

    // Reset all buttons
    [btnFilterAll, btnFilterMikro, btnFilterAI].forEach(btn => {
        btn.classList.remove(...activeClass);
        btn.classList.add(...inactiveClass);
    });

    // Set active button
    if (filterType === 'ALL') {
        btnFilterAll.classList.remove(...inactiveClass);
        btnFilterAll.classList.add(...activeClass);
    } else if (filterType === 'MIKRO') {
        btnFilterMikro.classList.remove(...inactiveClass);
        btnFilterMikro.classList.add(...activeClass);
    } else if (filterType === 'AI') {
        btnFilterAI.classList.remove(...inactiveClass);
        btnFilterAI.classList.add(...activeClass);
    }

    processDataForDisplay();
}

/**
 * Filter data, calculate metrics, and render table
 */
function processDataForDisplay() {
    let filteredData = allRecords;

    if (currentFilter === 'MIKRO') {
        filteredData = allRecords.filter(record => record.kuantiti_mikro > 0);
    } else if (currentFilter === 'AI') {
        filteredData = allRecords.filter(record => record.kuantiti_ai > 0);
    }

    calculateMetrics(filteredData);
    renderTable(filteredData);
}

/**
 * Calculate and update dashboard metrics
 */
function calculateMetrics(data) {
    let totalRM = 0;
    let totalMikro = 0;
    let totalAI = 0;

    data.forEach(record => {
        totalRM += parseFloat(record.jumlah_rm) || 0;
        totalMikro += parseInt(record.kuantiti_mikro) || 0;
        totalAI += parseInt(record.kuantiti_ai) || 0;
    });

    metricTotalRM.textContent = totalRM.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    metricTotalMikro.textContent = totalMikro;
    metricTotalAI.textContent = totalAI;
    metricTotalKuantiti.innerHTML = `${totalMikro + totalAI} <span class="text-lg font-medium text-gray-500">unit</span>`;
}

/**
 * Render data into the HTML table
 */
function renderTable(data) {
    dataTableBody.innerHTML = '';
    recordCountDisplay.textContent = `Memaparkan ${data.length} rekod.`;

    if (data.length === 0) {
        dataTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-10 text-center text-gray-500 text-sm">
                    Tiada rekod tempahan dijumpai berdasarkan tapisan ini.
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(record => {
        // Format Date
        const dateObj = new Date(record.created_at);
        const dateFormatted = dateObj.toLocaleDateString('en-MY', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) + '<br><span class="text-gray-400 text-xs">' + dateObj.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) + '</span>';

        // Format RM
        const rmFormatted = parseFloat(record.jumlah_rm).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Build Row
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${dateFormatted}</td>
            <td class="px-6 py-4 text-sm text-gray-900">
                <div class="font-bold text-gray-800">${escapeHtml(record.nama_sekolah)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(record.kod_sekolah)}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                <div class="font-medium">${escapeHtml(record.nama_penempah)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(record.no_telefon)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold ${record.kuantiti_mikro > 0 ? 'text-indigo-600' : 'text-gray-300'}">${record.kuantiti_mikro}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold ${record.kuantiti_ai > 0 ? 'text-purple-600' : 'text-gray-300'}">${record.kuantiti_ai}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">RM ${rmFormatted}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                ${record.resit_url ? `<a href="${record.resit_url}" target="_blank" class="text-blue-600 hover:text-blue-900 font-medium underline">Lihat Resit</a>` : '<span class="text-gray-400 italic">Tiada Resit</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition-colors">Padam</button>
            </td>
        `;
        dataTableBody.appendChild(tr);
    });
}

/**
 * Delete a specific record by ID
 */
window.deleteRecord = function(recordId) {
    Swal.fire({
        title: 'Padam Rekod?',
        text: "Tindakan ini tidak boleh dipulihkan. Adakah anda pasti?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Show loading modal
                Swal.fire({
                    title: 'Memadam...',
                    text: 'Sila tunggu sebentar.',
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    willOpen: () => {
                        Swal.showLoading();
                    }
                });

                const { error } = await supabaseClient
                    .from('myrc_tempahan')
                    .delete()
                    .eq('id', recordId);

                if (error) throw error;

                Swal.fire({
                    icon: 'success',
                    title: 'Dipadam!',
                    text: 'Rekod telah berjaya dipadamkan.',
                    timer: 1500,
                    showConfirmButton: false
                });

                // Refresh data after deletion
                fetchData();

            } catch (error) {
                console.error("Delete error:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Ralat Pemadaman',
                    text: 'Gagal memadam rekod: ' + error.message,
                    confirmButtonColor: '#ef4444'
                });
            }
        }
    });
};

/**
 * Helper to escape HTML and prevent XSS
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}