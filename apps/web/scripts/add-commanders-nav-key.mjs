// One-shot: add nav.commanders (the sidebar entry of the Commanders page) and nav.alphaBadge (its "new feature in
// alpha test" badge) to every locale.
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

const BADGE = {
  en: 'New feature alpha test',
  it: 'Nuova funzione in alpha test',
  es: 'Nueva función en prueba alfa',
  fr: 'Nouveauté en test alpha',
  de: 'Neue Funktion im Alphatest',
  pt: 'Novo recurso em teste alfa',
  ru: 'Новая функция: альфа-тест',
  tr: 'Yeni özellik: alfa testi',
  ar: 'ميزة جديدة: اختبار ألفا',
  hi: 'नई सुविधा: अल्फा परीक्षण',
  ja: '新機能・アルファテスト',
  ko: '새 기능 알파 테스트',
  th: 'ฟีเจอร์ใหม่ ทดสอบอัลฟา',
  vi: 'Tính năng mới thử nghiệm alpha',
  zh: '新功能 Alpha 测试',
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
  doc.nav.alphaBadge = BADGE[locale] ?? BADGE.en;
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`[${locale}] ${doc.nav.commanders} · ${doc.nav.alphaBadge}`);
}
