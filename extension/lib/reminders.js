export const REMINDER_LEAD_TIME_MINUTES = 10;

export const REMINDER_KIND = {
  BEFORE_START: 'before-start',
  AT_START: 'at-start',
};

const REMINDERS_STORAGE_KEY = 'reminders';
const ALARM_NAME_SEPARATOR = '|';
const MILLISECONDS_PER_MINUTE = 60e3;
const MILLISECONDS_PER_DAY = 864e5;

export async function getReminders() {
  const { [REMINDERS_STORAGE_KEY]: storedReminders = [] } = await chrome.storage.local.get(REMINDERS_STORAGE_KEY);
  return storedReminders;
}

async function saveRemindersSortedByStartTime(reminders) {
  reminders.sort((firstReminder, secondReminder) => firstReminder.startsAt - secondReminder.startsAt);
  await chrome.storage.local.set({ [REMINDERS_STORAGE_KEY]: reminders });
}

export async function addReminder({ title, startsAt }) {
  const newReminder = { id: crypto.randomUUID(), title: title.trim(), startsAt, isCompleted: false };
  const reminders = await getReminders();
  reminders.push(newReminder);
  await saveRemindersSortedByStartTime(reminders);
  scheduleReminderAlarms(newReminder);
  return newReminder;
}

export async function removeReminder(reminderId) {
  await Promise.all(
    Object.values(REMINDER_KIND).map((reminderKind) => chrome.alarms.clear(buildAlarmName(reminderId, reminderKind))),
  );
  const remainingReminders = (await getReminders()).filter((reminder) => reminder.id !== reminderId);
  await saveRemindersSortedByStartTime(remainingReminders);
}

export async function markReminderCompleted(reminderId) {
  const reminders = await getReminders();
  const completedReminder = reminders.find((reminder) => reminder.id === reminderId);
  if (completedReminder) completedReminder.isCompleted = true;
  await saveRemindersSortedByStartTime(reminders);
}

export function buildAlarmName(reminderId, reminderKind) {
  return `${reminderId}${ALARM_NAME_SEPARATOR}${reminderKind}`;
}

export function parseAlarmName(alarmName) {
  const [reminderId, reminderKind] = alarmName.split(ALARM_NAME_SEPARATOR);
  const isKnownReminderKind = Object.values(REMINDER_KIND).includes(reminderKind);
  return isKnownReminderKind ? { reminderId, reminderKind } : null;
}

export function scheduleReminderAlarms(reminder) {
  const currentTimestamp = Date.now();
  const beforeStartTimestamp = reminder.startsAt - REMINDER_LEAD_TIME_MINUTES * MILLISECONDS_PER_MINUTE;
  if (beforeStartTimestamp > currentTimestamp) {
    chrome.alarms.create(buildAlarmName(reminder.id, REMINDER_KIND.BEFORE_START), { when: beforeStartTimestamp });
  }
  if (reminder.startsAt > currentTimestamp) {
    chrome.alarms.create(buildAlarmName(reminder.id, REMINDER_KIND.AT_START), { when: reminder.startsAt });
  }
}

export async function rescheduleAllReminderAlarms() {
  await chrome.alarms.clearAll();
  const oldestKeptStartTimestamp = Date.now() - MILLISECONDS_PER_DAY;
  const recentReminders = (await getReminders()).filter((reminder) => reminder.startsAt > oldestKeptStartTimestamp);
  await saveRemindersSortedByStartTime(recentReminders);
  recentReminders.forEach(scheduleReminderAlarms);
}

export function formatTimeOfDay(timestamp, locale) {
  return new Date(timestamp).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}
