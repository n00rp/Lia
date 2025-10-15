# Simulink WebView Navigation System

Ett komplett system för att navigera och visualisera Simulink WebView-exporter från flera produktversioner. Systemet skannar automatiskt nätverksmappen, bygger en trädstruktur och tillhandahåller ett intuitivt gränssnitt för navigation.

## 📋 Funktioner

- ✅ **Automatisk filskanning** - Skannar nätverksmappen efter SVG och JSON-filer
- ✅ **Multi-version support** - Hantera flera produktversioner samtidigt
- ✅ **Trädnavigering** - Hierarkisk navigering baserad på filstruktur
- ✅ **SVG-visning** - Rendera och navigera SVG-filer direkt i webbläsaren
- ✅ **Zoom & Pan** - Zooma och panorera SVG-bilder
- ✅ **Tangentbordsgenvägar** - Snabb navigation med tangentbordet
- ✅ **Metadata-support** - Läs och visa JSON-metadata för varje fil

## 🏗️ Projektstruktur

```
Lia/
├── backend/
│   ├── app.py              # Flask-server med API-endpoints
│   ├── config.py           # Konfigurationsfil
│   └── requirements.txt    # Python-dependencies
├── frontend/
│   ├── index.html          # Huvudsida
│   ├── styles.css          # Stilmallar
│   └── app.js              # JavaScript-logik
├── System.md               # Systemarkitektur och plan
└── README.md               # Denna fil
```

## 🚀 Installation

### 1. Backend (Python Flask)

```powershell
# Navigera till backend-katalogen
cd c:\Programing\Lia\backend

# Skapa virtuell miljö (valfritt men rekommenderat)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Installera dependencies
pip install -r requirements.txt
```

### 2. Konfigurera nätverkssökvägen

Öppna `backend/config.py` och uppdatera `NETWORK_PATH` med din faktiska nätverkssökväg:

```python
NETWORK_PATH = r'\\DinNätverksserver\System_Releases'
```

**Alternativt**, använd en lokal testkatalog för utveckling:

```python
USE_NETWORK = False
LOCAL_TEST_PATH = r'C:\TestData\System_Releases'
```

### 3. Starta backend-servern

```powershell
cd c:\Programing\Lia\backend
python app.py
```

Servern startar på `http://localhost:5000`

### 4. Öppna frontend

Öppna `frontend/index.html` i en webbläsare, eller använd en lokal webbserver:

```powershell
cd c:\Programing\Lia\frontend
python -m http.server 8080
```

Öppna sedan `http://localhost:8080` i webbläsaren.

## 📖 Användning

### Steg-för-steg

1. **Startsida** - När du öppnar applikationen ser du alla tillgängliga versioner och produkter
2. **Välj produkt** - Klicka på en produkt (t.ex. PS200) för att ladda den
3. **Navigering** - Systemet laddar automatiskt root-filen (`[Produkt]_d.svg`)
4. **Träd** - Trädet byggs dynamiskt baserat på JSON-metadata
5. **Interaktion med SVG:**
   - **Enkelklick** → Visa metadata (sensor-inställningar, parametrar, etc.)
   - **Dubbelklick** → Navigera till undermodul (om den finns)
6. **Träd-navigation** - Alternativt, använd trädvyn till vänster för att navigera

### Hur det fungerar

Systemet följer denna logik:
```
1. Användare väljer: PS200 (produkt)
2. Användare väljer: 1.0.1.3 (version)
3. Systemet går in i: System_Releases/[version]/support/slwebview_files/
4. Öppnar: PS200_d.svg + PS200_d.json
5. I JSON: Letar efter kategorier med "icon":"SubSystemIcon_icon"
6. Hittar filnamn: t.ex "PS200_23345"
7. När användaren klickar på ikonen: Öppnar PS200_23345.svg + PS200_23345.json
8. Upprepar rekursivt tills inga fler SubSystemIcon_icon finns
```

