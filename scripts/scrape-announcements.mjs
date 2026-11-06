// Zbiera ogłoszenia z sekcji „Aktualności” w Strefie Studenta i zapisuje je w data/announcements.json.
// Uruchamia go co kilka godzin GitHub Actions (.github/workflows/announcements.yml), a aplikacja tylko czyta ten plik:
// telefon nie mógłby pobierać stron uczelni sam, bo blokuje to przeglądarka (CORS).
//
// Czytamy wyłącznie pierwszą stronę listy. robots.txt uczelni zabrania adresów z `tx_news_pi1`, czyli paginacji.
// Bez zależności: akcja uruchamia sam plik, bez `npm install`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SOURCES = [
  { faculty: "filolog", url: "https://www.filolog.uni.lodz.pl/strefa-studenta/aktualnosci" },
  { faculty: "eksoc", url: "https://www.eksoc.uni.lodz.pl/strefa-studenta/aktualnosci" },
];

const OUT_FILE = fileURLToPath(new URL("../data/announcements.json", import.meta.url));
const USER_AGENT = "IndeksApp (+https://github.com/BoboToZiomal/indeks)";
const MAX_ITEMS = 120;
const MAX_EXCERPT = 240;

const MONTHS = {
  stycznia: 1,
  lutego: 2,
  marca: 3,
  kwietnia: 4,
  maja: 5,
  czerwca: 6,
  lipca: 7,
  sierpnia: 8,
  września: 9,
  października: 10,
  listopada: 11,
  grudnia: 12,
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", bdquo: "„", rdquo: "”" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
  });
}

const cleanText = (html) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** „05 listopada 2026” → „2026-11-05”. */
export function parsePolishDate(text) {
  const m = /(\d{1,2})\s+(\p{L}+)\s+(\d{4})/u.exec(text);
  const month = m && MONTHS[m[2].toLowerCase()];
  return month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Wyciąga ogłoszenia z HTML listy. Pozycje bez tytułu, adresu albo daty pomija. */
export function parseNewsList(html, pageUrl) {
  const items = [];
  // Karuzele z wiadomościami z całego portalu mają klasę „slider-news-item” i tu nie pasują: bierzemy tylko główną listę.
  for (const [block] of html.matchAll(/class="news-item [\s\S]*?(?=class="news-item |<\/section|$)/g)) {
    const link = /item-title-[^"]*"[^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/.exec(block);
    const href = link && /href="([^"]+)"/.exec(link[1])?.[1];
    const date = parsePolishDate(/date-categories[^>]*>\s*<span>\s*([^<]*?)\s*<\/span>/.exec(block)?.[1] ?? "");
    if (!href || !date) continue;

    const url = new URL(decodeEntities(href), pageUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".uni.lodz.pl")) continue;
    const title = cleanText(link[2]);
    if (!title) continue;

    const excerpt = cleanText(/text-block-16[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "");
    const category = cleanText(/Kategoria:\s*<\/span>\s*<strong>([\s\S]*?)<\/strong>/.exec(block)?.[1] ?? "");
    items.push({
      // Ten sam tekst z całej uczelni jest na stronach obu wydziałów, pod tą samą końcówką adresu.
      id: url.pathname.split("/").filter(Boolean).pop(),
      title,
      ...(excerpt && { excerpt: excerpt.slice(0, MAX_EXCERPT) }),
      date,
      ...(category && { category }),
      url: url.href,
    });
  }
  return items;
}

/** Łączy nowe dane z poprzednim plikiem. `firstSeen` zostaje z pierwszego razu, a starsze wpisy żyją do limitu. */
export function mergeItems(previous, scraped, now, limit = MAX_ITEMS) {
  const byId = new Map(previous.map((item) => [item.id, item]));
  for (const { faculty, items } of scraped) {
    for (const item of items) {
      const known = byId.get(item.id);
      byId.set(item.id, {
        ...item,
        // Adres zostaje stały, inaczej plik zmieniałby się przy każdym uruchomieniu.
        url: known?.url ?? item.url,
        faculties: [...new Set([...(known?.faculties ?? []), faculty])].sort(),
        firstSeen: known?.firstSeen ?? now,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, limit);
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function readPrevious(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8")).items ?? [];
  } catch {
    return [];
  }
}

async function main(file = OUT_FILE) {
  const scraped = [];
  let problems = 0;
  for (const source of SOURCES) {
    if (scraped.length) await new Promise((r) => setTimeout(r, 1500));
    try {
      const items = parseNewsList(await fetchPage(source.url), source.url);
      console.log(`${source.faculty}: ${items.length} ogłoszeń`);
      // Pusta lista to prawie na pewno zmiana układu strony, a nie brak ogłoszeń: akcja ma się wtedy nie udać.
      if (!items.length) {
        console.error(`${source.faculty}: nie znaleziono żadnego ogłoszenia, strona mogła zmienić układ.`);
        problems++;
        continue;
      }
      scraped.push({ faculty: source.faculty, items });
    } catch (e) {
      console.error(`${source.faculty}: nie udało się pobrać strony (${e.message}).`);
      problems++;
    }
  }

  const previous = readPrevious(file);
  const items = mergeItems(previous, scraped, new Date().toISOString());
  if (scraped.length && JSON.stringify(items) !== JSON.stringify(previous)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2)}\n`);
    console.log(`Zapisano ${items.length} ogłoszeń.`);
  } else {
    console.log("Bez zmian.");
  }
  if (problems) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
