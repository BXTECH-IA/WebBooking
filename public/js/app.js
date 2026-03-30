if (typeof API_URL === 'undefined') {
    var API_URL = '/api';
}

async function login(username, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return res.json();
}

async function getAvailability(merchantId) {
    const res = await fetch(`${API_URL}/availability/${merchantId}`);
    return res.json();
}

async function getAppointments(merchantId, start, end) {
    const params = new URLSearchParams({ merchantId });
    if (start) params.append('start', start);
    if (end) params.append('end', end);

    const res = await fetch(`${API_URL}/appointments?${params}`);
    return res.json();
}

async function createAppointment(data) {
    const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

// Auxiliar para formatar data
function formatDate(date) {
    return new Date(date).toLocaleString();
}
// Helper to format price as currency (BRL)
function formatPrice(value) {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

/**
 * Toggle password visibility
 * @param {HTMLButtonElement} btn 
 */
function togglePasswordVisibility(btn) {
    const wrapper = btn.closest('.password-wrapper');
    const input = wrapper.querySelector('input');
    
    // SVGs for eye and eye-off
    const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = eyeOffIcon;
    } else {
        input.type = 'password';
        btn.innerHTML = eyeIcon;
    }
}
