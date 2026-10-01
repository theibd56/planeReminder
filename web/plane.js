(() => {
  const MESSAGE_SOURCE = 'plane-reminder';
  const REMINDER_KIND_AT_START = 'at-start';
  const REMINDER_KIND_BEFORE_START = 'before-start';

  const ROPE_LENGTH_PX = 70;
  const PLANE_HALF_WIDTH_PX = 50;
  const PLANE_HALF_HEIGHT_PX = 25;
  const PLANE_TAIL_OFFSET_PX = { x: -43, y: 3 };
  const BANNER_DROP_BELOW_PATH_PX = 8;
  const FLIGHT_START_OFFSET_PX = 120;
  const FLIGHT_EXIT_MARGIN_PX = 80;
  const HEADING_SAMPLE_DISTANCE_PX = 3;
  const MINIMUM_SPEED_PX_PER_SECOND = 260;
  const MAXIMUM_SPEED_PX_PER_SECOND = 420;
  const REDUCED_MOTION_DISPLAY_MILLISECONDS = 6000;
  const MAXIMUM_TITLE_LENGTH = 140;
  const MAXIMUM_TIME_LENGTH = 20;
  const MAXIMUM_BANNER_LABEL_LENGTH = 40;

  const ROPE_STROKES = [
    { color: 'rgba(255, 255, 255, .55)', width: 2.5 },
    { color: 'rgba(43, 74, 122, .6)', width: 1 },
  ];

  const DEMO_TEXT_BY_LANGUAGE = {
    ru: { [REMINDER_KIND_BEFORE_START]: 'Через 10 мин', [REMINDER_KIND_AT_START]: 'Начинается', meetingTitle: 'Созвон с командой' },
    en: { [REMINDER_KIND_BEFORE_START]: 'In 10 min', [REMINDER_KIND_AT_START]: 'Starting', meetingTitle: 'Team call' },
    zh: { [REMINDER_KIND_BEFORE_START]: '10 分钟后', [REMINDER_KIND_AT_START]: '即将开始', meetingTitle: '团队会议' },
  };

  const planeElement = document.getElementById('paper-plane');
  const bannerElement = document.getElementById('reminder-banner');
  const ropeCanvas = document.getElementById('rope-canvas');
  const ropeDrawingContext = ropeCanvas.getContext('2d');
  const isEmbeddedInFrame = window.parent !== window;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isFlightInProgress = false;

  function notifyParentWindow(messageType) {
    if (isEmbeddedInFrame) window.parent.postMessage({ source: MESSAGE_SOURCE, type: messageType }, '*');
  }

  function fillBanner({ reminderKind, meetingTitle, meetingTime, bannerLabel }) {
    bannerElement.classList.toggle('is-at-start', reminderKind === REMINDER_KIND_AT_START);
    bannerElement.querySelector('.banner__label').textContent = bannerLabel;
    bannerElement.querySelector('.banner__title').textContent = meetingTitle;
    bannerElement.querySelector('.banner__time').textContent = meetingTime;
  }

  function resizeRopeCanvasToViewport() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    ropeCanvas.width = innerWidth * devicePixelRatio;
    ropeCanvas.height = innerHeight * devicePixelRatio;
    ropeCanvas.style.width = `${innerWidth}px`;
    ropeCanvas.style.height = `${innerHeight}px`;
    ropeDrawingContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function createFlightPath(viewportHeight, passIndex) {
    const waveAmplitude = Math.min(22, viewportHeight * 0.03);
    const waveLength = 420;
    const baselineY = Math.max(80, viewportHeight * 0.18) + passIndex * Math.min(200, viewportHeight * 0.28);
    const wavePhase = passIndex * Math.PI;
    return (traveledDistance) => ({
      x: traveledDistance - FLIGHT_START_OFFSET_PX,
      y: baselineY + waveAmplitude * Math.sin(traveledDistance / waveLength + wavePhase),
    });
  }

  const clampValue = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const rotatePoint = (pointX, pointY, angleRadians) => ({
    x: pointX * Math.cos(angleRadians) - pointY * Math.sin(angleRadians),
    y: pointX * Math.sin(angleRadians) + pointY * Math.cos(angleRadians),
  });

  function getHeadingAngle(getPointAtDistance, traveledDistance) {
    const pointBehind = getPointAtDistance(traveledDistance - HEADING_SAMPLE_DISTANCE_PX);
    const pointAhead = getPointAtDistance(traveledDistance + HEADING_SAMPLE_DISTANCE_PX);
    return Math.atan2(pointAhead.y - pointBehind.y, pointAhead.x - pointBehind.x);
  }

  function drawRopes(planeTailPoint, bannerAnchorPoint, bannerTiltRadians, bannerHeight) {
    ropeDrawingContext.clearRect(0, 0, innerWidth, innerHeight);
    const cornerOffsetsY = [-bannerHeight * 0.38, bannerHeight * 0.38];
    for (const { color, width } of ROPE_STROKES) {
      ropeDrawingContext.strokeStyle = color;
      ropeDrawingContext.lineWidth = width;
      for (const cornerOffsetY of cornerOffsetsY) {
        const rotatedCornerOffset = rotatePoint(0, cornerOffsetY, bannerTiltRadians);
        const cornerX = bannerAnchorPoint.x + rotatedCornerOffset.x;
        const cornerY = bannerAnchorPoint.y + rotatedCornerOffset.y;
        const ropeSagControlX = (planeTailPoint.x + bannerAnchorPoint.x) / 2;
        const ropeSagControlY = (planeTailPoint.y + cornerY) / 2 + 4;
        ropeDrawingContext.beginPath();
        ropeDrawingContext.moveTo(planeTailPoint.x, planeTailPoint.y);
        ropeDrawingContext.quadraticCurveTo(ropeSagControlX, ropeSagControlY, cornerX, cornerY);
        ropeDrawingContext.stroke();
      }
    }
  }

  function startFlight(flightOptions) {
    if (isFlightInProgress) return;
    isFlightInProgress = true;
    fillBanner(flightOptions);
    resizeRopeCanvasToViewport();
    planeElement.hidden = false;
    bannerElement.hidden = false;

    const viewportWidth = innerWidth;
    const viewportHeight = innerHeight;
    const bannerWidth = bannerElement.offsetWidth;
    const bannerHeight = bannerElement.offsetHeight;

    if (prefersReducedMotion) {
      planeElement.hidden = true;
      bannerElement.style.transform = `translate(${(viewportWidth - bannerWidth) / 2}px, 40px)`;
      setTimeout(finishFlight, REDUCED_MOTION_DISPLAY_MILLISECONDS);
      return;
    }

    const totalPasses = flightOptions.reminderKind === REMINDER_KIND_AT_START ? 2 : 1;
    const distancePerPass = viewportWidth + FLIGHT_START_OFFSET_PX + ROPE_LENGTH_PX + bannerWidth + FLIGHT_EXIT_MARGIN_PX;
    const speedPxPerSecond = clampValue(viewportWidth / 5, MINIMUM_SPEED_PX_PER_SECOND, MAXIMUM_SPEED_PX_PER_SECOND);
    let currentPassIndex = 0;
    let getPointAtDistance = createFlightPath(viewportHeight, currentPassIndex);
    let passStartTimestamp = performance.now();

    const renderFrame = (frameTimestamp) => {
      if (flightOptions.freezeAtSeconds != null) {
        frameTimestamp = passStartTimestamp + flightOptions.freezeAtSeconds * 1000;
      }
      const secondsSincePassStart = (frameTimestamp - passStartTimestamp) / 1000;
      const traveledDistance = secondsSincePassStart * speedPxPerSecond;

      if (traveledDistance >= distancePerPass) {
        currentPassIndex += 1;
        if (currentPassIndex >= totalPasses) {
          finishFlight();
          return;
        }
        getPointAtDistance = createFlightPath(viewportHeight, currentPassIndex);
        passStartTimestamp = frameTimestamp;
        requestAnimationFrame(renderFrame);
        return;
      }

      const planePosition = getPointAtDistance(traveledDistance);
      const wingWobbleRadians = 0.035 * Math.sin(secondsSincePassStart * 2.6);
      const planeAngleRadians = getHeadingAngle(getPointAtDistance, traveledDistance) + wingWobbleRadians;
      planeElement.style.transform =
        `translate(${planePosition.x - PLANE_HALF_WIDTH_PX}px, ${planePosition.y - PLANE_HALF_HEIGHT_PX}px) ` +
        `rotate(${planeAngleRadians}rad)`;

      const bannerTraveledDistance = Math.max(0, traveledDistance - ROPE_LENGTH_PX);
      const bannerAnchorPoint = getPointAtDistance(bannerTraveledDistance);
      bannerAnchorPoint.y += BANNER_DROP_BELOW_PATH_PX;
      const bannerFollowTiltRadians = clampValue(getHeadingAngle(getPointAtDistance, bannerTraveledDistance) * 0.5, -0.05, 0.05);
      const bannerSwayRadians = 0.012 * Math.sin(secondsSincePassStart * 3.1);
      const bannerTiltRadians = bannerFollowTiltRadians + bannerSwayRadians;
      const bannerFlutterDegrees = 1.1 * Math.sin(secondsSincePassStart * 5.3 + 1);
      bannerElement.style.transform =
        `translate(${bannerAnchorPoint.x - bannerWidth}px, ${bannerAnchorPoint.y - bannerHeight / 2}px) ` +
        `rotate(${bannerTiltRadians}rad) skewY(${bannerFlutterDegrees}deg)`;

      const rotatedTailOffset = rotatePoint(PLANE_TAIL_OFFSET_PX.x, PLANE_TAIL_OFFSET_PX.y, planeAngleRadians);
      const planeTailPoint = { x: planePosition.x + rotatedTailOffset.x, y: planePosition.y + rotatedTailOffset.y };
      drawRopes(planeTailPoint, bannerAnchorPoint, bannerTiltRadians, bannerHeight);

      if (flightOptions.freezeAtSeconds == null) requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  }

  function finishFlight() {
    isFlightInProgress = false;
    planeElement.hidden = true;
    bannerElement.hidden = true;
    ropeDrawingContext.clearRect(0, 0, ropeCanvas.width, ropeCanvas.height);
    notifyParentWindow('flight-finished');
  }

  window.addEventListener('message', (messageEvent) => {
    const flightRequest = messageEvent.data;
    const isFlightRequestFromParent =
      messageEvent.source === window.parent
      && flightRequest?.source === MESSAGE_SOURCE
      && flightRequest.type === 'start-flight';
    if (!isFlightRequestFromParent) return;

    startFlight({
      reminderKind: flightRequest.reminderKind === REMINDER_KIND_AT_START ? REMINDER_KIND_AT_START : REMINDER_KIND_BEFORE_START,
      meetingTitle: String(flightRequest.meetingTitle || '').slice(0, MAXIMUM_TITLE_LENGTH),
      meetingTime: String(flightRequest.meetingTime || '').slice(0, MAXIMUM_TIME_LENGTH),
      bannerLabel: String(flightRequest.bannerLabel || '').slice(0, MAXIMUM_BANNER_LABEL_LENGTH),
    });
  });

  function startDemoMode() {
    const queryParameters = new URLSearchParams(location.search);
    const requestedLanguage = (queryParameters.get('lang') || navigator.language || '').toLowerCase();
    const demoLanguage = requestedLanguage.startsWith('ru') ? 'ru' : requestedLanguage.startsWith('zh') ? 'zh' : 'en';
    const demoText = DEMO_TEXT_BY_LANGUAGE[demoLanguage];
    const reminderKind =
      queryParameters.get('kind') === REMINDER_KIND_AT_START ? REMINDER_KIND_AT_START : REMINDER_KIND_BEFORE_START;
    const demoFlightOptions = {
      reminderKind,
      meetingTitle: queryParameters.get('title') || demoText.meetingTitle,
      meetingTime: queryParameters.get('time') || '14:30',
      bannerLabel: demoText[reminderKind],
      freezeAtSeconds: queryParameters.has('freezeAt') ? Number(queryParameters.get('freezeAt')) : null,
    };

    document.body.classList.add('is-demo-mode');
    document.getElementById('demo-mode-hint').hidden = false;
    document.addEventListener('click', () => startFlight(demoFlightOptions));
    startFlight(demoFlightOptions);
  }

  if (isEmbeddedInFrame) {
    notifyParentWindow('animation-ready');
  } else {
    startDemoMode();
  }
})();
