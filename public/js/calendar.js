class Calendar {
    constructor(containerId, onDateSelect) {
        this.container = document.getElementById(containerId);
        this.onDateSelect = onDateSelect;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.maxDate = new Date();
        this.maxDate.setDate(this.maxDate.getDate() + 7); // 7 days restriction

        this.render();
    }

    render() {
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'calendar-header';

        const monthYear = document.createElement('h3');
        const monthName = this.currentDate.toLocaleString('pt-BR', { month: 'long' });
        const year = this.currentDate.getFullYear();
        monthYear.textContent = `${monthName} ${year}`;
        monthYear.style.textTransform = 'capitalize';

        const nav = document.createElement('div');
        nav.className = 'month-nav';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn';
        prevBtn.innerHTML = '&lt;';
        prevBtn.onclick = () => this.changeMonth(-1);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn';
        nextBtn.innerHTML = '&gt;';
        nextBtn.onclick = () => this.changeMonth(1);

        nav.appendChild(prevBtn);
        nav.appendChild(nextBtn);

        header.appendChild(monthYear);
        header.appendChild(nav);
        this.container.appendChild(header);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        // Weekdays
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        weekdays.forEach(day => {
            const el = document.createElement('div');
            el.className = 'weekday';
            el.textContent = day;
            grid.appendChild(el);
        });

        // Days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);

        // Empty slots for previous month
        for (let i = 0; i < firstDay.getDay(); i++) {
            grid.appendChild(document.createElement('div'));
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= lastDay.getDate(); i++) {
            const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), i);
            const dayEl = document.createElement('div');
            dayEl.className = 'day';
            dayEl.textContent = i;

            // Check if today
            if (date.getTime() === today.getTime()) {
                dayEl.classList.add('today');
            }

            // Check restrictions (past dates or > 7 days)
            const diffTime = date.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (date < today || date > this.maxDate) {
                dayEl.classList.add('disabled');
            } else {
                dayEl.onclick = () => this.selectDate(date, dayEl);
            }

            if (this.selectedDate && date.getTime() === this.selectedDate.getTime()) {
                dayEl.classList.add('selected');
            }

            grid.appendChild(dayEl);
        }

        this.container.appendChild(grid);
    }

    changeMonth(offset) {
        this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        this.render();
    }

    selectDate(date, element) {
        // Remover seleção anterior
        const prev = this.container.querySelector('.day.selected');
        if (prev) prev.classList.remove('selected');

        this.selectedDate = date;
        element.classList.add('selected');

        if (this.onDateSelect) {
            this.onDateSelect(date);
        }
    }
}

class ServiceManager {
    constructor(containerId, onServiceSelect) {
        this.container = document.getElementById(containerId);
        this.onServiceSelect = onServiceSelect;
        this.selectedService = null;
        this.services = [];
    }

    async loadServices(merchantId) {
        try {
            const response = await fetch(`/api/services/${merchantId}`);
            if (!response.ok) {
                // tentar ler mensagem de erro do corpo
                let errMsg = `Status ${response.status}`;
                try {
                    const data = await response.json();
                    if (data && data.error) errMsg += ` - ${data.error}`;
                } catch (e) {
                    const txt = await response.text();
                    if (txt) errMsg += ` - ${txt}`;
                }
                throw new Error(errMsg);
            }
            this.services = await response.json();
            // Se não houver serviços, mostra mensagem e revela o calendário
            if (!this.services || this.services.length === 0) {
                this.container.innerHTML = '<h3>Sem serviços cadastrados</h3><p style="color: var(--text-muted);">O comerciante não cadastrou serviços. Se você for o comerciante, adicione serviços no Dashboard.</p>';
                const cal = document.getElementById('calendarContainer');
                if (cal && cal.classList.contains('hidden')) cal.classList.remove('hidden');
                return;
            }
            this.render();
        } catch (err) {
            console.error(err);
            // Mostrar mensagem de erro mais informativa para diagnóstico
            this.container.innerHTML = `<p style="color: var(--danger-color);">Erro ao carregar serviços: ${err.message}</p>`;
        }
    }

    render() {
        this.container.innerHTML = '<h3>Selecione um Serviço</h3>';
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '10px';

        this.services.forEach(service => {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <div class="service-details">
                    <h4>${service.name}</h4>
                    <div class="service-meta">${service.duration} min</div>
                </div>
                <div class="service-price">${typeof formatPrice === 'function' ? formatPrice(service.price) : ('R$ ' + service.price)}</div>
            `;

            card.onclick = () => {
                this.selectService(service, card);
            };

            list.appendChild(card);
        });

        this.container.appendChild(list);
    }

    selectService(service, element) {
        const prev = this.container.querySelector('.service-card.selected');
        if (prev) prev.classList.remove('selected');

        this.selectedService = service;
        element.classList.add('selected');

        if (this.onServiceSelect) {
            this.onServiceSelect(service);
        }
    }
}
