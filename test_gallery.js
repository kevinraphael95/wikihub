const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  // Test the pure filtering logic directly (no network needed)
  const filterResult = await page.evaluate(() => {
    const cases = [
      { file: 'Fichier:Trou_noir_M87.jpg', w: 800, h: 600, expect: true },
      { file: 'Fichier:Commons-logo.svg', w: 500, h: 500, expect: false },
      { file: 'Fichier:Icon-edit.png', w: 300, h: 300, expect: false },
      { file: 'Fichier:Wiki_letter_w.svg', w: 400, h: 400, expect: false },
      { file: 'Fichier:Tiny_thumbnail.jpg', w: 80, h: 60, expect: false }, // too small
      { file: 'Fichier:Wide_banner.jpg', w: 2000, h: 100, expect: false }, // extreme ratio
      { file: 'Fichier:Photo_normale.jpg', w: 1024, h: 768, expect: true },
      { file: 'Fichier:Animation.gif', w: 500, h: 500, expect: false },
      { file: 'Fichier:Flag_of_France.svg', w: 600, h: 400, expect: false },
      { file: 'Fichier:Ambox_warning.png', w: 220, h: 220, expect: false },
    ];
    return cases.map(c => ({
      file: c.file,
      result: looksLikeUsefulImage(c.file, c.w, c.h),
      expected: c.expect,
      pass: looksLikeUsefulImage(c.file, c.w, c.h) === c.expect,
    }));
  });

  console.log('--- Image filtering test ---');
  console.log(JSON.stringify(filterResult, null, 2));
  const allPass = filterResult.every(r => r.pass);
  console.log('ALL PASS:', allPass);

  // Test fetchArticleGallery end-to-end with mocked fetch (simulating Wikipedia API responses)
  const galleryResult = await page.evaluate(async () => {
    const originalFetch = window.fetch;
    window.fetch = async (url) => {
      if (url.includes('prop=images')) {
        return {
          ok: true,
          json: async () => ({
            query: { pages: { '1': { images: [
              { title: 'Fichier:Photo1.jpg' },
              { title: 'Fichier:Commons-logo.svg' },
              { title: 'Fichier:Photo2.jpg' },
            ] } } }
          })
        };
      }
      if (url.includes('prop=imageinfo') && url.includes('fr.wikipedia.org')) {
        return {
          ok: true,
          json: async () => ({
            query: { pages: {
              '1': { title: 'Fichier:Photo1.jpg', imageinfo: [{ thumburl: 'https://x/photo1.jpg', thumbwidth: 900, thumbheight: 600 }] },
              '2': { title: 'Fichier:Photo2.jpg', imageinfo: [{ thumburl: 'https://x/photo2.jpg', thumbwidth: 800, thumbheight: 500 }] },
            } }
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    const images = await fetchArticleGallery('Test Article XYZ');
    window.fetch = originalFetch;
    return images;
  });

  console.log('--- fetchArticleGallery end-to-end test ---');
  console.log(JSON.stringify(galleryResult, null, 2));

  console.log('--- Page errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');

  await browser.close();
})();
