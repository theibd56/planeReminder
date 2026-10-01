const MESSAGE_SOURCE = 'plane-reminder';
const OVERLAY_SESSION_KEY_PREFIX = 'overlay:';
const REMOTE_ANIMATION_READY_TIMEOUT_MILLISECONDS = 4000;

function notifyPageThatFlightFinished() {
  window.parent.postMessage({ source: MESSAGE_SOURCE, type: 'flight-finished' }, '*');
}

function getAllowedRemoteAnimationUrl(configuredUrl) {
  try {
    const parsedUrl = new URL(configuredUrl);
    const isSecureOrLocal = parsedUrl.protocol === 'https:' || parsedUrl.hostname === 'localhost';
    return isSecureOrLocal ? parsedUrl : null;
  } catch {
    return null;
  }
}

async function startOverlay() {
  const overlaySessionKey = OVERLAY_SESSION_KEY_PREFIX + location.hash.slice(1);
  const { [overlaySessionKey]: announcement } = await chrome.storage.session.get(overlaySessionKey);
  if (!announcement) {
    notifyPageThatFlightFinished();
    return;
  }

  const bundledAnimationUrl = chrome.runtime.getURL('overlay/plane.html');
  const remoteAnimationUrl = getAllowedRemoteAnimationUrl(announcement.planeAnimationUrl);

  const animationFrame = document.createElement('iframe');
  animationFrame.setAttribute('allowtransparency', 'true');
  document.body.appendChild(animationFrame);

  let animationFrameOrigin = location.origin;
  let isAnimationReady = false;
  let fallbackTimerId = null;

  const loadAnimation = (animationUrl) => {
    animationFrameOrigin = new URL(animationUrl).origin;
    animationFrame.src = animationUrl;
  };

  window.addEventListener('message', (messageEvent) => {
    const isMessageFromAnimation =
      messageEvent.source === animationFrame.contentWindow
      && messageEvent.origin === animationFrameOrigin
      && messageEvent.data?.source === MESSAGE_SOURCE;
    if (!isMessageFromAnimation) return;

    if (messageEvent.data.type === 'animation-ready' && !isAnimationReady) {
      isAnimationReady = true;
      clearTimeout(fallbackTimerId);
      const { reminderKind, meetingTitle, meetingTime, bannerLabel } = announcement;
      animationFrame.contentWindow.postMessage(
        { source: MESSAGE_SOURCE, type: 'start-flight', reminderKind, meetingTitle, meetingTime, bannerLabel },
        animationFrameOrigin,
      );
    } else if (messageEvent.data.type === 'flight-finished') {
      notifyPageThatFlightFinished();
    }
  });

  if (remoteAnimationUrl) {
    loadAnimation(remoteAnimationUrl.href);
    fallbackTimerId = setTimeout(() => {
      if (!isAnimationReady) loadAnimation(bundledAnimationUrl);
    }, REMOTE_ANIMATION_READY_TIMEOUT_MILLISECONDS);
  } else {
    loadAnimation(bundledAnimationUrl);
  }
}

startOverlay();
