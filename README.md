# ✈ Plane Reminder

A Manifest V3 extension for Chrome, Edge and Yandex Browser.
**10 minutes before** a meeting and **when it starts**, a paper plane flies across the current page
towing a banner such as “In 10 min: Team call · 2:30 PM” or “Starting: …”.

## Features

- Add reminders from the popup: a title plus date and time, or a single **quick add** line
  like `tomorrow at 3pm team call`.
- **Select a date on any page → right-click → “✈ Remind me about a meeting”.**
  A small window opens with the date and title already filled in
  (the title is taken from the text around the date or from the tab title).
- The animation is loaded from Vercel inside an `iframe`. If no URL is configured, or Vercel
  does not respond within 4 seconds, the copy bundled with the extension is used,
  so a reminder is always shown.
- A system notification is sent only when nobody would see the plane: the browser is minimized
  or unfocused, or the active tab is a browser page such as `chrome://`.

## Languages

Russian, English and Chinese. The initial language follows the browser UI language
(`ru*` → Russian, `zh*` → Chinese, anything else → English). The **RU · EN · 中文** switcher
in the popup header changes the language everywhere at once: popup, context menu item,
plane banner and system notifications. The choice is saved in `chrome.storage.sync`.

All interface strings live in `extension/lib/i18n.js`. The extension name and description
shown on `chrome://extensions` live in `extension/_locales/`.

## Supported date formats

| Language | Examples |
| --- | --- |
| Russian | `15.10.2026 14:30`, `15.10 в 9:05`, `15 октября в 18:00`, `3 марта 2027 г.`, `завтра в 10:00`, `в пятницу в 16 часов` |
| English | `Oct 20, 3:30 pm`, `tomorrow at 9am`, `on Friday 18:00` |
| Chinese | `明天 15:00`, `10月15日 下午3点半`, `2026年11月5日`, `周五`, `下周一 10点`, `晚上8点` |
| Any | `2026-11-05T08:15`, `14:30` |

A date without a time defaults to 09:00 and the form highlights it for review.

## Project structure

```
extension/                  the folder loaded into the browser
  manifest.json
  config.js                 PLANE_ANIMATION_URL — the Vercel URL of the animation
  background.js             alarms, context menu, showing the plane, notifications
  lib/date-parser.js        extracts a date and time from free text
  lib/reminders.js          reminder storage and alarm scheduling
  lib/i18n.js               translations (ru / en / zh) and language selection
  _locales/                 extension name and description per browser language
  popup/                    popup and the form window opened from the context menu
  overlay/                  overlay iframe plus the bundled copy of the animation
web/                        deployed to Vercel (the animation page)
scripts/sync-plane.mjs      copies web/* into extension/overlay/
tests/                      date parser and translation tests
```

## Installing the extension

1. Open `chrome://extensions` (`edge://extensions` in Edge, `browser://extensions` in Yandex Browser).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.

To check it, open a regular website, open the popup and click **✈ Preview a reminder**.

## Deploying the animation to Vercel

```bash
cd web
npx vercel --prod
```

Then set the URL once in `extension/config.js`:

```js
export const PLANE_ANIMATION_URL = 'https://<project>.vercel.app';
```

and reload the extension. Users do not need to configure anything.

`web/vercel.json` allows the page to be embedded in an iframe (`frame-ancestors`), including from
the extension. The meeting title is **never put into the URL**: it is delivered to the iframe via
`postMessage`, so it does not appear in Vercel logs.

Demo mode: open `https://<project>.vercel.app/?kind=at-start&title=Team%20call&time=15:00&lang=en`.
Click to replay; add `&freezeAt=3` to freeze the frame at the third second.

## Development

```bash
npm test        # date parser and translation tests
npm run sync    # after editing web/, refresh the copy in extension/overlay/
```

After editing `extension/`, click **Reload** on the extension card in `chrome://extensions`.

### How a reminder is shown

```
alarm → background.js → executeScript into the active tab of every window
  → <iframe overlay/overlay.html#key>   (pointer-events: none, maximum z-index)
      → reads the reminder from chrome.storage.session by key (the page cannot see it)
      → <iframe https://….vercel.app>  ← postMessage { type: 'start-flight', … }
          → the plane leaves the screen → { type: 'flight-finished' } → the iframe is removed
```
