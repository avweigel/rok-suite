// One-shot: add nav.commanders (the sidebar entry of the Commanders page) to every locale.
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, '..', 'messages');

const TRANSLATIONS = {
  en: 'Commanders',
  it: 'Comandanti',
  es: 'Comandantes',
  fr: 'Commandants',
  de: 'Kommandanten',
  pt: 'Comandantes',
  ru: 'Командиры',
  tr: 'Komutanlar',
  ar: 'القادة',
  hi: 'कमांडर',
  ja: '指揮官',
  ko: '지휘관',
  th: 'ผู้บัญชาการ',
  vi: 'Chỉ huy',
  zh: '统帅',
};

for (const file of readdirSync(messagesDir)) {
  if (!file.endsWith('.json')) continue;
  const locale = file.replace(/\.json$/, '');
  const path = join(messagesDir, file);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  if (!doc?.nav) {
    console.warn(`[${locale}] no nav block — skipped`);
    continue;
  }
  doc.nav.commanders = TRANSLATIONS[locale] ?? TRANSLATIONS.en;
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`[${locale}] ${doc.nav.commanders}`);
}
