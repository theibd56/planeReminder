import { parseDateTime } from '../lib/date-parser.js';
import {
  REMINDER_LEAD_TIME_MINUTES, addReminder, getReminders, removeReminder,
} from '../lib/reminders.js';
import {
  SUPPORTED_LANGUAGES, LOCALE_BY_LANGUAGE, getCurrentLanguage, saveLanguage, createTranslator,
} from '../lib/i18n.js';

const MILLISECONDS_PER_MINUTE = 60e3;
const TOAST_VISIBLE_MILLISECONDS = 2200;
const CONTEXT_MENU_WINDOW_CLOSE_DELAY_MILLISECONDS = 900;

const languageSwitcher = document.getElementById('language-switcher');
const reminderForm = document.getElementById('reminder-form');
const quickAddInput = document.getElementById('quick-add-input');
const quickAddHint = document.getElementById('quick-add-hint');
const meetingTitleInput = document.getElementById('meeting-title-input');
const meetingDateTimeInput = document.getElementById('meeting-datetime-input');
const meetingDateTimeHint = document.getElementById('meeting-datetime-hint');
const reminderList = document.getElementById('reminder-list');
const emptyListHint = document.getElementById('empty-list-hint');
const previewButton = document.getElementById('preview-button');
const toastElement = document.getElementById('toast');

const pageParameters = new URLSearchParams(location.search);
const isOpenedFromContextMenu = pageParameters.get('openedFrom') === 'context-menu';

let currentLanguage = await getCurrentLanguage();
let translate = createTranslator(currentLanguage);
let toastHideTimerId = null;

const padToTwoDigits = (number) => String(number).padStart(2, '0');

function formatForDateTimeInput(date) {
  const datePart = `${date.getFullYear()}-${padToTwoDigits(date.getMonth() + 1)}-${padToTwoDigits(date.getDate())}`;
  const timePart = `${padToTwoDigits(date.getHours())}:${padToTwoDigits(date.getMinutes())}`;
  return `${datePart}T${timePart}`;
}

function formatMeetingDate(date) {
  return date.toLocaleString(LOCALE_BY_LANGUAGE[currentLanguage], {
    weekday: 'short', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  });
}

function formatTimeUntilMeeting(meetingStartsAt) {
  if (meetingStartsAt <= Date.now()) return translate('meetingAlreadyPassed');
  const minutesUntilMeeting = Math.round((meetingStartsAt - Date.now()) / MILLISECONDS_PER_MINUTE);

  const relativeTimeFormatter = new Intl.RelativeTimeFormat(LOCALE_BY_LANGUAGE[currentLanguage], {
    style: 'short', numeric: 'always',
  });
  if (minutesUntilMeeting < 60) return relativeTimeFormatter.format(minutesUntilMeeting, 'minute');
  const hoursUntilMeeting = Math.round(minutesUntilMeeting / 60);
  if (hoursUntilMeeting < 24) return relativeTimeFormatter.format(hoursUntilMeeting, 'hour');
  return relativeTimeFormatter.format(Math.round(hoursUntilMeeting / 24), 'day');
}

function showToast(translationKey, toastType = 'success') {
  const toastIcon = document.createElement('span');
  toastIcon.className = 'toast__icon';
  toastIcon.textContent = toastType === 'success' ? '✓' : '!';
  const toastText = document.createElement('span');
  toastText.className = 'toast__text';
  toastText.textContent = translate(translationKey);

  toastElement.replaceChildren(toastIcon, toastText);
  toastElement.className = toastType === 'success' ? 'toast' : 'toast is-warning';
  toastElement.hidden = true;
  void toastElement.offsetWidth;
  toastElement.hidden = false;

  clearTimeout(toastHideTimerId);
  toastHideTimerId = setTimeout(() => {
    toastElement.hidden = true;
  }, TOAST_VISIBLE_MILLISECONDS);
}

function setFieldHint(hintElement, { translationKey = '', placeholderValues = {}, hintType = '' } = {}) {
  hintElement.dataset.translationKey = translationKey;
  hintElement.dataset.placeholderValues = JSON.stringify(placeholderValues);
  hintElement.textContent = translationKey ? translate(translationKey, placeholderValues) : '';
  hintElement.className = hintType ? `form-field__hint is-${hintType}` : 'form-field__hint';
}

function clearFieldHint(hintElement) {
  setFieldHint(hintElement);
}

function translateFieldHint(hintElement) {
  const { translationKey, placeholderValues } = hintElement.dataset;
  if (translationKey) hintElement.textContent = translate(translationKey, JSON.parse(placeholderValues || '{}'));
}

