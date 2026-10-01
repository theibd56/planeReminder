const MONTH_PREFIXES = [
  ['январ', 'jan'], ['феврал', 'feb'], ['март', 'mar'], ['апрел', 'apr'],
  ['ма', 'may'], ['июн', 'jun'], ['июл', 'jul'], ['август', 'aug'],
  ['сентябр', 'sep'], ['октябр', 'oct'], ['ноябр', 'nov'], ['декабр', 'dec'],
];

const WEEKDAY_PREFIXES_FROM_SUNDAY = [
  ['воскресень', 'sun'], ['понедельник', 'mon'], ['вторник', 'tue'], ['сред', 'wed'],
  ['четверг', 'thu'], ['пятниц', 'fri'], ['суббот', 'sat'],
];

const CHINESE_WEEKDAYS_FROM_SUNDAY = '日一二三四五六';

const MONTH_NAME_PATTERN =
  '(январ[а-я]*|феврал[а-я]*|март[а-я]*|апрел[а-я]*|ма[йяе]|июн[а-я]*|июл[а-я]*|август[а-я]*|' +
  'сентябр[а-я]*|октябр[а-я]*|ноябр[а-я]*|декабр[а-я]*|' +
  'jan[a-z]*|feb[a-z]*|mar[a-z]*|apr[a-z]*|may|jun[a-z]*|jul[a-z]*|aug[a-z]*|sep[a-z]*|oct[a-z]*|nov[a-z]*|dec[a-z]*)\\.?';

const NOT_PRECEDED_BY_LETTER_OR_DIGIT = '(?<![a-zа-я0-9])';

const ISO_DATE_PATTERN = /(\d{4})-(\d{1,2})-(\d{1,2})(?:t|(?=\s))/;
const NUMERIC_DAY_MONTH_YEAR_PATTERN =
  /(?<![\d:.])(?<!(?:в|во|at) )(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])(?:[./](\d{4}|\d{2}))?(?![\d:])/;
const DAY_THEN_MONTH_NAME_PATTERN = new RegExp(
  `(?<!\\d)(\\d{1,2})(?:-?го)?\\s+${MONTH_NAME_PATTERN}(?:\\s+(\\d{4}))?(?:\\s*г(?:ода|\\.)?)?`,
);
const MONTH_NAME_THEN_DAY_PATTERN = new RegExp(
  `${MONTH_NAME_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?!\\d|:)`,
);
const CHINESE_DATE_PATTERN = /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]?/;

const DAY_AFTER_TOMORROW_PATTERN = /послезавтра|day after tomorrow|后天|後天/;
const TOMORROW_PATTERN = /завтра|tomorrow|明天|明日/;
const TODAY_PATTERN = /сегодня|today|tonight|今天|今日|今晚/;
const WEEKDAY_NAME_PATTERN =
  /(?:(?:в|во|on|next)\s+)?(понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?![a-zа-я])/;
const CHINESE_WEEKDAY_PATTERN = /(下\s*)?(?:星期|周|週|礼拜|禮拜)([一二三四五六日天])/;

const CHINESE_DAY_PERIOD_PATTERN = /上午|早上|凌晨|中午|下午|傍晚|晚上|夜里/;
const CHINESE_AFTERNOON_OR_EVENING_PATTERN = /下午|傍晚|晚上|夜里/;

const CHINESE_TIME_PATTERN = /(?<!\d)(\d{1,2})\s*[点點时時](?:\s*(半)|\s*(\d{1,2})\s*分?)?/;
const COLON_TIME_PATTERN = new RegExp(
  `(?:${NOT_PRECEDED_BY_LETTER_OR_DIGIT}(?:в|во|at|с)\\s+)?(?<![\\d.])(\\d{1,2})[:：](\\d{2})(?:\\s*([ap])\\.?m\\.?)?(?!\\d)`,
);
const DOT_TIME_AFTER_PREPOSITION_PATTERN = new RegExp(
  `${NOT_PRECEDED_BY_LETTER_OR_DIGIT}(?:в|во|at)\\s+(\\d{1,2})\\.(\\d{2})(?:\\s*([ap])\\.?m\\.?)?(?!\\d)`,
);
const HOUR_WITH_AM_PM_PATTERN = new RegExp(
  `(?:${NOT_PRECEDED_BY_LETTER_OR_DIGIT}(?:в|во|at)\\s+)?(?<![\\d:.])(\\d{1,2})()\\s*([ap])\\.?m\\.?(?![a-z])`,
);
const RUSSIAN_HOUR_WORD_PATTERN = new RegExp(
  `${NOT_PRECEDED_BY_LETTER_OR_DIGIT}(?:в|во)\\s+(\\d{1,2})()\\s*(?:час(?:а|ов)?|ч\\.?)(?![а-я])`,
);

