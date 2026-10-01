import { PLANE_ANIMATION_URL } from './config.js';
import { parseDateTime } from './lib/date-parser.js';
import {
  REMINDER_KIND,
  REMINDER_LEAD_TIME_MINUTES,
  getReminders,
  markReminderCompleted,
  rescheduleAllReminderAlarms,
  parseAlarmName,
  formatTimeOfDay,
} from './lib/reminders.js';
import { LOCALE_BY_LANGUAGE, getCurrentLanguage, createTranslator, isLanguageChange } from './lib/i18n.js';

const CONTEXT_MENU_ITEM_ID = 'plane-reminder-add-from-selection';
const NOTIFICATION_ID_PREFIX = 'plane-reminder-';
const OVERLAY_SESSION_KEY_PREFIX = 'overlay:';
const MILLISECONDS_PER_MINUTE = 60e3;
const MAXIMUM_ALARM_DELAY_BY_KIND = {
  [REMINDER_KIND.BEFORE_START]: 5 * MILLISECONDS_PER_MINUTE,
  [REMINDER_KIND.AT_START]: 15 * MILLISECONDS_PER_MINUTE,
};
const MINIMUM_MEANINGFUL_TITLE_LENGTH = 3;
const MAXIMUM_TITLE_LENGTH = 140;
const MAXIMUM_SELECTED_TEXT_LENGTH = 300;
const REMINDER_FORM_WINDOW_SIZE = { width: 380, height: 560 };

async function createContextMenuInCurrentLanguage() {
  const translate = createTranslator(await getCurrentLanguage());
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ITEM_ID,
    title: translate('contextMenuTitle'),
    contexts: ['selection'],
  });
}

function initializeExtension() {
  createContextMenuInCurrentLanguage();
  rescheduleAllReminderAlarms();
}

chrome.runtime.onInstalled.addListener(initializeExtension);
chrome.runtime.onStartup.addListener(initializeExtension);

chrome.storage.onChanged.addListener((storageChanges, storageAreaName) => {
  if (isLanguageChange(storageChanges, storageAreaName)) createContextMenuInCurrentLanguage();
});

async function buildAnnouncement(reminderKind, meetingTitle, meetingStartsAt) {
  const language = await getCurrentLanguage();
  const translate = createTranslator(language);
  const meetingTime = formatTimeOfDay(meetingStartsAt, LOCALE_BY_LANGUAGE[language]);
  const isAtStart = reminderKind === REMINDER_KIND.AT_START;
  return {
    reminderKind,
    meetingTitle,
    meetingTime,
    bannerLabel: isAtStart
      ? translate('bannerLabelAtStart')
      : translate('bannerLabelBeforeStart', { minutes: REMINDER_LEAD_TIME_MINUTES }),
    notificationText: isAtStart
      ? translate('notificationTextAtStart', { time: meetingTime })
      : translate('notificationTextBeforeStart', { minutes: REMINDER_LEAD_TIME_MINUTES, time: meetingTime }),
  };
}

