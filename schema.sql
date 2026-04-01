CREATE TABLE IF NOT EXISTS merchants (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id),
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    service_id INTEGER REFERENCES services(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, concluído, cancelled
    is_plan_renewal BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocked_slots (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    type VARCHAR(50) DEFAULT 'slot' -- horário, dia
);

CREATE TABLE IF NOT EXISTS weekly_availability (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id),
    day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Segunda, ...
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(merchant_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id),
    name VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL, -- duração em minutos
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_profiles (
    merchant_id INTEGER REFERENCES merchants(id),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    birthday DATE,
    PRIMARY KEY (merchant_id, phone)
);
