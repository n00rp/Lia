# 🔧 Felsökningsguide

## 🚨 Vanliga problem och lösningar

### Problem 1: Backend startar inte

**Symptom:** `python app.py` ger felmeddelande

**Lösningar:**
```powershell
# 1. Kontrollera Python-version
python --version  # Ska vara 3.7+

# 2. Installera dependencies
cd backend
pip install -r requirements.txt

# 3. Kolla om port 5000 är upptagen
netstat -ano | findstr :5000
# Om upptagen, döda processen eller ändra port i app.py
```

---

### Problem 2: "Kunde inte ladda versioner"

**Symptom:** Startsidan visar rött felmeddelande

**Lösningar:**
1. **Kontrollera att backend körs:**
   ```powershell
   # Öppna i browser:
   http://localhost:5000/api/versions
   # Ska visa JSON med versioner
   ```

2. **Kontrollera NETWORK_PATH:**
   ```python
   # I backend/app.py, rad 18:
   NETWORK_PATH = r"\\DinServer\System_Releases"  # Uppdatera denna!
   ```

3. **Testa med lokal mapp:**
   ```powershell
   cd backend
   python test_config.py  # Skapar teststruktur
   ```
   
   Ändra sedan i `app.py`:
   ```python
   NETWORK_PATH = r"C:\TestData\System_Releases"
   ```

---

### Problem 3: Inga versioner visas

**Symptom:** Startsidan visar "Inga versioner hittades"

**Diagnos:**
```powershell
# Öppna backend konsol och leta efter:
"Hittade X versioner"
```

**Lösningar:**

1. **Fel filstruktur:**
   ```
   ✅ Korrekt:
   System_Releases/
   └── Produkter.03_1.0.1.3/
       └── support/
           └── slwebview_files/
               ├── PS200_d.svg
               └── PS200_d.json
   
   ❌ Fel:
   System_Releases/
   └── Produkter.03_1.0.1.3/
       ├── PS200_d.svg  # Fel plats!
       └── PS200_d.json
   ```

2. **Felaktigt versionsmönster:**
   - Backend letar efter: `\d+[_.]\d+\.\d+\.\d+\.\d+`
   - Exempel: `03_1.0.1.3`, `04_2.0.0.1`

---

### Problem 4: Inga produkter under version

**Symptom:** Version visas men "0 produkt(er)"

**Lösningar:**

1. **Kontrollera att det finns `*_d.svg` filer:**
   ```
   slwebview_files/
   ├── PS200_d.svg     ✅ Hittas
   ├── PS200_d.json    ✅ Hittas
   ├── PS200_23345.svg ❌ Hittas INTE (saknar _d suffix)
   ```

2. **Kolla backend konsol:**
   ```
   "Hittade X root-produkter"
   ```

---

### Problem 5: Trädet byggs inte

**Symptom:** Efter att valt produkt, trädet visar "Laddar träd..."

**Diagnos:**
Öppna DevTools (F12) → Console

**Lösningar:**

1. **Fel i JSON-struktur:**
   ```json
   // Backend letar efter:
   {
     "icon": "SubSystemIcon_icon",
     "id": "PS200:23345",       // Valfritt
     "name": "PS200_23345"      // Krävs för att hitta fil
   }
   ```

2. **Filer saknas:**
   - Om JSON har `"name":"PS200_23345"`
   - Men `PS200_23345.svg` eller `PS200_23345.json` saknas
   - → Barn-nod skapas inte

3. **Kolla backend konsol:**
   ```
   "⚠️ SubSystemIcon utan filnamn: {...}"  # JSON har ingen användbar info
   ```

---

### Problem 6: SVG laddas inte

**Symptom:** Vit skärm eller "Ingen fil vald"

**Diagnos:**
DevTools → Network → Kolla om SVG-request failar

**Lösningar:**

1. **CORS-problem:**
   - Backend har redan `CORS(app)` aktiverat
   - Men kolla att frontend öppnas korrekt (ej file://)

2. **Fel sökväg:**
   - Backend loggar: `"Fil laddad: [filnamn]"`
   - Om ingen logg → fel i sökvägen

---

### Problem 7: Klick i SVG fungerar inte

**Symptom:** Ingenting händer när man klickar på element

**Diagnos:**
DevTools → Console → Se vad som loggas

**Debug-log att leta efter:**
```javascript
"Klickbara element: [...]"           // Vad JSON innehåller
"Klickbart element aktiverat: ..."   // SVG-element hittades
"SVG-element klickat: PS200:23345"   // Du klickade
"Hittade klickbart element: {...}"   // Mappning funnen
"Navigerar till: PS200_23345"        // Navigering sker
```

**Lösningar:**

1. **Inget loggas:**
   - SVG-element har inget `id`-attribut
   - JSON har ingen `SubSystemIcon_icon`

2. **"Inget klickbart element hittades":**
   - ID-mappning fungerar inte
   - Testa fallback: Alla element ska vara klickbara

3. **"Fil finns inte":**
   - JSON pekar på fil som inte existerar
   - Kontrollera att `[namn].svg` och `[namn].json` finns

---

### Problem 8: Zoom fungerar inte

**Symptom:** +/- tangenter gör ingenting

**Lösningar:**

1. **Focus på input-fält:**
   - Klicka utanför input-fält först
   - Tangentbordsgenvägar är disabled i input

2. **Testa knappar:**
   - Använd zoom-knapparna i toolbar
   - Om knappar fungerar → tangentbords-listener problem

---

### Problem 9: "Tillbaka"-knapp fungerar inte

**Symptom:** Klick på "← Tillbaka" gör ingenting

**Diagnos:**
Console → Leta efter JavaScript-fel

**Lösning:**
Refresh sidan (F5) och försök igen

---

## 🔍 Debug-tips

### Se alla console-logs
```javascript
// I DevTools Console:
console.log(window.appState);      // Se current state
console.log(window.appElements);   // Se DOM-elements
```

### Testa API direkt
```
http://localhost:5000/api/versions
http://localhost:5000/api/version/03_1.0.1.3/products
http://localhost:5000/api/version/03_1.0.1.3/product/PS200/tree
```

### Backend verbose logging
```python
# I backend/app.py, lägg till överallt:
print(f"DEBUG: {variabel}")
```

---

## 📞 Om inget funkar

1. **Starta om allt:**
   ```powershell
   # Stäng backend (Ctrl+C)
   # Stäng browser
   # Starta om:
   cd backend
   python app.py
   # Öppna frontend/index.html
   ```

2. **Rensa browser cache:**
   - Ctrl + Shift + Delete
   - Rensa cache
   - Ladda om (F5)

3. **Testa med lokal teststruktur:**
   ```powershell
   cd backend
   python test_config.py
   ```

4. **Kolla om filer är korrupta:**
   - Öppna SVG i browser direkt
   - Öppna JSON i text editor
   - Validera JSON: https://jsonlint.com/

---

## ✅ Systemet fungerar när:

- ✅ Backend loggar: `"Skannar nätverksmapp: ..."`
- ✅ Backend loggar: `"Hittade X versioner"`
- ✅ Startsida visar versionskort
- ✅ Console loggar: `"Klickbara element: [...]"`
- ✅ SVG visas och element är klickbara
- ✅ Trädet byggs och uppdateras
