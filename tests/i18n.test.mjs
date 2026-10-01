import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageFromBrowser, createTranslator, TRANSLATIONS } from '../extension/lib/i18n.js';

test('language follows the browser and falls back to English', () => {
  assert.equal(detectLanguageFromBrowser('ru'), 'ru');
  assert.equal(detectLanguageFromBrowser('ru-RU'), 'ru');
  assert.equal(detectLanguageFromBrowser('zh-CN'), 'zh');
  assert.equal(detectLanguageFromBrowser('zh-TW'), 'zh');
  assert.equal(detectLanguageFromBrowser('en-GB'), 'en');
  assert.equal(detectLanguageFromBrowser('de'), 'en');
  assert.equal(detectLanguageFromBrowser('uk'), 'en');
  assert.equal(detectLanguageFromBrowser(undefined), 'en');
});

test('every language has the same translation keys', () => {
  const englishKeys = Object.keys(TRANSLATIONS.en).sort();
  for (const language of ['ru', 'zh']) {
    assert.deepEqual(Object.keys(TRANSLATIONS[language]).sort(), englishKeys, language);
  }
});

test('placeholders are filled in', () => {
  assert.equal(
    createTranslator('en')('notificationTextBeforeStart', { minutes: 10, time: '3:30 PM' }),
    'In 10 minutes · at 3:30 PM',
  );
  assert.equal(createTranslator('zh')('bannerLabelBeforeStart', { minutes: 10 }), '10 分钟后');
  assert.equal(createTranslator('unknown')('addReminderButton'), 'Add');
});
