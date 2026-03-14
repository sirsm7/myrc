/**
 * ============================================================================
 * MAIN APPLICATION LOGIC (PUBLIC FORM)
 * ============================================================================
 * This file contains all the UI interactions, dynamic calculations, and form
 * submission logic. It relies on variables defined in js/config.js.
 * ============================================================================
 */

// State Tracking
let isSchoolSelectedFromList = false;
let searchTimeout = null;

// Initialization
document.addEventListener('DOMContentLoaded', async function() {
    // Set current year in footer dynamically
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // Check form status (active toggle and closing date) before initializing other elements
    const isFormOpen = await checkFormStatus();
    
    // Only initialize form interaction features if the form is actually open
    if (isFormOpen) {
        setupAutocomplete();
        setupAutoCaps();
    }
});

/**
 * Fetch settings from Supabase and determine if the form should be displayed.
 * Returns boolean: true if open, false if closed.
 */
async function checkFormStatus() {
    try {
        const { data, error } = await supabaseClient
            .from('myrc_settings')
            .select('*')
            .eq('id', 1)
            .single();

        // PGRST116 means no rows found, which is fine if settings are empty.
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            const isActive = data.is_active;
            let isPastClosingDate = false;

            // Check if there is a closing date and if current time has surpassed it
            if (data.closing_date) {
                const closingDate = new Date(data.closing_date);
                const currentDate = new Date();
                
                if (currentDate >= closingDate) {
                    isPastClosingDate = true;
                }
            }

            // If form is toggled off OR past closing date, close the form
            if (!isActive || isPastClosingDate) {
                displayFormClosedMessage();
                return false;
            }
        }
        
        // Default to open if no specific block conditions are met
        return true;
        
    } catch (err) {
        console.error("Error checking form status:", err);
        // Fail-safe: if there's a network error checking status, we allow the form to show
        // so we don't block legitimate users over a temporary API blip.
        return true;
    }
}

/**
 * Hides the booking form dynamically and displays a professional "Form Closed" UI.
 */
function displayFormClosedMessage() {
    const formElement = document.getElementById('bookingForm');
    if (formElement) {
        // Hide the actual form
        formElement.style.display = 'none';

        // Create and inject the closed message container using Tailwind styling
        const closedContainer = document.createElement('div');
        closedContainer.className = 'text-center py-16 px-4 flex flex-col items-center justify-center animate-fade-in';
        closedContainer.innerHTML = `
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 mb-6">
                <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <h2 class="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Borang Telah Ditutup</h2>
            <p class="text-gray-500 max-w-md mx-auto text-base leading-relaxed">
                Harap maaf, tempahan untuk Litar Mikrobotik & AI Robotik telah ditutup pada masa ini. Sila hubungi pihak penganjur atau admin untuk sebarang pertanyaan lanjut.
            </p>
        `;

        // Insert the closed UI inside the same parent container
        formElement.parentNode.appendChild(closedContainer);
    }
}

/**
 * Enforce auto-caps for text inputs
 */
function setupAutoCaps() {
    const inputsToCaps = ['namaSekolahSearch', 'namaPenempah'];
    inputsToCaps.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });
        }
    });
}

/**
 * Sets up the autocomplete logic for the school search field
 */
function setupAutocomplete() {
    const searchInput = document.getElementById('namaSekolahSearch');
    const suggestionsBox = document.getElementById('schoolSuggestions');
    const hiddenKodSekolah = document.getElementById('kodSekolahData');
    const spinner = document.getElementById('searchSpinner');

    if (!searchInput || !suggestionsBox) return;

    // Handle Input event with Debounce
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim().toUpperCase();
        isSchoolSelectedFromList = false;
        hiddenKodSekolah.value = '';

        // Clear timeout if user is still typing
        if (searchTimeout) clearTimeout(searchTimeout);

        if (query.length < 3) {
            suggestionsBox.classList.add('hidden');
            spinner.classList.add('hidden');
            return;
        }

        // Show spinner and wait 400ms before querying Supabase
        spinner.classList.remove('hidden');
        searchTimeout = setTimeout(() => {
            fetchSchoolSuggestions(query);
        }, 400);
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });
}

