# HáziPénz – CLAUDE.md

## A projekt célja

Háztartási pénzügyi nyílvántartó webalkalmazás (PWA), amely segít követni a havi bevételeket, kiadásokat, megtakarításokat és likvid számlaegyenlegeket.

## Technológiai stack

- **Frontend:** Vanilla JavaScript (ES modules), HTML5, CSS3 – keretrendszer nélkül
- **Backend / adatbázis:** Supabase (PostgreSQL + Auth + REST API)
- **Hosting:** GitHub Pages
- **PWA:** service worker, manifest.json, telepíthető mobil/desktop alkalmazásként

## Fájlstruktúra

```
├── index.html            – Belépési pont, betölti az app.js-t
├── manifest.json         – PWA konfiguráció
├── supabase_schema.sql   – Adatbázis séma + migrációk (Supabase SQL Editorban futtatandó)
├── css/
│   └── style.css         – Teljes UI stílus (dark theme, mobilra optimalizált)
└── js/
    ├── config.js         – Supabase URL + anon key (nem kerülhet verziókezelésbe)
    ├── db.js             – Adatbázis réteg: itemsRepo, valuesRepo, balancesRepo, rateRepo, authRepo
    ├── app.js            – Alkalmazás logika és renderelés
    └── service-worker.js – Offline cache
```

## Adatmodell

| Tábla            | Leírás                                                    |
|------------------|-----------------------------------------------------------|
| `items`          | Tételek: bevétel, kiadás, megtakarítás, likvid számla     |
| `monthly_values` | Havi összeg + fizetve-e jelző (expense/income tételekhez) |
| `balances`       | Havi egyenleg (saving és liquid tételekhez)               |
| `exchange_rates` | EUR/HUF árfolyam cache                                    |

### Tétel típusok (`items.type`)

- `income` – bevétel (pl. fizetés)
- `expense` – kiadás (pl. rezsiszámlák), kifizetési jelölővel (pay-toggle)
- `saving` – megtakarítás, egyenleg nyílvántartással
- `liquid` – likvid számla, egyenleg nyílvántartással

### Fontos mezők (`items`)

- `default_amount` – alapértelmezett összeg; `getAmount()` visszaesik rá, ha nincs havi bejegyzés
- `repeat_every_x_months` – ismétlési periódus; `isItemActiveInMonth()` számolja ki az aktivitást
- `start_year/month`, `end_year/month` – tétel érvényességi időszaka

## Architektúra

**Rétegek:**
1. `db.js` – Supabase hívások, pure data layer (repos: `itemsRepo`, `valuesRepo`, `balancesRepo`, `rateRepo`, `authRepo`)
2. `app.js` – állapot (`state` objektum), renderelés, eseménykezelés
3. `window.app` – publikus API az inline HTML onclick attribútumokhoz

**Állapot (`state`):**
```js
{ year, month, items[], values{}, balances{}, eurRate, loading, user }
```

**Render flow:** `loadData()` → `state` frissítés → `render()` → `renderMonthView()` → HTML string inject

## Claude feladatai ebben a projektben

1. **Funkciófejlesztés** – Új nézetek (éves összesítő, predikció), szűrők, statisztikák
2. **UI/UX javítás** – Stílusmódosítások `css/style.css`-ben, mobilbarát fejlesztések
3. **Adatbázis bővítés** – Schema módosítások és migrációk `supabase_schema.sql`-ben
4. **Hibajavítás** – Logikai hibák, edge case-ek kezelése
5. **Refaktorálás** – `db.js` réteg bővítése, `app.js` tisztítása

## Fejlesztési irányok (backlog)

- [ ] Éves összesítő nézet (hónapok mint oszlopok)
- [ ] Predikciós nézet (várható egyenleg jövő hónapokra)
- [ ] Beállítások képernyő (EUR árfolyam kézi megadása, tételek kezelése)
- [ ] Több felhasználó támogatása (per-user RLS bővítés)

## Fontos tudnivalók

- Az alkalmazás **egyfelhasználós**; a Supabase RLS jelenleg `auth.role() = 'authenticated'` alapon véd
- EUR összegek `state.eurRate`-tel kerülnek HUF-ba konvertálva (napi cache, frankfurter.app API)
- A bottom nav gombok (Év, Predikció, Beállítás) **még nem implementáltak**
- `config.js` tartalmaz Supabase credentials-t – az `anon` kulcs **szándékosan publikus**, bátran kerülhet a repóba; a biztonságot az RLS policy-k adják, nem a kulcs titkossága
- A kód, kommentek és UI szövegek magyarul írhatók