**Exempel:**
```
PS200_d.json innehåller {"icon":"SubSystemIcon_icon", "name":"PS200_23345"}
    ↓
PS200_23345.svg + PS200_23345.json öppnas
    ↓
PS200_23345.json innehåller {"icon":"SubSystemIcon_icon", "name":"PS200_67890"}
    ↓
PS200_67890.svg + PS200_67890.json öppnas
    ↓
Inga fler SubSystemIcon_icon = botten
```

### Tangentbordsgenvägar

- **+/-** - Zooma in/ut
- **0** - Återställ zoom
- **F** - Anpassa till skärm
- **ESC** - Stäng metadata-popup / Tillbaka till startsidan

### Interaktion

- **Enkelklick på block** - Visa metadata-popup med parametrar och inställningar
- **Dubbelklick på block** - Navigera till undermodul (om den existerar)
- **Hover över block** - Visuell highlight (blå outline)
- **Klick i träd** - Navigera direkt till fil

### API-endpoints

Backend tillhandahåller följande REST API:

- `GET /api/versions` - Lista alla versioner med deras produkter
- `GET /api/version/<version>/products` - Lista produkter för en version
- `GET /api/version/<version>/product/<product>/tree` - Bygg dynamiskt träd för produkt
- `GET /api/version/<version>/file/<filepath>` - Hämta SVG eller JSON fil
- `GET /api/scan` - Skanna om nätverksmappen

## 🔧 Konfiguration

### Miljövariabler

Du kan konfigurera systemet med miljövariabler:

```powershell
# Windows PowerShell
$env:NETWORK_PATH = "\\server\System_Releases"
$env:USE_NETWORK = "True"
$env:DEBUG = "False"
$env:PORT = "5000"
```

### Filstruktur på nätverket

Systemet förväntar sig följande struktur på nätverksmappen:

```
System_Releases/
├── Produkter.03_0.0.0.1/
│   └── support/
│       └── slwebview_files/
│           ├── PS200_d.svg
│           ├── PS200_d.json
│           ├── PS200_23345.svg
│           ├── PS200_23345.json
│           └── ...
├── Produkter.04_0.0.0.1/
│   └── support/
│       └── slwebview_files/
│           └── ...
```

**Sökväg**: `[Version]/support/slwebview_files/`  
**Root-filer**: `[Produkt]_d.svg` + `[Produkt]_d.json`  
**Barn-filer**: `[Filnamn].svg` + `[Filnamn].json` (utan _d)

## 🛠️ Utveckling

### Utöka systemet

1. **Lägg till ny API-endpoint** - Redigera `backend/app.py`
2. **Anpassa UI** - Redigera `frontend/styles.css`
3. **Utöka funktionalitet** - Redigera `frontend/app.js`

### Felsökning

**Backend startar inte:**
- Kontrollera att alla dependencies är installerade
- Verifiera att porten 5000 inte används av annan process

**Inga versioner visas:**
- Kontrollera att `NETWORK_PATH` är korrekt
- Verifiera att du har åtkomst till nätverksmappen
- Kontrollera konsolen för felmeddelanden

**SVG visas inte:**
- Öppna webbläsarens utvecklarverktyg (F12)
- Kontrollera nätverksfliken för fel
- Verifiera att backend är igång

## 📝 Nästa Steg (Framtida Förbättringar)

Baserat på `System.md` är följande funktioner planerade:

- [ ] **Multi-version stapelvisning** - Visa flera versioner samtidigt
- [ ] **Event-synkronisering** - Synkronisera klick och zoom mellan versioner
- [ ] **Förbättrad metadata-navigation** - Navigera baserat på JSON-länkar
- [ ] **Sökfunktion** - Sök efter filer och element
- [ ] **Skillnadsvisning** - Visa skillnader mellan versioner
- [ ] **Caching** - Cachning för snabbare laddning

## 📄 Licens

Detta projekt är skapat för internt bruk.

## 🤝 Bidrag

För frågor eller förbättringsförslag, kontakta projektägaren.
