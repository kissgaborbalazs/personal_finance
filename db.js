import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Segédfüggvény: tétel aktív-e adott hónapban ──────────────────────────────
export function isItemActiveInMonth(item, year, month) {
    const itemStart = item.start_year * 12 + item.start_month;
    const target = year * 12 + month;
    if (target < itemStart) return false;
    if (item.end_year && item.end_month) {
        const itemEnd = item.end_year * 12 + item.end_month;
        if (target > itemEnd) return false;
    }
    // Ismétlődés ellenőrzés
    const diff = target - itemStart;
    return diff % item.repeat_every_x_months === 0;
}

// ── Tételek ──────────────────────────────────────────────────────────────────
export const itemsRepo = {
    getAll: () => db.from('items').select('*').order('sort_order'),
    getByType: (type) => db.from('items').select('*').eq('type', type).eq('is_active', true).order('sort_order'),
    insert: (item) => db.from('items').insert(item).select().single(),
    update: (id, data) => db.from('items').update(data).eq('id', id).select().single(),
    deactivate: (id) => db.from('items').update({ is_active: false }).eq('id', id),
};

// ── Havi értékek ─────────────────────────────────────────────────────────────
export const valuesRepo = {
    getForMonth: (year, month) =>
        db.from('monthly_values').select('*').eq('year', year).eq('month', month),

    upsert: (item_id, year, month, amount, is_paid = false) =>
        db.from('monthly_values').upsert(
            { item_id, year, month, amount, is_paid },
            { onConflict: 'item_id,year,month' }
        ).select().single(),

    setPaid: (item_id, year, month, is_paid) =>
        db.from('monthly_values')
            .update({ is_paid })
            .eq('item_id', item_id).eq('year', year).eq('month', month),
};

// ── Egyenlegek ────────────────────────────────────────────────────────────────
export const balancesRepo = {
    getForMonth: (year, month) =>
        db.from('balances').select('*').eq('year', year).eq('month', month),

    upsert: (item_id, year, month, balance) =>
        db.from('balances').upsert(
            { item_id, year, month, balance },
            { onConflict: 'item_id,year,month' }
        ).select().single(),
};

// ── EUR/HUF árfolyam ──────────────────────────────────────────────────────────
export const rateRepo = {
    getCached: async () => {
        const { data } = await db.from('exchange_rates')
            .select('*').eq('currency', 'EUR')
            .order('fetched_at', { ascending: false }).limit(1).single();
        return data;
    },

    fetchAndCache: async () => {
        try {
            const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=HUF');
            const json = await res.json();
            const rate = json.rates.HUF;
            await db.from('exchange_rates').insert({ currency: 'EUR', rate });
            return rate;
        } catch {
            return 395; // fallback árfolyam
        }
    },

    get: async () => {
        const cached = await rateRepo.getCached();
        if (cached) {
            const age = (Date.now() - new Date(cached.fetched_at)) / 3600000;
            if (age < 24) return parseFloat(cached.rate);
        }
        return rateRepo.fetchAndCache();
    }
};
