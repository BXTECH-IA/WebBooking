/**
 * theme.js - Gerenciamento individual de tema por usuário
 * WebBooking - BX Tech
 */
(function () {
    const btn = document.getElementById("toggleTheme");

    function getActiveUserId() {
        return localStorage.getItem('merchantId');
    }

    function getCachedTheme(userId) {
        if (!userId) return null;
        return localStorage.getItem(`theme:${userId}`);
    }

    function getSystemPreferredTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'clean';
    }

    function applyThemeToDOM(theme) {
        const isClean = theme === 'clean' || theme === 'light';
        const normalized = isClean ? 'clean' : 'dark';

        if (normalized === 'clean') {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('clean', 'light');
            if (document.body) {
                document.body.classList.remove('dark');
                document.body.classList.add('clean', 'light');
            }
            if (btn) {
                btn.textContent = "🌞";
                btn.title = "Tema Clean ativo (clique para alternar para Dark)";
                btn.setAttribute('aria-label', 'Alternar para tema escuro');
            }
        } else {
            document.documentElement.classList.remove('clean', 'light');
            document.documentElement.classList.add('dark');
            if (document.body) {
                document.body.classList.remove('clean', 'light');
                document.body.classList.add('dark');
            }
            if (btn) {
                btn.textContent = "🌓";
                btn.title = "Tema Dark ativo (clique para alternar para Clean)";
                btn.setAttribute('aria-label', 'Alternar para tema claro');
            }
        }
        return normalized;
    }

    // Remove qualquer resquício da chave global legada
    try {
        localStorage.removeItem('theme');
    } catch (e) {}

    const userId = getActiveUserId();
    let currentTheme = getCachedTheme(userId);

    if (!currentTheme) {
        currentTheme = getSystemPreferredTheme();
    }

    // Aplica imediatamente na interface
    currentTheme = applyThemeToDOM(currentTheme);

    // Se usuário está autenticado, sincroniza com o backend em segundo plano
    const token = localStorage.getItem('authToken');
    if (token && userId) {
        fetch('/api/auth/theme', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) return response.json();
            return null;
        })
        .then(data => {
            if (data && (data.theme === 'clean' || data.theme === 'dark')) {
                if (data.theme !== currentTheme) {
                    currentTheme = data.theme;
                    localStorage.setItem(`theme:${userId}`, currentTheme);
                    applyThemeToDOM(currentTheme);
                }
            }
        })
        .catch(err => {
            console.warn('Não foi possível obter o tema do servidor:', err);
        });
    }

    // Alternância ao clicar no botão
    if (btn) {
        btn.addEventListener("click", async () => {
            const nextTheme = (currentTheme === 'dark') ? 'clean' : 'dark';
            currentTheme = nextTheme;
            applyThemeToDOM(nextTheme);

            const activeId = getActiveUserId();
            if (activeId) {
                localStorage.setItem(`theme:${activeId}`, nextTheme);
            }

            const activeToken = localStorage.getItem('authToken');
            if (activeToken) {
                try {
                    const res = await fetch('/api/auth/theme', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${activeToken}`
                        },
                        body: JSON.stringify({ theme: nextTheme })
                    });
                    if (!res.ok) {
                        console.error('Falha ao sincronizar alteração de tema com o servidor');
                    }
                } catch (err) {
                    console.error('Erro de conexão ao salvar tema no servidor:', err);
                }
            }
        });
    }

    // Expõe helper no window para casos de logout ou reset
    window.ThemeManager = {
        apply: applyThemeToDOM,
        clear: function () {
            document.documentElement.classList.remove('dark', 'clean', 'light');
            if (document.body) {
                document.body.classList.remove('dark', 'clean', 'light');
            }
        }
    };
})();