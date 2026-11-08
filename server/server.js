'use strict';
/**
 * Mattis Munchkin Editor – kleiner Speicher-Server (ohne Fremdpakete).
 *
 * Läuft hinter nginx (/api/ → hier) und Caddy (Basic-Auth). Daten unter DATA_DIR:
 *   cards/<id>.json     eine Datei pro Karte
 *   images/<id>-<t>.<ext>  Kartenbild (aus imageData beim Speichern)
 *   trash/              gelöschte Karten + Bilder (nicht endgültig gelöscht)
 *
 * API:
 *   GET    /api/health
 *   GET    /api/cards              → Liste aller Karten (älteste zuerst)
 *   PUT    /api/cards/:id          → Karte speichern; imageData wird als Datei abgelegt
 *   DELETE /api/cards/:id          → Karte in den Papierkorb
 *   GET    /api/images/:file       → Bild
 *   POST   /api/spellcheck         → Rechtschreibprüfung der Kartentexte (OpenAI, Modell Luna)
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || '/data';
const CARDS = path.join(DATA_DIR, 'cards');
const IMAGES = path.join(DATA_DIR, 'images');
const TRASH = path.join(DATA_DIR, 'trash');
const MAX_BODY = 25 * 1024 * 1024; // Bild als Base64 + Karte
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_CARDS = 3000;

// KI-Rechtschreibprüfung (Schlüssel nur aus der Umgebung, nie im Frontend)
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna';
const OPENAI_REASONING = process.env.OPENAI_REASONING || 'low';
const SPELL_MAX_PER_DAY = parseInt(process.env.SPELL_MAX_PER_DAY || '200', 10);
const SPELL_MAX_FIELD = 3000;
const SPELL_FIELDS = ['title', 'restrictions', 'description', 'badStuff'];
const USAGE_FILE = path.join(DATA_DIR, 'ai-usage.json');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const IMAGE_FILE_RE = /^[A-Za-z0-9_-]{1,64}-\d{10,16}\.(png|jpg|webp|gif)$/;
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

for (const dir of [CARDS, IMAGES, TRASH]) fs.mkdirSync(dir, { recursive: true });

const send = (res, status, body, headers = {}) => {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Anfrage zu groß'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

/** Atomar schreiben: erst temporäre Datei, dann umbenennen. */
const writeAtomic = async (file, data) => {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
};

const detectImage = (buf) => {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  if (buf.length > 6 && buf.toString('ascii', 0, 3) === 'GIF') return 'gif';
  return null;
};

const imagesOf = async (id) =>
  (await fsp.readdir(IMAGES)).filter((f) => f.startsWith(`${id}-`) && IMAGE_FILE_RE.test(f));

async function listCards() {
  const files = (await fsp.readdir(CARDS)).filter((f) => f.endsWith('.json'));
  const cards = [];
  for (const f of files) {
    try {
      cards.push(JSON.parse(await fsp.readFile(path.join(CARDS, f), 'utf8')));
    } catch (e) {
      console.error(`[list] ${f} unlesbar:`, e.message);
    }
  }
  cards.sort((a, b) => (a._createdAt || 0) - (b._createdAt || 0));
  return cards;
}

async function saveCard(id, raw) {
  let card;
  try {
    card = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Ungültiges JSON'), { status: 400 });
  }
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    throw Object.assign(new Error('Ungültige Karte'), { status: 400 });
  }
  const file = path.join(CARDS, `${id}.json`);
  let existing = null;
  try {
    existing = JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    existing = null;
  }
  if (!existing && (await fsp.readdir(CARDS)).length >= MAX_CARDS) {
    throw Object.assign(new Error('Zu viele Karten'), { status: 507 });
  }

  const now = Date.now();
  card.id = id;
  card._createdAt = existing?._createdAt || now;
  card._updatedAt = now;

  // Neues Bild (Base64) → Datei; alte Bilder dieser Karte in den Papierkorb
  if (typeof card.imageData === 'string' && card.imageData.length > 0) {
    const b64 = card.imageData.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > MAX_IMAGE) throw Object.assign(new Error('Bild zu groß'), { status: 413 });
    const ext = detectImage(buf);
    if (!ext) throw Object.assign(new Error('Unbekanntes Bildformat'), { status: 415 });
    const name = `${id}-${now}.${ext}`;
    await writeAtomic(path.join(IMAGES, name), buf);
    for (const old of await imagesOf(id)) {
      if (old !== name)
        await fsp.rename(path.join(IMAGES, old), path.join(TRASH, old)).catch(() => {});
    }
    card.storedImageUrl = `/api/images/${name}`;
  }
  card.imageData = null; // Base64 nie in der Kartendatei

  await writeAtomic(file, JSON.stringify(card));
  return { status: 'success', imageUrl: card.storedImageUrl || undefined };
}