function applyCurrentLanguage() {
  document.documentElement.lang = currentLanguage;
  for (const element of document.querySelectorAll('[data-i18n-text]')) {
    element.textContent = translate(element.dataset.i18nText);
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
    element.placeholder = translate(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.ariaLabel = translate(element.dataset.i18nAriaLabel);
  }
  for (const languageOption of languageSwitcher.children) {
    languageOption.ariaChecked = String(languageOption.dataset.language === currentLanguage);
  }
  translateFieldHint(meetingDateTimeHint);
  if (quickAddInput.value.trim()) showQuickAddParseResult();
  else translateFieldHint(quickAddHint);
  renderReminderList();
}

function renderLanguageSwitcher() {
  for (const [languageCode, languageLabel] of Object.entries(SUPPORTED_LANGUAGES)) {
    const languageOption = document.createElement('button');
    languageOption.type = 'button';
    languageOption.role = 'radio';
    languageOption.className = 'language-switcher__option';
    languageOption.dataset.language = languageCode;
    languageOption.textContent = languageLabel;
    languageOption.addEventListener('click', async () => {
      if (languageCode === currentLanguage) return;
      currentLanguage = languageCode;
      translate = createTranslator(currentLanguage);
      applyCurrentLanguage();
      await saveLanguage(languageCode);
    });
    languageSwitcher.append(languageOption);
  }
}

function createReminderListItem(reminder) {
  const listItem = document.createElement('li');
  const isPast = reminder.isCompleted || reminder.startsAt < Date.now();
  listItem.className = isPast ? 'reminder-item is-completed' : 'reminder-item';

  const titleElement = document.createElement('div');
  titleElement.className = 'reminder-item__title';
  titleElement.textContent = reminder.title || translate('defaultMeetingTitle');
  titleElement.title = titleElement.textContent;

  const scheduleElement = document.createElement('div');
  scheduleElement.className = 'reminder-item__schedule';
  scheduleElement.textContent =
    `${formatMeetingDate(new Date(reminder.startsAt))} · ${formatTimeUntilMeeting(reminder.startsAt)}`;

  const detailsElement = document.createElement('div');
  detailsElement.append(titleElement, scheduleElement);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'reminder-item__delete-button';
  deleteButton.textContent = '×';
  deleteButton.title = translate('deleteReminderButton');
  deleteButton.addEventListener('click', async () => {
    await removeReminder(reminder.id);
    renderReminderList();
  });

  listItem.append(detailsElement, deleteButton);
  return listItem;
}

async function renderReminderList() {
  const reminders = await getReminders();
  reminderList.replaceChildren(...reminders.map(createReminderListItem));
  emptyListHint.hidden = reminders.length > 0;
}

function fillFormFromParsedDate(parseResult, { shouldFillTitle }) {
  meetingDateTimeInput.value = formatForDateTimeInput(parseResult.date);
  meetingDateTimeInput.classList.toggle('is-time-guessed', !parseResult.hasTime);
  if (parseResult.hasTime) clearFieldHint(meetingDateTimeHint);
  else setFieldHint(meetingDateTimeHint, { translationKey: 'timeNotFound', hintType: 'warning' });
  if (shouldFillTitle && parseResult.remainingText) meetingTitleInput.value = parseResult.remainingText;
}

function showQuickAddParseResult() {
  const parseResult = parseDateTime(quickAddInput.value.trim());
  if (!parseResult) {
    setFieldHint(quickAddHint, { translationKey: 'dateNotRecognized', hintType: 'warning' });
    return null;
  }
  setFieldHint(quickAddHint, { hintType: 'success' });
  quickAddHint.textContent = `→ ${formatMeetingDate(parseResult.date)}`;
  return parseResult;
}

quickAddInput.addEventListener('input', () => {
  if (!quickAddInput.value.trim()) {
    clearFieldHint(quickAddHint);
    return;
  }
  const parseResult = showQuickAddParseResult();
  if (parseResult) fillFormFromParsedDate(parseResult, { shouldFillTitle: true });
});

meetingDateTimeInput.addEventListener('input', () => {
  meetingDateTimeInput.classList.remove('is-time-guessed');
  clearFieldHint(meetingDateTimeHint);
});

reminderForm.addEventListener('submit', async (submitEvent) => {
  submitEvent.preventDefault();
  const meetingStartsAt = new Date(meetingDateTimeInput.value).getTime();
  if (!Number.isFinite(meetingStartsAt)) return;
  if (meetingStartsAt <= Date.now()) {
    setFieldHint(meetingDateTimeHint, { translationKey: 'selectedTimeAlreadyPassed', hintType: 'warning' });
    return;
  }

  await addReminder({
    title: meetingTitleInput.value.trim() || translate('defaultMeetingTitle'),
    startsAt: meetingStartsAt,
  });

  const isWithinLeadTime = meetingStartsAt - REMINDER_LEAD_TIME_MINUTES * MILLISECONDS_PER_MINUTE <= Date.now();
  if (isWithinLeadTime) showToast('reminderAddedWithinLeadTime', 'warning');
  else showToast('reminderAdded');

  reminderForm.reset();
  clearFieldHint(quickAddHint);
  clearFieldHint(meetingDateTimeHint);
  renderReminderList();
  if (isOpenedFromContextMenu) setTimeout(() => window.close(), CONTEXT_MENU_WINDOW_CLOSE_DELAY_MILLISECONDS);
});

previewButton.addEventListener('click', async () => {
  const { wasPlaneShown } = await chrome.runtime.sendMessage({
    type: 'show-plane-preview',
    meetingTitle: translate('previewMeetingTitle'),
  });
  if (wasPlaneShown) window.close();
  else showToast('previewUnavailableOnThisTab', 'warning');
});

function fillFormFromContextMenuSelection() {
  document.body.classList.add('is-context-menu-window');
  meetingTitleInput.value = pageParameters.get('title') || '';
  const selectedStartsAt = Number(pageParameters.get('startsAt'));
  if (selectedStartsAt) {
    fillFormFromParsedDate(
      { date: new Date(selectedStartsAt), hasTime: pageParameters.get('timeMissing') !== 'true' },
      { shouldFillTitle: false },
    );
  } else {
    setFieldHint(meetingDateTimeHint, {
      translationKey: 'selectedTextHasNoDate',
      placeholderValues: { selectedText: pageParameters.get('selectedText') || '' },
      hintType: 'warning',
    });
  }
}

renderLanguageSwitcher();
if (isOpenedFromContextMenu) fillFormFromContextMenuSelection();
applyCurrentLanguage();
(isOpenedFromContextMenu ? meetingDateTimeInput : quickAddInput).focus();
