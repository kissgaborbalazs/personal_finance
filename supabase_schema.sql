-- ============================================
-- HÁZI PÉNZ - Supabase adatbázis séma
-- Futtatás: Supabase Dashboard > SQL Editor
-- ============================================

-- Tételek (bevétel, kiadás, megtakarítás, likvid számla)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'saving', 'liquid')),
    currency TEXT NOT NULL DEFAULT 'HUF' CHECK (currency IN ('HUF', 'EUR')),
    repeat_every_x_months INTEGER NOT NULL DEFAULT 1 CHECK (repeat_every_x_months >= 1),
    start_year INTEGER NOT NULL,
    start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    end_year INTEGER,
    end_month INTEGER CHECK (end_month BETWEEN 1 AND 12),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Havi értékek (expense: összeg + fizetve, income: összeg)
CREATE TABLE monthly_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, year, month)
);

-- Egyenlegek (saving és liquid tételekhez)
CREATE TABLE balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    balance NUMERIC(12, 0) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, year, month)
);

-- EUR/HUF árfolyam cache (naponta frissítve)
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency TEXT NOT NULL,
    rate NUMERIC(10, 4) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexek a gyors lekérdezéshez
-- ============================================
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_active ON items(is_active);
CREATE INDEX idx_monthly_values_item ON monthly_values(item_id);
CREATE INDEX idx_monthly_values_period ON monthly_values(year, month);
CREATE INDEX idx_balances_item ON balances(item_id);
CREATE INDEX idx_balances_period ON balances(year, month);

-- ============================================
-- Alap tételek betöltése (a meglévő sheet alapján)
-- ============================================

-- Bevételek
INSERT INTO items (name, type, currency, repeat_every_x_months, start_year, start_month, sort_order) VALUES
('Kriszta', 'income', 'HUF', 1, 2025, 1, 1),
('Gábor', 'income', 'HUF', 1, 2025, 1, 2),
('Családi pótlék / Társasház', 'income', 'HUF', 1, 2025, 1, 3);

-- Kiadások
INSERT INTO items (name, type, currency, repeat_every_x_months, start_year, start_month, sort_order) VALUES
('Díjbeszedő (havi)', 'expense', 'HUF', 1, 2025, 1, 1),
('Díjbeszedő (kéthavi)', 'expense', 'HUF', 2, 2025, 1, 2),
('Elmű', 'expense', 'HUF', 1, 2025, 1, 3),
('Főtáv', 'expense', 'HUF', 1, 2025, 1, 4),
('One', 'expense', 'HUF', 1, 2025, 1, 5),
('Közösköltség', 'expense', 'HUF', 1, 2025, 1, 6);

-- Megtakarítások / Hitelek
INSERT INTO items (name, type, currency, repeat_every_x_months, start_year, start_month, sort_order) VALUES
('Kincstár / NYESZ', 'saving', 'HUF', 1, 2025, 1, 1),
('Lakáshitel', 'expense', 'HUF', 1, 2025, 1, 7),
('Diákhitel', 'expense', 'HUF', 1, 2025, 1, 8);

-- Likvid számlák
INSERT INTO items (name, type, currency, repeat_every_x_months, start_year, start_month, sort_order) VALUES
('K&H', 'liquid', 'HUF', 1, 2025, 1, 1),
('Erste', 'liquid', 'HUF', 1, 2025, 1, 2),
('Készpénz', 'liquid', 'HUF', 1, 2025, 1, 3),
('Wise', 'liquid', 'EUR', 1, 2025, 1, 4);

-- Megtakarítási számlák
INSERT INTO items (name, type, currency, repeat_every_x_months, start_year, start_month, sort_order) VALUES
('NYESZ (Kriszta)', 'saving', 'HUF', 1, 2025, 1, 2),
('NYESZ (Gábor)', 'saving', 'HUF', 1, 2025, 1, 3),
('Kincstár', 'saving', 'HUF', 1, 2025, 1, 4),
('Lightyear', 'saving', 'HUF', 1, 2025, 1, 5);

-- ============================================
-- Row Level Security (RLS) - opcionális
-- Ha több user lesz, itt kell kibővíteni
-- ============================================
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Egyelőre mindenki olvashat/írhat (single user app)
CREATE POLICY "public_all" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON monthly_values FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- AUTH BEKAPCSOLÁSA UTÁN FUTTATANDÓ
-- Supabase Dashboard > Authentication > Enable Email provider
-- Majd hozz létre egy felhasználót:
--   Authentication > Users > Invite user
-- Végül futtasd le az alábbi policy frissítéseket:
-- ============================================

-- Régi public policy-k törlése
DROP POLICY IF EXISTS "public_all" ON items;
DROP POLICY IF EXISTS "public_all" ON monthly_values;
DROP POLICY IF EXISTS "public_all" ON balances;
DROP POLICY IF EXISTS "public_all" ON exchange_rates;

-- Csak bejelentkezett user férhet hozzá
CREATE POLICY "auth_only" ON items          FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON monthly_values FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON balances       FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON exchange_rates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- MIGRATION: default_amount oszlop hozzáadása
-- Futtasd le a Supabase SQL Editorban
-- ============================================
ALTER TABLE items ADD COLUMN IF NOT EXISTS default_amount NUMERIC(12, 0) DEFAULT NULL;

-- ============================================
-- MIGRATION: is_liquid oszlop hozzáadása (saving tételekhez)
-- Jelöli, hogy a megtakarítás likvid-e (beleszámít a felhasználható összegbe)
-- ============================================
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN NOT NULL DEFAULT FALSE;