const EDGE_PUNCTUATION_PATTERN = /^[\s,.:;—\-，。、：；]+|[\s,.:;—\-，。、：；]+$/g;

const DEFAULT_HOUR_WHEN_TIME_MISSING = 9;
const MILLISECONDS_PER_DAY = 864e5;

function getMonthIndexFromName(monthName) {
  const lowercaseMonthName = monthName.toLowerCase();
  if (/^ма[йяе]$/.test(lowercaseMonthName) || lowercaseMonthName === 'may') return 4;
  return MONTH_PREFIXES.findIndex(
    ([russianPrefix, englishPrefix]) =>
      lowercaseMonthName.startsWith(russianPrefix) || lowercaseMonthName.startsWith(englishPrefix),
  );
}

function expandTwoDigitYear(yearText) {
  if (yearText == null) return null;
  const yearNumber = Number(yearText);
  return yearNumber < 100 ? 2000 + yearNumber : yearNumber;
}

function getDaysUntilWeekdayOfNextWeek(currentWeekdayIndex, targetWeekdayIndex) {
  const daysSinceMonday = (currentWeekdayIndex + 6) % 7;
  const targetDaysSinceMonday = (targetWeekdayIndex + 6) % 7;
  return 7 - daysSinceMonday + targetDaysSinceMonday;
}

