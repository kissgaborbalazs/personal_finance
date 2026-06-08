# HáziPénz – Telepítési útmutató

## 1. Supabase projekt létrehozása

1. Regisztrálj: https://supabase.com
2. Új projekt létrehozása (ingyenes tier)
3. **SQL Editor** → másold be a `supabase_schema.sql` tartalmát → Run
4. **Project Settings → API**:
   - `Project URL` → másold be a `js/config.js`-be: `SUPABASE_URL`
   - `anon / public` key → másold be: `SUPABASE_ANON_KEY`

## 2. Ikonok generálása (opcionális)

Az `icons/` mappába kell:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Gyors generálás: https://realfavicongenerator.net

## 3. Hosting – GitHub Pages (ajánlott)

```bash
# 1. GitHub repo létrehozása
git init
git add .
git commit -m "HáziPénz initial"
git remote add origin https://github.com/FELHASZNALONEV/hazipenz.git
git push -u origin main

# 2. GitHub → Settings → Pages → Source: main branch
# 3. Az app elérhető: https://FELHASZNALONEV.github.io/hazipenz
```

## 4. PWA telepítése

### Android (Chrome)
- Nyisd meg az URL-t Chrome-ban
- ⋮ menü → **"Hozzáadás a kezdőképernyőhöz"**

### iOS (Safari)
- Nyisd meg az URL-t Safari-ban
- Megosztás gomb (□↑) → **"Hozzáadás a főképernyőhöz"**

### Desktop (Chrome/Edge)
- Nyisd meg az URL-t
- Jobb felső sarokban megjelenik a **telepítés ikon** (⊕)
- Kattints rá → telepítve

## 5. Keep-alive beállítása (opcionális)

Ha nem nyitod meg hetente legalább egyszer az appot, a Supabase free tier "alszik".

1. Menj: https://cron-job.org
2. Új job: `GET https://XXXXX.supabase.co/rest/v1/items?limit=1`
3. Header: `apikey: ANON_KEY`
4. Ütemezés: naponta egyszer

## Fájlstruktúra

```
hazipenz/
├── index.html          ← Főoldal
├── manifest.json       ← PWA konfig
├── service-worker.js   ← Offline cache
├── supabase_schema.sql ← Adatbázis séma (egyszer futtatandó)
├── css/
│   └── style.css       ← Stílusok
├── js/
│   ├── config.js       ← Supabase credentials (TÖLTSD KI!)
│   ├── db.js           ← Adatbázis réteg
│   └── app.js          ← Alkalmazás logika
└── icons/
    ├── icon-192.png    ← PWA ikon
    └── icon-512.png    ← PWA ikon
```
