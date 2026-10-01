import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateTime } from '../extension/lib/date-parser.js';

const THURSDAY_OCTOBER_1_2026_NOON = new Date(2026, 9, 1, 12, 0);

const padToTwoDigits = (number) => String(number).padStart(2, '0');
const formatAsYearMonthDayHourMinute = (date) =>
  `${date.getFullYear()}-${padToTwoDigits(date.getMonth() + 1)}-${padToTwoDigits(date.getDate())} ` +
  `${padToTwoDigits(date.getHours())}:${padToTwoDigits(date.getMinutes())}`;

const PARSING_CASES = [
  { input: '15.10.2026 14:30', expectedDate: '2026-10-15 14:30', expectedRemainingText: '' },
  { input: 'Созвон 15.10 в 9:05', expectedDate: '2026-10-15 09:05', expectedRemainingText: 'Созвон' },
  { input: '15 октября в 18:00 демо', expectedDate: '2026-10-15 18:00', expectedRemainingText: 'демо' },
  { input: '3 марта 2027 г. в 10:00', expectedDate: '2027-03-03 10:00', expectedRemainingText: '' },
  { input: 'завтра в 10:00', expectedDate: '2026-10-02 10:00', expectedRemainingText: '' },
  { input: 'послезавтра в 9.30 планёрка', expectedDate: '2026-10-03 09:30', expectedRemainingText: 'планёрка' },
  { input: 'в пятницу в 16 часов', expectedDate: '2026-10-02 16:00', expectedRemainingText: '' },
  { input: 'в среду 11:00', expectedDate: '2026-10-07 11:00', expectedRemainingText: '' },
  { input: '2026-11-05T08:15', expectedDate: '2026-11-05 08:15', expectedRemainingText: '' },
  { input: 'Meeting Oct 20, 3:30 pm', expectedDate: '2026-10-20 15:30', expectedRemainingText: 'Meeting' },
  { input: 'tomorrow at 9am', expectedDate: '2026-10-02 09:00', expectedRemainingText: '' },
  { input: '10:30', expectedDate: '2026-10-02 10:30', expectedRemainingText: '' },
  { input: '18:45', expectedDate: '2026-10-01 18:45', expectedRemainingText: '' },
  { input: '5 января', expectedDate: '2027-01-05 09:00', expectedRemainingText: '' },
  { input: '15/10/26 7:00', expectedDate: '2026-10-15 07:00', expectedRemainingText: '' },
  { input: '明天 15:00 团队会议', expectedDate: '2026-10-02 15:00', expectedRemainingText: '团队会议' },
  { input: '10月15日 下午3点半 评审', expectedDate: '2026-10-15 15:30', expectedRemainingText: '评审' },
  { input: '2026年11月5日 9：00', expectedDate: '2026-11-05 09:00', expectedRemainingText: '' },
  { input: '周五 14:30', expectedDate: '2026-10-02 14:30', expectedRemainingText: '' },
  { input: '下周一 10点', expectedDate: '2026-10-05 10:00', expectedRemainingText: '' },
  { input: '晚上8点', expectedDate: '2026-10-01 20:00', expectedRemainingText: '' },
  { input: '后天上午9点20分，周会', expectedDate: '2026-10-03 09:20', expectedRemainingText: '周会' },
];

for (const { input, expectedDate, expectedRemainingText } of PARSING_CASES) {
  test(input, () => {
    const parseResult = parseDateTime(input, THURSDAY_OCTOBER_1_2026_NOON);
    assert.ok(parseResult, 'date was not recognized');
    assert.equal(formatAsYearMonthDayHourMinute(parseResult.date), expectedDate);
    assert.equal(parseResult.remainingText, expectedRemainingText);
  });
}

test('text without a date returns null', () => {
  assert.equal(parseDateTime('просто текст', THURSDAY_OCTOBER_1_2026_NOON), null);
  assert.equal(parseDateTime('версия 1.2.3', THURSDAY_OCTOBER_1_2026_NOON)?.hasTime ?? false, false);
});

test('nonexistent date returns null', () => {
  assert.equal(parseDateTime('31.02.2027', THURSDAY_OCTOBER_1_2026_NOON), null);
});

test('date without time sets hasTime to false', () => {
  const parseResult = parseDateTime('20 октября', THURSDAY_OCTOBER_1_2026_NOON);
  assert.equal(parseResult.hasDate, true);
  assert.equal(parseResult.hasTime, false);
});
