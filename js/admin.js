/**
 * ============================================================================
 * ADMIN DASHBOARD LOGIC
 * ============================================================================
 * Handles static login, data fetching from Supabase, metrics calculation, 
 * data table rendering, filtering, record deletion, receipt generation,
 * and system settings management (form active/inactive & closing date).
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

// --- Settings DOM Elements ---
const formStatusToggle = document.getElementById('formStatusToggle');
const closingDateInput = document.getElementById('closingDateInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const statusLabel = document.getElementById('statusLabel');

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
                // Padam sesi keselamatan (session storage)
                sessionStorage.removeItem('adminLoggedIn');
                
                // Halakan pengguna kembali ke muka depan utama
                window.location.href = 'index.html';
            }
        });
    });

    // Refresh Button
    refreshBtn.addEventListener('click', () => {
        fetchData();
        fetchSettings(); // Refresh settings as well
    });

    // Filter Buttons
    btnFilterAll.addEventListener('click', () => applyFilter('ALL'));
    btnFilterMikro.addEventListener('click', () => applyFilter('MIKRO'));
    btnFilterAI.addEventListener('click', () => applyFilter('AI'));

    // Settings System Listeners
    if (formStatusToggle) {
        formStatusToggle.addEventListener('change', updateStatusLabelUI);
    }
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSystemSettings);
    }
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
    
    // Load Settings and Records
    fetchSettings();
    fetchData();
}

/**
 * Fetch System Settings (Form Status & Closing Date)
 */
async function fetchSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('myrc_settings')
            .select('*')
            .eq('id', 1)
            .single();

        // PGRST116 means no rows found. We ignore it in case DB is fresh without the default row.
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            formStatusToggle.checked = data.is_active;
            
            if (data.closing_date) {
                // Convert UTC from DB to local timezone format required by datetime-local input
                const dateObj = new Date(data.closing_date);
                const tzOffset = dateObj.getTimezoneOffset() * 60000; 
                const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
                closingDateInput.value = localISOTime;
            } else {
                closingDateInput.value = '';
            }
        }

        updateStatusLabelUI();
        
        // Enable UI elements after loading
        formStatusToggle.disabled = false;
        closingDateInput.disabled = false;
        saveSettingsBtn.disabled = false;

    } catch (error) {
        console.error("Error fetching settings:", error);
        statusLabel.textContent = "Ralat Tetapan";
        statusLabel.className = "mr-3 text-sm font-bold text-red-600";
    }
}

/**
 * Update the UI label based on toggle state
 */
function updateStatusLabelUI() {
    if (!statusLabel || !formStatusToggle) return;
    
    if (formStatusToggle.checked) {
        statusLabel.textContent = 'Borang Aktif';
        statusLabel.className = 'mr-3 text-sm font-bold text-green-600';
    } else {
        statusLabel.textContent = 'Borang Ditutup';
        statusLabel.className = 'mr-3 text-sm font-bold text-red-600';
    }
}

/**
 * Save System Settings to Supabase
 */
async function saveSystemSettings() {
    saveSettingsBtn.disabled = true;
    const originalBtnHTML = saveSettingsBtn.innerHTML;
    saveSettingsBtn.innerHTML = `
        <div class="loader border-2 border-white rounded-full w-4 h-4 mr-2 border-t-transparent"></div>
        Menyimpan...
    `;

    try {
        const isActive = formStatusToggle.checked;
        const localClosingDate = closingDateInput.value;
        
        let closingDateUTC = null;
        if (localClosingDate) {
            // Convert local datetime back to UTC for safe DB storage
            const dateObj = new Date(localClosingDate);
            closingDateUTC = dateObj.toISOString();
        }

        // Upsert ensures that if row id=1 doesn't exist, it creates it, otherwise updates it
        const { error } = await supabaseClient
            .from('myrc_settings')
            .upsert({ id: 1, is_active: isActive, closing_date: closingDateUTC });

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Tetapan Berjaya',
            text: 'Status sistem borang telah dikemas kini.',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error("Error saving settings:", error);
        Swal.fire({
            icon: 'error',
            title: 'Ralat Simpanan',
            text: 'Gagal mengemas kini tetapan sistem: ' + error.message,
            confirmButtonColor: '#ef4444'
        });
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.innerHTML = originalBtnHTML;
    }
}

