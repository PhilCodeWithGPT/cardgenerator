# 🎴 Munchkin-Kartengenerator (deutsche Fassung)

> 🌐 [English](README.md) · [Français](README.fr.md)

**Erstelle eigene Munchkin-Karten mit KI-generierten Bildern.** Entwirf, bearbeite und exportiere deine eigenen Karten für das beliebte Kartenspiel.

Dieser Fork von [chichekebbab/cardgenerator](https://github.com/chichekebbab/cardgenerator) ergänzt eine vollständige **deutsche Übersetzung** – für die Oberfläche und für die Beschriftungen auf den Karten (Stufen, Schätze, Schlimme Dinge, Groß, Reittier …). Deutsch ist voreingestellt; Französisch und Englisch bleiben über die Fußzeile bzw. die Einstellungen wählbar.

---

## ✨ Funktionen

- 🎨 **KI-Bildgenerierung** – Google Gemini erzeugt einzigartige Kartenbilder
- 🤖 **Erstellungs-Assistent** – schlägt Titel, Werte und Texte in der gewählten Spielsprache vor
- ✂️ **Hintergrund entfernen** – remove.bg-Anbindung für saubere Kartenbilder
- 🃏 **Viele Kartentypen** – Monster, Gegenstände, Flüche, Tür-Boni und mehr
- 🖼️ **Eigene Layouts** – lade eigene Kartenvorlagen hoch
- 📊 **Deck-Verwaltung** – Karten nach Kategorie ordnen, Fortschritt verfolgen
- 💾 **Import/Export** – CSV/JSON-Import, PNG-Export in Paketen und PDF-Druckbögen (A4)
- 🌍 **Mehrsprachig** – Deutsch, Englisch und Französisch, für Oberfläche und Karteninhalt
- 📱 **Responsiv** – läuft auf Desktop, Tablet und Smartphone

---

## 🚀 Schnellstart

```bash
git clone https://github.com/PhilCodeWithGPT/cardgenerator.git
cd cardgenerator
npm install
npm run dev
```

Dann `http://localhost:5173` öffnen – fertig.

### API-Schlüssel (optional)

Die App funktioniert auch ohne API-Schlüssel. Für die KI-Funktionen:

1. In der App auf das Zahnrad **⚙️ Einstellungen** klicken
2. Schlüssel eintragen:
   - **[Google Gemini API](https://aistudio.google.com/app/apikey)** – für die Bildgenerierung
   - **[Remove.bg API](https://www.remove.bg/api)** – zum Entfernen des Hintergrunds
3. Die Schlüssel werden nur lokal im Browser gespeichert.

---

## 🛠️ Technik

|              |                             |
| ------------ | --------------------------- |
| **Frontend** | React 19 + TypeScript       |
| **Build**    | Vite 6                      |
| **Styling**  | Tailwind CSS                |
| **KI**       | Google Gemini API           |
| **Export**   | html-to-image, JSZip, jsPDF |

```bash
npm run dev          # Entwicklungsserver
npm run lint         # Lint
npm run test:ci      # Tests
npm run build        # Produktions-Build
```

Übersetzungen liegen in `i18n/translations/` (`de.ts`, `en.ts`, `fr.ts`), die Beschriftungen auf den Karten in `utils/cardLabels.ts`.

---

## ⚠️ Hinweis

Dies ist ein **inoffizielles Fan-Tool**. Munchkin ist eine Marke von Steve Jackson Games. Dieses Projekt steht in keiner Verbindung zu Steve Jackson Games und wird von SJG weder unterstützt noch gesponsert.

## 📄 Lizenz

[MIT](LICENSE)
