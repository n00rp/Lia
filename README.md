# Simulink WebView Navigation System

Ett komplett system för att navigera och visualisera Simulink WebView-exporter från flera produktversioner. Systemet skannar automatiskt nätverksmappen, bygger en hierarkisk trädstruktur baserat på `diagrams_1.json`, och tillhandahåller ett intuitivt gränssnitt för navigation.

## 📋 Funktioner

- ✅ **Hierarki-baserad navigation** - Bygger träd från `diagrams_1.json` med korrekt parent-child-relationer
- ✅ **Automatisk produktskanning** - Skannar nätverksmappen efter WebView-exporter
- ✅ **Multi-version support** - Hantera flera produktversioner per produkt
- ✅ **Smart klickbarhet** - Identifierar SubSystems och ModelReferences automatiskt
- ✅ **SVG-visning** - Rendera och navigera SVG-filer direkt i webbläsaren
- ✅ **Zoom & Pan** - Zooma och panorera SVG-bilder
- ✅ **Tangentbordsgenvägar** - Snabb navigation med tangentbordet
- ✅ **Metadata-support** - Visa block-information vid klick

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

Systemet använder miljövariabeln `RELEASES_DIR` eller standard-sökvägen:

```python
# I backend/app.py
NETWORK_PATH = Path(os.getenv('RELEASES_DIR', r"\\FS01\release_hub$\System_Releases")).resolve()
```

**Alternativt**, sätt miljövariabel:

```powershell
# Windows PowerShell
$env:RELEASES_DIR = "\\DinServer\System_Releases"
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

1. **Välj produkt** - Startsidan visar alla tillgängliga produkter (t.ex. PS200, ACC100)
2. **Välj version** - Klicka på en produkt för att se alla versioner
3. **Ladda träd** - Välj version, systemet laddar `diagrams_1.json` och bygger hierarkin
4. **Root-vy** - Systemet visar automatiskt root-SVG:n (`[Produkt]_d.svg`)
5. **Interaktion med SVG:**
   - **Enkelklick** → Visa metadata-popup med block-information
   - **Dubbelklick** → Navigera till undermodul (SubSystem eller ModelReference)
6. **Träd-navigation** - Använd sidopanelen för att navigera direkt till noder

### Hur det fungerar

Systemet använder **hierarki-baserad navigation** via `diagrams_1.json`:

```
1. Backend läser: [Produkt]_diagrams_1.json
2. Hittar root-nod (parent == 0)
3. För varje nod:
   - Kollar elements array
   - Identifierar SubSystemIcon_icon och MdlRefBlockIcon_icon
   - Bygger filnamn: [Produkt]_[SID-nummer]_d.svg
   - Kollar om SVG finns → Klickbar!
4. Navigering:
   - SubSystem (internal) → Navigera via hid till barn-nod
   - ModelReference (external) → Visa SVG (ev. egen hierarki)
   - Leaf node → Ingen vidare navigation
```

**Exempel: PS200 hierarki**
```
PS200 (hid:1, root)
  └─ elements: [InitErrorEvaluation, Model]
     │
     ├─ InitErrorEvaluation (hid:2, sid:PS200:34341)
     │  └─ SVG: PS200_34341_d.svg
     │  └─ hierarchy_type: internal
     │
     └─ Model (hid:3, sid:PS200:20633)
        └─ SVG: PS200_20633_d.svg
        └─ elements: [Detections, FunctionControl, StateControlFeedback]
           │
           ├─ Detections (ModelRef, external hierarchy)
           │  └─ SVG: PS200_51716_d.svg
           │  └─ hierarchy_type: external
           │
           └─ StateControlFeedback (hid:558, internal)
              └─ SVG: PS200_51722_d.svg
              └─ hierarchy_type: internal
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

- `GET /api/products` - Lista alla produkter med versionsantal
- `GET /api/product/<product>/versions` - Lista versioner för en produkt
- `GET /api/product/<product>/version/<version>/tree` - Bygg hierarkiskt träd från diagrams_1.json
- `GET /api/product/<product>/version/<version>/file/<filepath>` - Hämta SVG eller JSON fil
- `GET /api/scan` - Skanna om nätverksmappen
- `GET /` - API-information och dokumentation

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