const SPELL_PROMPT = `Du bist Lektor für selbst gestaltete deutsche Munchkin-Karten (das humorvolle Fantasy-Kartenspiel).
Die Texte hat ein Kind mit Lese-Rechtschreib-Schwäche geschrieben. Korrigiere Rechtschreibung, Groß- und Kleinschreibung,
Zeichensetzung und eindeutige Grammatikfehler in allen Feldern.

Regeln:
- Inhalt, Witz, Wortwahl und Satzbau des Kindes beibehalten. Nicht umformulieren, nichts ergänzen, nichts kürzen.
  Nur wenn ein Satz sonst unverständlich bleibt, minimal glätten.
- Zeilenumbrüche, Leerzeilen und Leerzeichen am Zeilenanfang EXAKT beibehalten (damit wird der Text um ein Bild geformt).
- Munchkin-Begriffe wie auf den deutschen Karten: Stufe/Stufen, Schatz/Schätze, Goldstücke, Schlimme Dinge, Ross, Mietling,
  Kopfbedeckung, Rüstung, Schuhwerk, 1 Hand, 2 Hände, Verstärker, Fluch, Monster, Klasse, Rasse, Groß, Bonus, Einmalig,
  Tür, Schatz, Davonlaufen, Kampf, Spieler.
- Zahlen und Boni als Ziffern lassen (+3, 2 Stufen, 1.000 Goldstücke).
- Anführungszeichen immer als Guillemets wie auf deutschen Karten: »Text« (Spitzen zeigen nach innen), innen ›Text‹.
  Auch "Text", „Text“ und >>Text<< so umwandeln.
- Gedankenstrich als – mit Leerzeichen davor und danach.
- Erfundene Namen und absichtliche Wortspiele nicht „verbessern“, nur offensichtliche Tippfehler darin.
- Ist ein Feld leer, bleibt es leer.
- Für jede Änderung eine Erklärung in einfacher, freundlicher Sprache für ein Kind (höchstens 12 Wörter),
  z. B. "Nomen schreibt man groß." oder "Nach »dass« kommt ein Komma davor."`;

const SPELL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...SPELL_FIELDS, 'changes'],
  properties: {
    title: { type: 'string' },
    restrictions: { type: 'string' },
    description: { type: 'string' },
    badStuff: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'before', 'after', 'why'],
        properties: {
          field: { type: 'string', enum: SPELL_FIELDS },
          before: { type: 'string' },
          after: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
  },
};

/** Tageszähler gegen versehentliche Dauerschleifen / Kosten (Datei unter DATA_DIR). */
async function countSpellRequest() {
  const today = new Date().toISOString().slice(0, 10);
  let usage = { date: today, count: 0 };
  try {
    const u = JSON.parse(await fsp.readFile(USAGE_FILE, 'utf8'));
    if (u && u.date === today) usage = u;
  } catch {
    /* neu */
  }
  if (usage.count >= SPELL_MAX_PER_DAY) {
    throw Object.assign(new Error('Tageslimit der Rechtschreibprüfung erreicht'), { status: 429 });
  }
  usage.count += 1;
  await writeAtomic(USAGE_FILE, JSON.stringify(usage));
}

