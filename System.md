# Plan för eget Multi-Version Navigationssystem med SVG och JSON

---

## Övergripande Mål

Bygga ett fullständigt system som hanterar flera versioner av ett produktdesignprojekt genom att läsa och manipulera rådatafiler:
- Ladda och rendera versioners SVG-bilder direkt
- Navigera via JSON-metadatan med klickbara ikoner
- Synkronisera navigation och användarinmatning över versioner i ett “pappersstapels”-gränssnitt

---

## Systemarkitektur och Komponenter

### Backend

- Serverar statiska filer: SVG och JSON
- API för att lista versioner och filstruktur
- Eventuell cache och validering

### Frontend

- UI för versionsval och trädvy-navigering byggd från JSON
- Laddar varje versions SVG i rätt container (stackad med CSS z-index)
- Fångar användarinteraktion på aktiv version (överst i stapeln)
- Replikerar användarens klick, zoom och pan till underliggande versioner via syntetiska DOM-events
- Hanterar laddning av nya SVG/JSON vid navigering enligt metadata

### Inbäddad Skriptlogik i Frontend

- Klickdetektion på SVG-element med event listeners
- Navigering via JSON: läser ut nästa SVG och dess JSON
- Zoom- och panfunktionalitet implementeras genom js-bibliotek eller egen kod
- Event-synkronisering med postMessage- eller intern händelsehantering

---

## Byggflöde & Ordning

1. Backend - bygg filserver och versionlista-API
2. Frontend UI - la version dropdown & trädstruktur
3. Ladda och visa SVG & JSON i respektive container
4. Implementera klickhantering och dynamisk navigation
5. Bygg “pappersstapel” och system för eventfångst
6. Skapa replikering av input (klick, zoom, pan) till alla versioner
7. Lägg till fallback och UI-feedback för skillnader mellan versioner
8. Förbättra visuella komponenter, sök, höjdpunkter och skillnadsvisningar

---

## Teknikstack

| Funktion         | Verktyg / Bibliotek                      |
|------------------|-----------------------------------------|
| Backend          | Python 3, Flask/FastAPI                  |
| Filserver        | Flask statisk filserver eller alternativ |
| UI & Logik       | React/Vue eller Vanilla JS + HTML/CSS  |
| SVG-rendering    | Inline SVG, fetch + DOM-manipulation    |
| Klick & Events   | JS EventListeners                        |
| Zoom & Pan       | svg-pan-zoom, D3.js eller eget          |
| Event Sync       | postMessage, dispatchEvent               |

---

## Kort sammanfattning

- Systemet hanterar SVG+JSON som rådata.
- Navigering baseras på JSON-metadata och klick på SVG-objekt.
- Synkronisering sker genom att “spela om” användarinmatning i alla versioner.
- UI visar versioner som lager av “papper” där toppen styr.

---