export function parseDateTime(text, currentDate = new Date()) {
  if (!text) return null;

  let searchableText = ' ' + text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ') + ' ';
  const originalText = ' ' + text.replace(/\s+/g, ' ') + ' ';
  const matchedRanges = [];

  const consumePattern = (pattern) => {
    const match = pattern.exec(searchableText);
    if (!match) return null;
    const matchEnd = match.index + match[0].length;
    matchedRanges.push([match.index, matchEnd]);
    searchableText = searchableText.slice(0, match.index) + ' '.repeat(match[0].length) + searchableText.slice(matchEnd);
    return match;
  };

  let year = null;
  let monthIndex = null;
  let dayOfMonth = null;
  let relativeDayOffset = null;
  let weekdayIndex = null;
  let isNextCalendarWeek = false;
  let match;

  if ((match = consumePattern(ISO_DATE_PATTERN))) {
    year = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
    dayOfMonth = Number(match[3]);
  } else if ((match = consumePattern(NUMERIC_DAY_MONTH_YEAR_PATTERN))) {
    dayOfMonth = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
    year = expandTwoDigitYear(match[3]);
  } else if ((match = consumePattern(DAY_THEN_MONTH_NAME_PATTERN))) {
    dayOfMonth = Number(match[1]);
    monthIndex = getMonthIndexFromName(match[2]);
    year = expandTwoDigitYear(match[3]);
  } else if ((match = consumePattern(MONTH_NAME_THEN_DAY_PATTERN))) {
    monthIndex = getMonthIndexFromName(match[1]);
    dayOfMonth = Number(match[2]);
    year = expandTwoDigitYear(match[3]);
  } else if ((match = consumePattern(CHINESE_DATE_PATTERN))) {
    year = expandTwoDigitYear(match[1]);
    monthIndex = Number(match[2]) - 1;
    dayOfMonth = Number(match[3]);
  }

  if (dayOfMonth == null) {
    if (consumePattern(DAY_AFTER_TOMORROW_PATTERN)) {
      relativeDayOffset = 2;
    } else if (consumePattern(TOMORROW_PATTERN)) {
      relativeDayOffset = 1;
    } else if (consumePattern(TODAY_PATTERN)) {
      relativeDayOffset = 0;
    } else if ((match = consumePattern(WEEKDAY_NAME_PATTERN))) {
      const weekdayName = match[1];
      weekdayIndex = WEEKDAY_PREFIXES_FROM_SUNDAY.findIndex(
        ([russianPrefix, englishPrefix]) => weekdayName.startsWith(russianPrefix) || weekdayName.startsWith(englishPrefix),
      );
    } else if ((match = consumePattern(CHINESE_WEEKDAY_PATTERN))) {
      const chineseWeekdayCharacter = match[2] === '天' ? '日' : match[2];
      weekdayIndex = CHINESE_WEEKDAYS_FROM_SUNDAY.indexOf(chineseWeekdayCharacter);
      isNextCalendarWeek = Boolean(match[1]);
    }
  }

  const chineseDayPeriod = consumePattern(CHINESE_DAY_PERIOD_PATTERN)?.[0];

  let hours = null;
  let minutes = 0;

  if ((match = consumePattern(CHINESE_TIME_PATTERN))) {
    const [, hourText, halfHourMarker, minuteText] = match;
    hours = Number(hourText);
    minutes = halfHourMarker ? 30 : minuteText ? Number(minuteText) : 0;
  } else if (
    (match = consumePattern(COLON_TIME_PATTERN))
    || (match = consumePattern(DOT_TIME_AFTER_PREPOSITION_PATTERN))
    || (match = consumePattern(HOUR_WITH_AM_PM_PATTERN))
    || (match = consumePattern(RUSSIAN_HOUR_WORD_PATTERN))
  ) {
    const [, hourText, minuteText, amPmLetter] = match;
    hours = Number(hourText);
    minutes = minuteText ? Number(minuteText) : 0;
    if (amPmLetter === 'p' && hours < 12) hours += 12;
    if (amPmLetter === 'a' && hours === 12) hours = 0;
  }

  if (hours != null && (hours > 23 || minutes > 59)) hours = null;

  if (hours != null && chineseDayPeriod) {
    if (CHINESE_AFTERNOON_OR_EVENING_PATTERN.test(chineseDayPeriod) && hours < 12) hours += 12;
    else if (chineseDayPeriod === '中午' && hours < 11) hours += 12;
    else if (chineseDayPeriod === '凌晨' && hours === 12) hours = 0;
  }

  const hasDate = dayOfMonth != null || relativeDayOffset != null || weekdayIndex != null;
  const hasTime = hours != null;
  if (!hasDate && !hasTime) return null;
  if (dayOfMonth != null && (monthIndex < 0 || monthIndex > 11 || dayOfMonth < 1 || dayOfMonth > 31)) return null;

  const parsedDate = new Date(currentDate);
  parsedDate.setSeconds(0, 0);
  parsedDate.setHours(hasTime ? hours : DEFAULT_HOUR_WHEN_TIME_MISSING, hasTime ? minutes : 0);

  if (dayOfMonth != null) {
    parsedDate.setFullYear(year ?? currentDate.getFullYear(), monthIndex, dayOfMonth);
    if (parsedDate.getMonth() !== monthIndex) return null;
    const isPastDateWithoutExplicitYear =
      year == null && parsedDate.getTime() < currentDate.getTime() - MILLISECONDS_PER_DAY;
    if (isPastDateWithoutExplicitYear) parsedDate.setFullYear(parsedDate.getFullYear() + 1);
  } else if (relativeDayOffset != null) {
    parsedDate.setDate(parsedDate.getDate() + relativeDayOffset);
  } else if (weekdayIndex != null) {
    let daysUntilWeekday = (weekdayIndex - currentDate.getDay() + 7) % 7;
    if (daysUntilWeekday === 0 && parsedDate <= currentDate) daysUntilWeekday = 7;
    if (isNextCalendarWeek) daysUntilWeekday = getDaysUntilWeekdayOfNextWeek(currentDate.getDay(), weekdayIndex);
    parsedDate.setDate(parsedDate.getDate() + daysUntilWeekday);
  } else if (parsedDate <= currentDate) {
    parsedDate.setDate(parsedDate.getDate() + 1);
  }

  const remainingCharacters = originalText.split('');
  for (const [rangeStart, rangeEnd] of matchedRanges) {
    for (let characterIndex = rangeStart; characterIndex < rangeEnd; characterIndex++) {
      remainingCharacters[characterIndex] = ' ';
    }
  }
  const remainingText = remainingCharacters.join('').replace(/\s+/g, ' ').replace(EDGE_PUNCTUATION_PATTERN, '').trim();

  return { date: parsedDate, hasDate, hasTime, remainingText };
}