/**
 * Fetch Data from Supabase
 */
async function fetchData() {
    tableLoading.classList.remove('hidden');
    
    try {
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
 * Format phone number to international WhatsApp format (e.g. 012... to 6012...)
 */
function formatWhatsAppNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Remove non-numeric
    if (cleaned.startsWith('0')) {
        cleaned = '6' + cleaned;
    }
    return cleaned;
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

        // WhatsApp Setup
        const waPhone = formatWhatsAppNumber(record.no_telefon);
        const waMessage = encodeURIComponent(`Salam Cikgu ${record.nama_penempah}, ini merujuk kepada tempahan Litar Mikrobotik & AI Robotik dari ${record.nama_sekolah}.`);
        const waLink = `https://wa.me/${waPhone}?text=${waMessage}`;

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
                <a href="${waLink}" target="_blank" class="mt-1 inline-flex items-center text-xs font-semibold text-green-600 hover:text-green-800 transition-colors" title="WhatsApp Penempah">
                    <svg class="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    WhatsApp
                </a>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold ${record.kuantiti_mikro > 0 ? 'text-indigo-600' : 'text-gray-300'}">${record.kuantiti_mikro}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold ${record.kuantiti_ai > 0 ? 'text-purple-600' : 'text-gray-300'}">${record.kuantiti_ai}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">RM ${rmFormatted}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                ${record.resit_url ? `<a href="${record.resit_url}" target="_blank" class="text-blue-600 hover:text-blue-900 font-medium underline">Lihat Resit</a>` : '<span class="text-gray-400 italic">Tiada Resit</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                <button onclick="generateReceipt('${record.id}')" class="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded transition-colors" title="Jana Resit Pembelian">Resit</button>
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded transition-colors" title="Padam Rekod">Padam</button>
            </td>
        `;
        dataTableBody.appendChild(tr);
    });
}

/**
 * Generate Printable Receipt (Native Browser Feature)
 */
window.generateReceipt = function(recordId) {
    const record = allRecords.find(r => r.id == recordId);
    if (!record) {
        Swal.fire('Ralat', 'Rekod tidak dijumpai', 'error');
        return;
    }

    // Formatting Variables
    const dateObj = new Date(record.created_at);
    const dateFormatted = dateObj.toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    const rmFormatted = parseFloat(record.jumlah_rm).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Pricing calculation based on config globals (assuming PRICE_MIKRO=90, PRICE_AI=100)
    const priceMikro = typeof PRICE_MIKRO !== 'undefined' ? PRICE_MIKRO : 90;
    const priceAI = typeof PRICE_AI !== 'undefined' ? PRICE_AI : 100;

    const subTotalMikro = (record.kuantiti_mikro * priceMikro).toLocaleString('en-MY', { minimumFractionDigits: 2 });
    const subTotalAI = (record.kuantiti_ai * priceAI).toLocaleString('en-MY', { minimumFractionDigits: 2 });

    // HTML Template for the Receipt
    const receiptHtml = `
    <!DOCTYPE html>
    <html lang="ms">
    <head>
        <meta charset="UTF-8">
        <title>Resit Pembelian - ${escapeHtml(record.nama_sekolah)}</title>
        <style>
            @page { margin: 0; size: auto; }
            body { 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                padding: 40px; 
                color: #222; 
                background: #fff;
                line-height: 1.5;
            }
            .receipt-box { 
                max-width: 700px; 
                margin: 0 auto; 
                border: 1px solid #ddd; 
                padding: 40px; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.05);
            }
            .header { 
                text-align: center; 
                border-bottom: 2px solid #222; 
                padding-bottom: 20px; 
                margin-bottom: 30px; 
            }
            .title { 
                font-size: 26px; 
                font-weight: 800; 
                margin: 0; 
                text-transform: uppercase; 
                letter-spacing: 2px; 
            }
            .subtitle { 
                font-size: 14px; 
                color: #555; 
                margin-top: 5px; 
            }
            .info-grid {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .info-col table { border-collapse: collapse; }
            .info-col table td { padding: 4px 0; font-size: 14px; }
            .info-col table td.label { font-weight: bold; width: 130px; color: #555; }
            .items-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 30px; 
            }
            .items-table th, .items-table td { 
                border-bottom: 1px solid #ddd; 
                padding: 12px 10px; 
                text-align: left; 
                font-size: 14px;
            }
            .items-table th { 
                background-color: #f9f9f9; 
                font-weight: bold; 
                text-transform: uppercase; 
                font-size: 12px; 
                color: #555;
            }
            .items-table td.amount, .items-table th.amount { text-align: right; }
            .items-table td.center, .items-table th.center { text-align: center; }
            .total-row td { 
                font-size: 18px; 
                font-weight: 800; 
                border-top: 2px solid #222; 
                padding-top: 15px; 
            }
            .footer { 
                text-align: center; 
                font-size: 12px; 
                color: #777; 
                margin-top: 50px; 
                border-top: 1px dashed #ccc; 
                padding-top: 20px; 
            }
            /* Print Specific Styles */
            @media print {
                body { padding: 0; background: transparent; }
                .receipt-box { border: none; box-shadow: none; padding: 0; max-width: 100%; }
            }
        </style>
    </head>
    <body>
        <div class="receipt-box">
            <div class="header">
                <h1 class="title">Resit Pembelian Litar</h1>
                <div class="subtitle">Mikrobotik & AI Robotik</div>
            </div>

            <div class="info-grid">
                <div class="info-col">
                    <table>
                        <tr><td class="label">Sekolah:</td><td>${escapeHtml(record.nama_sekolah)} (${escapeHtml(record.kod_sekolah)})</td></tr>
                        <tr><td class="label">Penempah:</td><td>${escapeHtml(record.nama_penempah)}</td></tr>
                        <tr><td class="label">Telefon:</td><td>${escapeHtml(record.no_telefon)}</td></tr>
                    </table>
                </div>
                <div class="info-col">
                    <table>
                        <tr><td class="label">No. Rujukan:</td><td>#${record.id.slice(0, 8).toUpperCase()}</td></tr>
                        <tr><td class="label">Tarikh:</td><td>${dateFormatted}</td></tr>
                        <tr><td class="label">Masa:</td><td>${timeFormatted}</td></tr>
                    </table>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Perkara</th>
                        <th class="center">Kuantiti</th>
                        <th class="amount">Harga Seunit (RM)</th>
                        <th class="amount">Jumlah (RM)</th>
                    </tr>
                </thead>
                <tbody>
                    ${record.kuantiti_mikro > 0 ? `
                    <tr>
                        <td><strong>Litar Mikrobotik</strong><br><span style="color:#777; font-size:12px;">Material Tarpaulin (Cetakan Normal)</span></td>
                        <td class="center">${record.kuantiti_mikro}</td>
                        <td class="amount">${priceMikro.toFixed(2)}</td>
                        <td class="amount">${subTotalMikro}</td>
                    </tr>` : ''}
                    
                    ${record.kuantiti_ai > 0 ? `
                    <tr>
                        <td><strong>Litar AI Robotik</strong><br><span style="color:#777; font-size:12px;">Material Tarpaulin (Cetakan UV)</span></td>
                        <td class="center">${record.kuantiti_ai}</td>
                        <td class="amount">${priceAI.toFixed(2)}</td>
                        <td class="amount">${subTotalAI}</td>
                    </tr>` : ''}
                    
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">JUMLAH KESELURUHAN:</td>
                        <td class="amount">${rmFormatted}</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                <p>Resit ini dijana secara automatik oleh sistem dan tidak memerlukan tandatangan.</p>
                <p>&copy; ${new Date().getFullYear()} Tempahan Litar Automatik.</p>
            </div>
        </div>
        
        <script>
            // Automatically trigger print dialog when fully loaded
            window.onload = function() {
                window.print();
            };
        </script>
    </body>
    </html>
    `;

    // Open a new blank window
    const printWindow = window.open('', '_blank', 'width=800,height=900,menubar=no,toolbar=no,location=no,status=no');
    
    if (printWindow) {
        // Write the HTML into the new window
        printWindow.document.open();
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
    } else {
        Swal.fire('Pop-up Disekat', 'Sila benarkan pop-up di browser anda untuk menjana resit.', 'warning');
    }
};

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