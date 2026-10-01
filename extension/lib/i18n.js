export const SUPPORTED_LANGUAGES = { ru: 'RU', en: 'EN', zh: '中文' };
export const LOCALE_BY_LANGUAGE = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN' };

const FALLBACK_LANGUAGE = 'en';
const LANGUAGE_STORAGE_KEY = 'language';

export const TRANSLATIONS = {
  ru: {
    popupHeading: 'Напоминания',
    languageSwitcherLabel: 'Язык',
    quickAddLabel: 'Быстрый ввод',
    quickAddPlaceholder: 'завтра в 15:00 созвон с командой',
    meetingTitleLabel: 'Название',
    defaultMeetingTitle: 'Встреча',
    meetingDateTimeLabel: 'Когда',
    addReminderButton: 'Добавить',
    formFootnote: 'Самолётик прилетит за 10 минут и в момент начала.',
    upcomingRemindersHeading: 'Ближайшие',
    emptyReminderListHint: 'Пока пусто. Выделите дату на любой странице → правый клик → «Напомнить о встрече».',
    previewButton: '✈ Посмотреть, как выглядит напоминание',
    deleteReminderButton: 'Удалить',
    meetingAlreadyPassed: 'прошло',
    dateNotRecognized: 'Дата не распознана',
    timeNotFound: 'Время не найдено — поставили 09:00, проверьте.',
    selectedTimeAlreadyPassed: 'Это время уже прошло.',
    reminderAdded: 'Напоминание добавлено',
    reminderAddedWithinLeadTime: 'Добавлено, но до встречи меньше 10 минут',
    previewUnavailableOnThisTab: 'Здесь показать нельзя — откройте обычный сайт',
    selectedTextHasNoDate: 'Не удалось распознать дату в «{selectedText}» — укажите вручную.',
    previewMeetingTitle: 'Пример встречи',
    contextMenuTitle: '✈ Напомнить о встрече: «%s»',
    bannerLabelBeforeStart: 'Через {minutes} мин',
    bannerLabelAtStart: 'Начинается',
    notificationTextBeforeStart: 'Через {minutes} минут · в {time}',
    notificationTextAtStart: 'Начинается сейчас · {time}',
  },
  en: {
    popupHeading: 'Reminders',
    languageSwitcherLabel: 'Language',
    quickAddLabel: 'Quick add',
    quickAddPlaceholder: 'tomorrow at 3pm team call',
    meetingTitleLabel: 'Title',
    defaultMeetingTitle: 'Meeting',
    meetingDateTimeLabel: 'When',
    addReminderButton: 'Add',
    formFootnote: 'The plane flies by 10 minutes before and when it starts.',
    upcomingRemindersHeading: 'Upcoming',
    emptyReminderListHint: 'Nothing yet. Select a date on any page → right-click → “Remind me about a meeting”.',
    previewButton: '✈ Preview a reminder',
    deleteReminderButton: 'Delete',
    meetingAlreadyPassed: 'passed',
    dateNotRecognized: 'Couldn’t recognize a date',
    timeNotFound: 'No time found — set to 09:00, please check.',
    selectedTimeAlreadyPassed: 'This time has already passed.',
    reminderAdded: 'Reminder added',
    reminderAddedWithinLeadTime: 'Added, but the meeting is less than 10 minutes away',
    previewUnavailableOnThisTab: 'Can’t show it here — open a regular website',
    selectedTextHasNoDate: 'Couldn’t find a date in “{selectedText}” — please set it manually.',
    previewMeetingTitle: 'Sample meeting',
    contextMenuTitle: '✈ Remind me about a meeting: “%s”',
    bannerLabelBeforeStart: 'In {minutes} min',
    bannerLabelAtStart: 'Starting',
    notificationTextBeforeStart: 'In {minutes} minutes · at {time}',
    notificationTextAtStart: 'Starting now · {time}',
  },
  zh: {
    popupHeading: '提醒',
    languageSwitcherLabel: '语言',
    quickAddLabel: '快速添加',
    quickAddPlaceholder: '明天 15:00 团队会议',
    meetingTitleLabel: '标题',
    defaultMeetingTitle: '会议',
    meetingDateTimeLabel: '时间',
    addReminderButton: '添加',
    formFootnote: '纸飞机会在会议开始前 10 分钟和开始时飞过屏幕。',
    upcomingRemindersHeading: '即将开始',
    emptyReminderListHint: '暂无提醒。在任意页面选中日期 → 右键 → “提醒我开会”。',
    previewButton: '✈ 预览提醒效果',
    deleteReminderButton: '删除',
    meetingAlreadyPassed: '已过',
    dateNotRecognized: '无法识别日期',
    timeNotFound: '未找到时间，已设为 09:00，请确认。',
    selectedTimeAlreadyPassed: '该时间已经过去。',
    reminderAdded: '已添加提醒',
    reminderAddedWithinLeadTime: '已添加，但距离会议不足 10 分钟',
    previewUnavailableOnThisTab: '此页面无法显示，请打开普通网站',
    selectedTextHasNoDate: '无法从“{selectedText}”中识别日期，请手动设置。',
    previewMeetingTitle: '示例会议',
    contextMenuTitle: '✈ 提醒我开会：“%s”',
    bannerLabelBeforeStart: '{minutes} 分钟后',
    bannerLabelAtStart: '即将开始',
    notificationTextBeforeStart: '{minutes} 分钟后 · {time}',
    notificationTextAtStart: '现在开始 · {time}',
  },
};

export function detectLanguageFromBrowser(browserLanguageTag) {
  const normalizedLanguageTag = String(browserLanguageTag || '').toLowerCase();
  if (normalizedLanguageTag.startsWith('ru')) return 'ru';
  if (normalizedLanguageTag.startsWith('zh')) return 'zh';
  return FALLBACK_LANGUAGE;
}

export async function getCurrentLanguage() {
  const { [LANGUAGE_STORAGE_KEY]: savedLanguage } = await chrome.storage.sync.get(LANGUAGE_STORAGE_KEY);
  return SUPPORTED_LANGUAGES[savedLanguage] ? savedLanguage : detectLanguageFromBrowser(chrome.i18n.getUILanguage());
}

export async function saveLanguage(language) {
  if (SUPPORTED_LANGUAGES[language]) await chrome.storage.sync.set({ [LANGUAGE_STORAGE_KEY]: language });
}

export function isLanguageChange(storageChanges, storageAreaName) {
  return storageAreaName === 'sync' && LANGUAGE_STORAGE_KEY in storageChanges;
}

export function createTranslator(language) {
  const translationsForLanguage = TRANSLATIONS[language] || TRANSLATIONS[FALLBACK_LANGUAGE];
  return (translationKey, placeholderValues = {}) => {
    const template = translationsForLanguage[translationKey] ?? TRANSLATIONS[FALLBACK_LANGUAGE][translationKey] ?? translationKey;
    return template.replace(/\{(\w+)\}/g, (_, placeholderName) => placeholderValues[placeholderName] ?? '');
  };
}