Systemet förväntar sig följande struktur:

```
System_Releases/
├── [Produkt]_[Version]/
│   └── WebView_[Produkt]/
│       └── support/
│           └── slwebview_files/
│               ├── [Produkt]_diagrams_1.json  ← Hierarki-fil (VIKTIG!)
│               ├── [Produkt]_d.svg
│               ├── [Produkt]_d.json
│               ├── [Produkt]_[SID]_d.svg      ← SubSystem SVG
│               ├── [Produkt]_[SID]_d.json
│               ├── [ModelRef]_diagrams_1.json ← Extern hierarki (om ModelRef)
│               └── ...
├── PS200_1.0.2.5/
│   └── WebView_PS200/
│       └── support/
│           └── slwebview_files/
│               ├── PS200_diagrams_1.json
│               ├── PS200_d.svg
│               ├── PS200_34341_d.svg  ← InitErrorEvaluation
│               ├── PS200_20633_d.svg  ← Model
│               └── PS200_51722_d.svg  ← StateControlFeedback
```

**Nyckelkomponenter:**
- `[Produkt]_diagrams_1.json` - Innehåller hela hierarkin med hid, sid, children, elements
- `[Produkt]_d.svg` - Root SVG-fil
- `[Produkt]_[SID]_d.svg` - SubSystem/ModelReference SVG (SID från elements array)

**Mappningslogik:**
```javascript
// Från diagrams_1.json:
element.sid = "PS200:51722"  →  PS200_51722_d.svg
element.sid = "PS200:34341"  →  PS200_34341_d.svg
```

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

## 🔑 Teknisk Implementation

### Backend-logik (Python Flask)

**Hierarki-byggande:**
```python
1. Läs [Produkt]_diagrams_1.json
2. Bygg lookup-tabeller: nodes_by_hid, nodes_by_sid
3. För varje nod:
   - Gå igenom elements array
   - Filtrera: icon == 'SubSystemIcon_icon' eller 'MdlRefBlockIcon_icon'
   - Bygg filnamn: [Produkt]_[SID-nummer]_d.svg
   - Kolla om SVG finns → clickable_elements.append()
4. Matcha clickable mot children array:
   - Om element.sid finns i barn → hierarchy_type = 'internal'
   - Om ModelRef med egen diagrams_1.json → hierarchy_type = 'external'
   - Annars → hierarchy_type = 'leaf'
5. Bygg träd rekursivt för barn
```

**Returdata:**
```javascript
{
  name, hid, sid, svg, json,
  clickable_elements: [
    {sid, name, svg, hid, hierarchy_type, external_hierarchy}
  ],
  children: [rekursiva barn-noder]
}
```

### Frontend-logik (JavaScript)

**Dubbelklick-hantering:**
```javascript
1. Hitta SVG-element via sid (t.ex. "PS200:34341")
2. Vid dubbelklick:
   - Om hierarchy_type === 'internal':
     → Hitta barn via hid i children array
     → loadNode(matchingChild)
   - Om hierarchy_type === 'external':
     → Visa SVG (TODO: Ladda extern hierarki)
   - Om hierarchy_type === 'leaf':
     → Visa meddelande (ingen vidare navigation)
```

## 📝 Nästa Steg (Framtida Förbättringar)

- [ ] **Extern hierarki-stöd** - Fullt stöd för ModelReferences med egna diagrams_1.json
- [ ] **Multi-version jämförelse** - Visa flera versioner sida vid sida
- [ ] **Sökfunktion** - Sök efter element via namn/sid
- [ ] **Breadcrumb-navigation** - Visa aktuell sökväg (PS200 > Model > StateControlFeedback)
- [ ] **Export-funktion** - Exportera hierarki som PDF/PNG
- [ ] **Prestanda-optimering** - Lazy loading av stora träd

## 📄 Licens

Detta projekt är skapat för internt bruk.

## 🤝 Bidrag

För frågor eller förbättringsförslag, kontakta projektägaren.