/**
 * Fetch data from Supabase smpid_sekolah_data table
 */
async function fetchSchoolSuggestions(query) {
    const suggestionsBox = document.getElementById('schoolSuggestions');
    const spinner = document.getElementById('searchSpinner');

    try {
        const { data, error } = await supabaseClient
            .from('smpid_sekolah_data')
            .select('kod_sekolah, nama_sekolah')
            .ilike('nama_sekolah', `%${query}%`)
            .neq('kod_sekolah', 'M030') // Filter out M030
            .limit(10); // Limit to top 10 results for performance

        if (error) throw error;

        suggestionsBox.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(school => {
                const div = document.createElement('div');
                div.className = 'px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0';
                div.innerHTML = `<p class="text-sm font-semibold text-gray-800">${school.nama_sekolah}</p>
                                 <p class="text-xs text-gray-500">${school.kod_sekolah}</p>`;
                
                // Handle Selection
                div.addEventListener('click', function() {
                    document.getElementById('namaSekolahSearch').value = school.nama_sekolah;
                    document.getElementById('kodSekolahData').value = school.kod_sekolah;
                    isSchoolSelectedFromList = true;
                    suggestionsBox.classList.add('hidden');
                });
                
                suggestionsBox.appendChild(div);
            });
            suggestionsBox.classList.remove('hidden');
        } else {
            suggestionsBox.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500">Tiada sekolah dijumpai.</div>';
            suggestionsBox.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Error fetching schools:", err);
    } finally {
        spinner.classList.add('hidden');
    }
}

/**
 * Adjust quantity using + / - buttons
 */
function adjustQuantity(elementId, change) {
    const input = document.getElementById(elementId);
    if (!input) return;
    
    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;
    
    if (newValue < 0) newValue = 0;
    
    input.value = newValue;
    calculateTotal();
}

/**
 * Calculate overall total dynamically and handle payment section visibility
 */
function calculateTotal() {
    const qtyMikroInput = document.getElementById('kuantitiMikro');
    const qtyAIInput = document.getElementById('kuantitiAI');
    const totalDisplay = document.getElementById('totalDisplay');
    
    if (!qtyMikroInput || !qtyAIInput || !totalDisplay) return 0;

    const qtyMikro = parseInt(qtyMikroInput.value) || 0;
    const qtyAI = parseInt(qtyAIInput.value) || 0;
    
    // PRICE_MIKRO and PRICE_AI are global constants from js/config.js
    const total = (qtyMikro * PRICE_MIKRO) + (qtyAI * PRICE_AI);
    totalDisplay.textContent = total.toLocaleString('en-MY');

    // Dynamic Payment Section Visibility & Validation Logic
    const paymentSection = document.getElementById('paymentSection');
    const resitInput = document.getElementById('resitPembayaran');
    
    if (paymentSection && resitInput) {
        if (qtyMikro > 0 || qtyAI > 0) {
            paymentSection.classList.remove('hidden');
            resitInput.required = true;
        } else {
            paymentSection.classList.add('hidden');
            resitInput.required = false;
            resitInput.value = ''; // Clear file input securely if user reverts to 0
        }
    }

    return total;
}

