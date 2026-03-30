if (typeof API_URL === 'undefined') {
    var API_URL = '/api';
}

/**
 * Fetch and render all merchants from the database
 */
async function loadMerchants() {
    const list = document.getElementById('merchantsList');
    const loading = document.getElementById('loadingMerchants');
    const totalBadge = document.getElementById('totalMerchants');
    
    list.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await fetch(`${API_URL}/merchants`);
        const merchants = await response.json();

        list.innerHTML = '';
        
        if (merchants.length === 0) {
            list.innerHTML = '<li style="padding: 20px; text-align: center;">Nenhum comerciante cadastrado ainda.</li>';
        } else {
            merchants.forEach(m => {
                const li = document.createElement('li');
                li.className = 'merchant-item';
                
                // Add a cute little label if it's the master user
                const isMaster = m.username === 'master' ? '<span class="badge" style="background: gold; margin-left:10px;">👑 Master</span>' : '';
                
                li.innerHTML = `
                    <div>
                        <strong style="font-size: 1.1em;">${m.username}</strong> ${isMaster}
                        <div style="font-size: 0.8em; color: var(--text-color); margin-top: 5px;">ID: ${m.id}</div>
                    </div>
                    <button class="btn btn-danger" onclick="deleteMerchant(${m.id}, '${m.username}')" style="padding: 5px 15px; font-size: 0.9em;">Excluir</button>
                `;
                list.appendChild(li);
            });
        }
        
        totalBadge.textContent = merchants.length;
        loading.style.display = 'none';
        list.style.display = 'block';

    } catch (err) {
        console.error('Falha ao carregar', err);
        loading.textContent = 'Erro ao carregar lista de comerciantes.';
    }
}

/**
 * Create a new Merchant 
 */
document.getElementById('createMerchantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('newUsername');
    const passwordInput = document.getElementById('newPassword');
    const msg = document.getElementById('formMsg');
    const submitBtn = e.target.querySelector('button');

    // Prevent double clicking
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';
    msg.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usernameInput.value,
                password: passwordInput.value
            })
        });

        const data = await response.json();

        if (response.ok) {
            msg.textContent = '✅ Comerciante criado com sucesso!';
            msg.style.color = 'var(--primary-color)';
            msg.style.display = 'block';
            
            // Limpa o formulário
            usernameInput.value = '';
            passwordInput.value = '';
            
            // Recarrega a tabela imediatamente pra mostrar o novo
            loadMerchants();
        } else {
            msg.textContent = '❌ Erro: ' + (data.error || 'Falha ao criar usuário.');
            msg.style.color = 'var(--danger-color)';
            msg.style.display = 'block';
        }
    } catch (err) {
        msg.textContent = '❌ Erro de conexão ao tentar registrar.';
        msg.style.color = 'var(--danger-color)';
        msg.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar Conta';
    }
});

/**
 * Delete a Merchant
 */
async function deleteMerchant(id, username) {
    if (username === 'master') {
        alert('Você não pode excluir o usuário master!');
        return;
    }

    if (confirm(`Tem CERTEZA que deseja excluir a conta "${username}"? Todos os serviços e agendamentos vinculados poderão ser perdidos.`)) {
        try {
            const response = await fetch(`${API_URL}/merchants/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert(`Comerciante ${username} excluído com sucesso.`);
                loadMerchants();
            } else {
                const data = await response.json();
                alert(`Erro ao excluir: ${data.error || 'desconhecido'}`);
            }
        } catch (err) {
            alert('Falha ao conectar com o servidor para excluir.');
        }
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', loadMerchants);