chrome.contextMenus.onClicked.addListener(async (clickInfo, clickedTab) => {
  if (clickInfo.menuItemId !== CONTEXT_MENU_ITEM_ID) return;

  const selectedText = (clickInfo.selectionText || '').trim();
  const parseResult = parseDateTime(selectedText);
  const textAroundDate = parseResult?.remainingText ?? '';
  const suggestedTitle = textAroundDate.length >= MINIMUM_MEANINGFUL_TITLE_LENGTH ? textAroundDate : clickedTab?.title || '';

  const reminderFormParameters = new URLSearchParams({
    openedFrom: 'context-menu',
    selectedText: selectedText.slice(0, MAXIMUM_SELECTED_TEXT_LENGTH),
    title: suggestedTitle.slice(0, MAXIMUM_TITLE_LENGTH),
  });
  if (parseResult) {
    reminderFormParameters.set('startsAt', String(parseResult.date.getTime()));
    if (!parseResult.hasTime) reminderFormParameters.set('timeMissing', 'true');
  }

  await chrome.windows.create({
    url: chrome.runtime.getURL(`popup/popup.html?${reminderFormParameters}`),
    type: 'popup',
    focused: true,
    ...REMINDER_FORM_WINDOW_SIZE,
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const parsedAlarmName = parseAlarmName(alarm.name);
  if (!parsedAlarmName) return;

  const { reminderId, reminderKind } = parsedAlarmName;
  const reminder = (await getReminders()).find((storedReminder) => storedReminder.id === reminderId);
  if (!reminder) return;

  const alarmDelay = Date.now() - alarm.scheduledTime;
  if (alarmDelay > MAXIMUM_ALARM_DELAY_BY_KIND[reminderKind]) return;

  await announceReminder(await buildAnnouncement(reminderKind, reminder.title, reminder.startsAt));
  if (reminderKind === REMINDER_KIND.AT_START) await markReminderCompleted(reminderId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'show-plane-preview') return;

  const previewStartsAt = Date.now() + REMINDER_LEAD_TIME_MINUTES * MILLISECONDS_PER_MINUTE;
  buildAnnouncement(REMINDER_KIND.BEFORE_START, message.meetingTitle, previewStartsAt)
    .then(showPlaneInActiveTabs)
    .then((wasPlaneShown) => sendResponse({ wasPlaneShown }));
  return true;
});

async function isBrowserWindowVisibleToUser() {
  const lastFocusedWindow = await chrome.windows.getLastFocused().catch(() => null);
  return Boolean(lastFocusedWindow?.focused) && lastFocusedWindow.state !== 'minimized';
}

async function announceReminder(announcement) {
  const wasPlaneShown = await showPlaneInActiveTabs(announcement);
  if (wasPlaneShown && (await isBrowserWindowVisibleToUser())) return;

  chrome.notifications.create(`${NOTIFICATION_ID_PREFIX}${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: announcement.meetingTitle,
    message: announcement.notificationText,
    priority: 2,
    requireInteraction: announcement.reminderKind === REMINDER_KIND.AT_START,
  });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(NOTIFICATION_ID_PREFIX)) return;
  chrome.notifications.clear(notificationId);

  const lastFocusedWindow = await chrome.windows.getLastFocused().catch(() => null);
  if (!lastFocusedWindow) return;
  const restoredWindowState = lastFocusedWindow.state === 'minimized' ? 'normal' : lastFocusedWindow.state;
  chrome.windows.update(lastFocusedWindow.id, { focused: true, state: restoredWindowState });
});

async function removeOutdatedOverlayData() {
  const sessionData = await chrome.storage.session.get(null);
  const outdatedOverlayKeys = Object.keys(sessionData).filter((key) => key.startsWith(OVERLAY_SESSION_KEY_PREFIX));
  if (outdatedOverlayKeys.length) await chrome.storage.session.remove(outdatedOverlayKeys);
}

async function showPlaneInActiveTabs(announcement) {
  await removeOutdatedOverlayData();
  const overlayDataKey = crypto.randomUUID();
  await chrome.storage.session.set({
    [`${OVERLAY_SESSION_KEY_PREFIX}${overlayDataKey}`]: { ...announcement, planeAnimationUrl: PLANE_ANIMATION_URL },
  });

  const activeTabsInAllWindows = await chrome.tabs.query({ active: true });
  const injectionResults = await Promise.allSettled(
    activeTabsInAllWindows.map((activeTab) =>
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: injectPlaneOverlayIntoPage,
        args: [overlayDataKey],
      }),
    ),
  );
  return injectionResults.some((injectionResult) => injectionResult.status === 'fulfilled');
}

function injectPlaneOverlayIntoPage(overlayDataKey) {
  const OVERLAY_ELEMENT_ID = 'plane-reminder-overlay';
  const OVERLAY_SAFETY_TIMEOUT_MILLISECONDS = 60e3;

  document.getElementById(OVERLAY_ELEMENT_ID)?.remove();

  const overlayFrame = document.createElement('iframe');
  overlayFrame.id = OVERLAY_ELEMENT_ID;
  overlayFrame.src = `${chrome.runtime.getURL('overlay/overlay.html')}#${overlayDataKey}`;
  overlayFrame.setAttribute('allowtransparency', 'true');
  overlayFrame.setAttribute('aria-hidden', 'true');
  overlayFrame.tabIndex = -1;
  overlayFrame.style.cssText = [
    'position:fixed', 'inset:0', 'width:100vw', 'height:100vh', 'border:0', 'margin:0', 'padding:0',
    'z-index:2147483647', 'pointer-events:none', 'background:transparent', 'color-scheme:normal',
  ].map((cssDeclaration) => `${cssDeclaration} !important`).join(';');

  const removeOverlay = () => {
    overlayFrame.remove();
    window.removeEventListener('message', handleOverlayMessage);
  };
  const handleOverlayMessage = (messageEvent) => {
    const isFlightFinishedMessage =
      messageEvent.source === overlayFrame.contentWindow
      && messageEvent.data?.source === 'plane-reminder'
      && messageEvent.data.type === 'flight-finished';
    if (isFlightFinishedMessage) removeOverlay();
  };
  window.addEventListener('message', handleOverlayMessage);
  setTimeout(removeOverlay, OVERLAY_SAFETY_TIMEOUT_MILLISECONDS);

  (document.body || document.documentElement).appendChild(overlayFrame);
}
