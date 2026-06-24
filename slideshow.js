const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.addInitScript(() => {
    const mockSynth = {
      _voices: [{ name: 'Google français', lang: 'fr-FR', localService: false }],
      getVoices() { return this._voices; },
      onvoiceschanged: null,
      speak() {},
      cancel() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get() { return mockSynth; } });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  });

  await page.goto('http://localhost:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(800);

  // ── Test 1: slideshow engine with mocked gallery images ──
  const slideshowResult = await page.evaluate(() => {
    const fakeImages = [
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
      'https://example.com/img3.jpg',
    ];
    startSlideshow(fakeImages, 'linear-gradient(135deg,#111,#222)');
    const layerA = document.getElementById('playerThumbA');
    const layerB = document.getElementById('playerThumbB');
    const before = {
      aVisible: layerA.classList.contains('visible'),
      bVisible: layerB.classList.contains('visible'),
      aBg: layerA.style.backgroundImage,
      slideshowIndex,
      hasTimer: !!slideshowTimer,
    };
    showNextSlide();
    const after = {
      aVisible: layerA.classList.contains('visible'),
      bVisible: layerB.classList.contains('visible'),
      bBg: layerB.style.backgroundImage,
      slideshowIndex,
    };
    showNextSlide();
    const after2 = {
      aVisible: layerA.classList.contains('visible'),
      bVisible: layerB.classList.contains('visible'),
      aBg: layerA.style.backgroundImage,
      slideshowIndex,
    };
    stopSlideshow();
    return { before, after, after2, hasTimerAfterStop: !!slideshowTimer };
  });
  console.log('--- Slideshow test ---');
  console.log(JSON.stringify(slideshowResult, null, 2));

  // ── Test 2: slideshow with empty images falls back to gradient ──
  const fallbackResult = await page.evaluate(() => {
    startSlideshow([], 'linear-gradient(135deg,#abc,#def)');
    const layerA = document.getElementById('playerThumbA');
    return {
      aVisible: layerA.classList.contains('visible'),
      aBackground: layerA.style.background,
      hasTimer: !!slideshowTimer,
    };
  });
  console.log('--- Fallback (no images) test ---');
  console.log(JSON.stringify(fallbackResult, null, 2));

  // ── Test 3: subtitles build + toggle ──
  const subsResult = await page.evaluate(() => {
    const sentences = ['Première phrase de test.', 'Deuxième phrase ici.', 'Troisième et dernière phrase.'];
    buildTeleprompter(sentences);
    highlightSentence(0);
    const sub0 = document.getElementById('subtitleText').textContent;
    highlightSentence(2);
    const sub2 = document.getElementById('subtitleText').textContent;

    const barBefore = document.getElementById('subtitleBar').classList.contains('hidden');
    const btnBefore = document.getElementById('subtitleToggleBtn').classList.contains('active');
    toggleSubtitles();
    const barAfterToggle = document.getElementById('subtitleBar').classList.contains('hidden');
    const btnAfterToggle = document.getElementById('subtitleToggleBtn').classList.contains('active');
    toggleSubtitles(); // toggle back on
    const barAfterToggle2 = document.getElementById('subtitleBar').classList.contains('hidden');

    return {
      sub0, sub2,
      barHiddenInitially: barBefore,
      btnActiveInitially: btnBefore,
      barHiddenAfterToggleOff: barAfterToggle,
      btnActiveAfterToggleOff: btnAfterToggle,
      barHiddenAfterToggleBackOn: barAfterToggle2,
      subtitlesEnabledDefault: loadSubsPref(),
    };
  });
  console.log('--- Subtitles test ---');
  console.log(JSON.stringify(subsResult, null, 2));

  console.log('--- Page errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');

  await browser.close();
})();