async function spellcheck(raw) {
  if (!OPENAI_API_KEY) {
    throw Object.assign(new Error('Rechtschreibprüfung ist nicht eingerichtet'), { status: 503 });
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Ungültiges JSON'), { status: 400 });
  }
  const fields = {};
  for (const f of SPELL_FIELDS) {
    const v = input && typeof input[f] === 'string' ? input[f] : '';
    if (v.length > SPELL_MAX_FIELD) throw Object.assign(new Error('Text zu lang'), { status: 413 });
    fields[f] = v;
  }
  if (SPELL_FIELDS.every((f) => !fields[f].trim())) {
    return { ...fields, changes: [] };
  }
  await countSpellRequest();

  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: SPELL_PROMPT },
      {
        role: 'user',
        content:
          'Kartentyp: ' +
          (typeof input.type === 'string' ? input.type.slice(0, 40) : 'unbekannt') +
          '\nFelder (JSON):\n' +
          JSON.stringify(fields),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'korrektur', strict: true, schema: SPELL_SCHEMA },
    },
    max_completion_tokens: 4000,
  };
  if (OPENAI_REASONING && /^(gpt-5|gpt-6|o)/.test(OPENAI_MODEL)) {
    body.reasoning_effort = OPENAI_REASONING;
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) {
    console.error('[spellcheck] OpenAI', r.status, (await r.text()).slice(0, 300));
    throw Object.assign(new Error(`KI-Dienst antwortet nicht (HTTP ${r.status})`), {
      status: 502,
    });
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw Object.assign(new Error('KI-Antwort unlesbar'), { status: 502 });
  }
  // Nur bekannte Felder zurückgeben; leere Eingabefelder bleiben leer
  const out = { changes: Array.isArray(result.changes) ? result.changes.slice(0, 60) : [] };
  for (const f of SPELL_FIELDS) {
    out[f] = fields[f].trim() && typeof result[f] === 'string' ? result[f] : fields[f];
  }
  return out;
}

async function deleteCard(id) {
  const file = path.join(CARDS, `${id}.json`);
  const stamp = Date.now();
  await fsp.rename(file, path.join(TRASH, `${id}-${stamp}.json`)).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  for (const img of await imagesOf(id)) {
    await fsp.rename(path.join(IMAGES, img), path.join(TRASH, img)).catch(() => {});
  }
  return { status: 'success' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api', ...]
  try {
    if (parts[0] !== 'api') return send(res, 404, { status: 'error', message: 'Not found' });

    if (parts[1] === 'health' && req.method === 'GET')
      return send(res, 200, { status: 'ok', spellcheck: !!OPENAI_API_KEY });

    if (parts[1] === 'spellcheck' && parts.length === 2 && req.method === 'POST') {
      return send(res, 200, await spellcheck(await readBody(req)));
    }

    if (parts[1] === 'cards' && parts.length === 2 && req.method === 'GET') {
      return send(res, 200, await listCards());
    }

    if (parts[1] === 'cards' && parts.length === 3) {
      const id = parts[2];
      if (!ID_RE.test(id)) return send(res, 400, { status: 'error', message: 'Ungültige ID' });
      if (req.method === 'PUT') return send(res, 200, await saveCard(id, await readBody(req)));
      if (req.method === 'DELETE') return send(res, 200, await deleteCard(id));
    }

    if (parts[1] === 'images' && parts.length === 3 && req.method === 'GET') {
      const name = parts[2];
      if (!IMAGE_FILE_RE.test(name))
        return send(res, 400, { status: 'error', message: 'Ungültig' });
      const ext = name.split('.').pop();
      try {
        const buf = await fsp.readFile(path.join(IMAGES, name));
        // Dateiname ändert sich bei jedem neuen Bild → darf lange gecacht werden
        return send(res, 200, buf, {
          'Content-Type': MIME[ext],
          'Cache-Control': 'private, max-age=31536000, immutable',
        });
      } catch {
        return send(res, 404, { status: 'error', message: 'Bild nicht gefunden' });
      }
    }

    return send(res, 405, { status: 'error', message: 'Nicht erlaubt' });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[api]', req.method, req.url, e);
    return send(res, status, { status: 'error', message: e.message || 'Fehler' });
  }
});

server.listen(PORT, () => console.log(`munchkin-api läuft auf Port ${PORT}, Daten in ${DATA_DIR}`));
