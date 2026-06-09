import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authRepo = {
    getSession:   ()            => db.auth.getSession(),
    signIn:       (email, pass) => db.auth.signInWithPassword({ email, password: pass }),
    signOut:      ()            => db.auth.signOut(),
    onAuthChange: (cb)          => db.auth.onAuthStateChange(cb),
};

// ── Segédfüggvény: tétel aktív-e adott hónapban ──────────────────────────────
export function isItemActiveInMonth(item, year, month) {
    const itemStart = item.start_year * 12 + item.start_month;
    const target    = year * 12 + month;
    if (target < itemStart) return false;
    if (item.end_year && item.end_month && target > item.end_year * 12 + item.end_month) return false;
    return (target - itemStart) % item.repeat_every_x_months === 0;
}

// ── Tételek ───────────────────────────────────────────────────────────────────
export const itemsRepo = {
    getAll:     ()         => db.from('items').select('*').order('sort_order'),
    insert:     (item)     => db.from('items').insert(item).select().single(),
    update:     (id, data) => db.from('items').update(data).eq('id', id).select().single(),
    deactivate: (id)       => db.from('items').update({ is_active: false }).eq('id', id),
};

// ── Havi értékek ──────────────────────────────────────────────────────────────
export const valuesRepo = {
    getForMonth: (year, month) =>
        db.from('monthly_values').select('*').eq('year', year).eq('month', month),

    upsert: (item_id, year, month, amount, is_paid = false) =>
        db.from('monthly_values')
            .upsert({ item_id, year, month, amount, is_paid }, { onConflict: 'item_id,year,month' })
            .select().single(),
};

// ── Egyenlegek ────────────────────────────────────────────────────────────────
export const balancesRepo = {
    getForMonth: (year, month) =>
        db.from('balances').select('*').eq('year', year).eq('month', month),

    upsert: (item_id, year, month, balance) =>
        db.from('balances')
            .upsert({ item_id, year, month, balance }, { onConflict: 'item_id,year,month' })
            .select().single(),
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
            const json = await fetch('https://api.frankfurter.app/latest?from=EUR&to=HUF').then(r => r.json());
            const rate = json.rates.HUF;
            await db.from('exchange_rates').insert({ currency: 'EUR', rate });
            return rate;
        } catch { return 395; }
    },
    get: async () => {
        const cached = await rateRepo.getCached();
        if (cached && (Date.now() - new Date(cached.fetched_at)) / 3600000 < 24) return parseFloat(cached.rate);
        return rateRepo.fetchAndCache();
    }
};