/**
 * Main Form Submission Handler
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    // 1. Gather Inputs
    const sekolahInput = document.getElementById('namaSekolahSearch').value.trim();
    const kodSekolah = document.getElementById('kodSekolahData').value;
    const namaPenempah = document.getElementById('namaPenempah').value.trim();
    const noTelefon = document.getElementById('noTelefon').value.trim();
    const qtyMikro = parseInt(document.getElementById('kuantitiMikro').value) || 0;
    const qtyAI = parseInt(document.getElementById('kuantitiAI').value) || 0;
    const fileInput = document.getElementById('resitPembayaran');
    const totalRM = calculateTotal();

    // 2. Pre-flight Validation
    if (!isSchoolSelectedFromList || !kodSekolah) {
        Swal.fire({
            icon: 'warning',
            title: 'Pilihan Sekolah Tidak Sah',
            text: 'Sila buat carian dan pilih nama sekolah daripada senarai cadangan yang diberikan.',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    if (qtyMikro === 0 && qtyAI === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Pilihan Diperlukan',
            text: 'Sila pilih sekurang-kurangnya satu litar (Kuantiti minima 1) sebelum membuat tempahan.',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    if (fileInput.files.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Resit Diperlukan',
            text: 'Sila muat naik resit pembayaran anda untuk pengesahan tempahan.',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    const file = fileInput.files[0];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        Swal.fire({
            icon: 'error',
            title: 'Fail Terlalu Besar',
            text: 'Sila pastikan saiz fail resit tidak melebihi 5MB.',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    // 3. UI State: Processing
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    btnText.textContent = 'Memproses Tempahan...';
    btnSpinner.classList.remove('hidden');

    try {
        // 4. Convert File to Base64
        const base64Data = await convertFileToBase64(file);
        
        // 5. Upload File to GAS API
        btnText.textContent = 'Memuat Naik Resit...';
        const uploadPayload = {
            namaSekolah: sekolahInput,
            receiptData: base64Data,
            receiptName: file.name,
            receiptMimeType: file.type
        };

        const gasResponse = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify(uploadPayload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // text/plain to avoid CORS preflight issues
        });

        const gasResult = await gasResponse.json();

        if (gasResult.status !== 'success' || !gasResult.receiptUrl) {
            throw new Error(gasResult.message || "Gagal mendapatkan pautan resit dari pelayan.");
        }

        const receiptUrl = gasResult.receiptUrl;

        // 6. Save Data to Supabase
        btnText.textContent = 'Menyimpan Rekod...';
        
        const supabasePayload = {
            kod_sekolah: kodSekolah,
            nama_sekolah: sekolahInput,
            nama_penempah: namaPenempah,
            no_telefon: noTelefon,
            kuantiti_mikro: qtyMikro,
            kuantiti_ai: qtyAI,
            jumlah_rm: totalRM,
            resit_url: receiptUrl
        };

        const { error: dbError } = await supabaseClient
            .from('myrc_tempahan')
            .insert([supabasePayload]);

        if (dbError) throw dbError;

        // 7. Success Resolution
        resetBtnState();
        Swal.fire({
            icon: 'success',
            title: 'Tempahan Berjaya!',
            html: `Tempahan anda telah direkodkan dalam sistem selamat kami.<br><br><strong>Jumlah Pembayaran: RM ${totalRM.toLocaleString('en-MY')}</strong>`,
            confirmButtonColor: '#10b981',
            allowOutsideClick: false
        }).then((result) => {
            if (result.isConfirmed) {
                // Reset Form
                document.getElementById('bookingForm').reset();
                calculateTotal(); // Trigger DOM reset securely
                document.getElementById('kodSekolahData').value = '';
                isSchoolSelectedFromList = false;
            }
        });

    } catch (error) {
        console.error("Submission Error:", error);
        resetBtnState();
        Swal.fire({
            icon: 'error',
            title: 'Ralat Sistem',
            text: 'Terjadi ralat semasa memproses tempahan: ' + error.message,
            confirmButtonColor: '#ef4444'
        });
    }
}

/**
 * Helper Function: Convert File to Base64 via Promise
 */
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const dataURL = reader.result;
            const base64Data = dataURL.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Helper Function: Revert UI Button State
 */
function resetBtnState() {
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    
    if (submitBtn && btnText && btnSpinner) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        btnText.textContent = 'Sahkan Tempahan & Hantar';
        btnSpinner.classList.add('hidden');
    }
}