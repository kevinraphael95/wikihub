// ═══════════════════════════════════════════════════════
//  WikiHub — app.js
// ═══════════════════════════════════════════════════════

// ── CONSTANTS ──────────────────────────────────────────
const PALETTES = [
  ['#1a1a2e','#e94560'], ['#0f3460','#4fc3f7'], ['#533483','#e8d5b7'],
  ['#1b4332','#95d5b2'], ['#7b2d8b','#e040fb'], ['#1565c0','#82b1ff'],
  ['#bf360c','#ffab40'], ['#1b5e20','#a5d6a7'], ['#4a148c','#ea80fc'],
  ['#006064','#80deea'], ['#37474f','#b0bec5'], ['#e65100','#ffcc80'],
  ['#880e4f','#f48fb1'], ['#1a237e','#9fa8da'], ['#33691e','#dcedc8'],
  ['#3e2723','#bcaaa4'], ['#263238','#80cbc4'], ['#4e342e','#ffccbc'],
  ['#212121','#ee82ee'], ['#b71c1c','#ef9a9a'],
];
const EMOJIS = ['🔬','🌍','⚗️','🏛️','🎨','💡','⚽','🧬','🌌','📡','🗺️','🎭','🧠','⚔️','🌊','🦋','🏔️','🔭','🎵','🌿','🦁','🧊','💎','🌋','🐋','🧲','🌞','🐍','🏺','🎯'];
const CHANNELS = ['WikiStar','KnowledgeHub','DocuMaster','InfoPrime','LearnTV','SciChannel','HistoVid','GéoFlux','CultureMax','PhiloStream','SavoirTV','NaturePrime','TechWiki','ArtFlow','SportDoc'];

const CAT_MAP = {
  Science:     ['Trou noir','Photosynthèse','ADN','Théorie de l\'évolution','Thermodynamique','Quantum','Atome','Lumière','Gravitation','Biosphère','Lithosphère','Plasma','Carbone'],
  Histoire:    ['Révolution française','Napoléon Bonaparte','Deuxième Guerre mondiale','République romaine','Aztèques','Shoah','Égypte antique','Renaissance italienne','Révolution industrielle','Chine médiévale','Préhistoire','Guerre froide'],
  Géographie:  ['Tour Eiffel','Amazonie','Everest','Océanie','Méditerranée','Atlantique','Fjord','Volcan','Himalaya','Sahara','Arctique'],
  Arts:        ['Impressionnisme','Jazz','Baroque','Alphabet','Blues','Cinéma muet','Architecture gothique'],
  Technologie: ['Intelligence artificielle','Internet','Informatique quantique','Blockchain','Robotique','Énergie solaire'],
  Sport:       ['Football','Jeux olympiques','Formule 1','Cyclisme','Natation','Tennis','Basketball'],
  Politique:   ['Démocratie','République','Socialisme','Libéralisme','Fédéralisme','Union européenne'],
  Nature:      ['Amazonie','Plancton','Baleines','Coraux','Forêt tropicale','Migration des oiseaux','Océan Pacifique'],
  Philosophie: ['Philosophie stoïcienne','Existentialisme','Épicurisme','Rationalisme','Empirisme','Éthique'],
};

// ── CACHE / STORAGE ────────────────────────────────────
const STORAGE_KEY   = 'wikihub_v2';
const IMG_CACHE_KEY = 'wikihub_imgcache_v1';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { history: {}, liked: [] }; }
  catch { return { history: {}, liked: [] }; }
}
function saveCache(c) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

function loadImgCache() {
  try { return JSON.parse(localStorage.getItem(IMG_CACHE_KEY)) || {}; }
  catch { return {}; }
}
function saveImgCache(c) {
  try { localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(c)); } catch {}
}

let cache    = loadCache();
let imgCache = loadImgCache();

function recordView(title, cat) {
  if (!cache.history[title]) cache.history[title] = { count: 0, cat, lastSeen: null };
  cache.history[title].count++;
  cache.history[title].lastSeen = Date.now();
  saveCache(cache);
}
function getWatchCount(title) { return cache.history[title]?.count || 0; }

function getFavoriteCats() {
  const counts = {};
  Object.values(cache.history).forEach(({ cat }) => {
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([c]) => c);
}

// ── IMAGE FETCH ─────────────────────────────────────────
const MIN_IMG_W = 200;

async function fetchThumb(title) {
  if (title in imgCache) return imgCache[title];
  let url = null;

  // 1. Wikipedia FR pageimages
  try {
    const api = `https://fr.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=600&format=json&origin=*`;
    const res  = await fetch(api);
    const data = await res.json();
    const page = Object.values(data.query.pages)[0];
    const src  = page?.thumbnail?.source;
    const w    = page?.thumbnail?.width ?? 0;
    if (src && w >= MIN_IMG_W) url = src;
  } catch {}

  // 2. Wikipedia REST API summary → originalimage
  if (!url) {
    try {
      for (const lang of ['fr', 'en']) {
        const api = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g,'_'))}`;
        const res  = await fetch(api);
        if (!res.ok) continue;
        const data = await res.json();
        const img = data.originalimage || data.thumbnail;
        if (img?.source && (img.width ?? 0) >= MIN_IMG_W) { url = img.source; break; }
      }
    } catch {}
  }

  // 3. Wikimedia Commons search
  if (!url) {
    try {
      const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(title)}&gsrlimit=8&prop=imageinfo&iiprop=url|size&iiurlwidth=600&format=json&origin=*`;
      const res  = await fetch(api);
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      const candidates = pages
        .map(p => p.imageinfo?.[0])
        .filter(ii => ii && ii.thumbwidth >= MIN_IMG_W && !ii.url.endsWith('.svg'))
        .sort((a,b) => (b.thumbwidth * b.thumbheight) - (a.thumbwidth * a.thumbheight));
      if (candidates.length) url = candidates[0].thumburl || candidates[0].url;
    } catch {}
  }

  // 4. Openverse
  if (!url) {
    try {
      const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(title)}&license_type=commercial,modification&page_size=5&mature=false`;
      const res  = await fetch(api, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const hit = (data.results || []).find(r => r.url && (r.width ?? 999) >= MIN_IMG_W);
        if (hit) url = hit.url;
      }
    } catch {}
  }

  imgCache[title] = url;
  saveImgCache(imgCache);
  return url;
}

async function injectThumb(title, pal, emoji) {
  const url = await fetchThumb(title);
  const encoded = encodeURIComponent(title);
  document.querySelectorAll(`[data-id="${encoded}"] .thumb-bg`).forEach(el => {
    if (url) {
      el.style.backgroundImage   = `url(${url})`;
      el.style.backgroundSize    = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.fontSize = '0';
    }
  });
}

function lazyLoadThumbs(cards) {
  cards.forEach(c => {
    if (c.id in imgCache) {
      if (imgCache[c.id]) injectThumb(c.id, c.pal, c.emoji);
      return;
    }
    setTimeout(() => injectThumb(c.id, c.pal, c.emoji), 0);
  });
}

// ── UTILITIES ──────────────────────────────────────────
function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function fmtDuration(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
function fmtViews(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M vues';
  if (n >= 1e3) return Math.round(n/1e3) + 'K vues';
  return n + ' vues';
}
const AGES = ['Il y a 2h','Il y a 6h','Il y a 1 jour','Il y a 3 jours','Il y a 1 semaine','Il y a 2 semaines','Il y a 1 mois'];
function randomAge() { return AGES[randomInt(0, AGES.length-1)]; }

let _paletteIdx = 0;
function makeCard(title, cat, opts = {}) {
  const idx = _paletteIdx++;
  return {
    id:        title,
    title,
    cat:       cat || Object.keys(CAT_MAP)[idx % Object.keys(CAT_MAP).length],
    emoji:     EMOJIS[idx % EMOJIS.length],
    pal:       PALETTES[idx % PALETTES.length],
    dur:       randomInt(4*60, 48*60),
    views:     opts.views     ?? randomInt(1200, 2800000),
    channel:   CHANNELS[idx % CHANNELS.length],
    likes:     randomInt(200, 95000),
    dislikes:  randomInt(10, 5000),
    ago:       opts.ago       ?? randomAge(),
    rank:      opts.rank      ?? null,
    realViews: opts.realViews ?? null,
  };
}

// ── BUILD INITIAL POOL ─────────────────────────────────
let allCards = [];
function buildPool() {
  _paletteIdx = 0;
  const cards = [];
  Object.entries(CAT_MAP).forEach(([cat, topics]) => {
    topics.forEach(t => cards.push(makeCard(t, cat)));
  });
  return cards;
}

// ── RECOMMENDATIONS ────────────────────────────────────
function getRecommended(excludeId = null) {
  const favCats = getFavoriteCats();
  if (!favCats.length) return allCards.slice(0, 20);
  return allCards
    .filter(c => favCats.includes(c.cat) && c.id !== excludeId)
    .filter(c => !cache.history[c.id] || cache.history[c.id].count < 2)
    .sort((a,b) => favCats.indexOf(a.cat) - favCats.indexOf(b.cat))
    .slice(0, 20);
}

function getHistory() {
  return Object.entries(cache.history)
    .sort((a,b) => b[1].lastSeen - a[1].lastSeen)
    .slice(0, 8)
    .map(([title, data]) => allCards.find(c => c.id === title) || makeCard(title, data.cat));
}

// ── TRENDING FROM WIKIPEDIA ────────────────────────────
async function fetchTrending() {
  try {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,'0');
    const d = String(now.getDate()).padStart(2,'0');
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/fr.wikipedia/all-access/${y}/${m}/${d}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const articles = data.items[0].articles
      .filter(a => !a.article.startsWith('Spécial') && !a.article.startsWith('Aide:') && !a.article.includes('Accueil_principal'))
      .slice(0, 20);
    return articles.map((a, i) => {
      const title = decodeURIComponent(a.article.replace(/_/g,' '));
      return makeCard(title, guessCat(title), { views: a.views, realViews: a.views, rank: i+1, ago: 'Aujourd\'hui' });
    });
  } catch(e) {
    console.warn('Trending fetch failed:', e);
    return null;
  }
}

function guessCat(title) {
  const t = title.toLowerCase();
  if (/guerre|révolution|empire|roi|napoléon|histoire|siècle|bataille/.test(t)) return 'Histoire';
  if (/planète|étoile|galaxie|chimie|physique|biologie|science|quantum|atome|adn|évolution/.test(t)) return 'Science';
  if (/france|ville|pays|continent|mer|océan|montagne|fleuve|île/.test(t)) return 'Géographie';
  if (/art|peinture|musique|cinéma|film|sculpture|littérature|poésie/.test(t)) return 'Arts';
  if (/informatique|technologie|internet|logiciel|intelligence|numérique/.test(t)) return 'Technologie';
  if (/sport|foot|tennis|basket|olymp|coupe|champion/.test(t)) return 'Sport';
  if (/politique|élection|parti|président|ministre|gouvernement/.test(t)) return 'Politique';
  if (/animal|plante|forêt|nature|écologie|espèce|faune/.test(t)) return 'Nature';
  if (/philosophie|éthique|morale|raison|existence/.test(t)) return 'Philosophie';
  return Object.keys(CAT_MAP)[randomInt(0, Object.keys(CAT_MAP).length-1)];
}

// ── RENDER CARD ────────────────────────────────────────
function cardHTML(c, compact = false) {
  const watchCount  = getWatchCount(c.id);
  const watchedBadge = watchCount > 0 ? `<div class="watched-overlay">VU${watchCount > 1 ? ' '+watchCount+'x' : ''}</div>` : '';
  const rankBadge   = c.rank ? `<div class="thumb-rank">#${c.rank}</div>` : '';
  const viewsLabel  = c.realViews
    ? `<span class="card-views-real">👁 ${fmtViews(c.realViews)}</span>`
    : `<span>${fmtViews(c.views)}</span>`;

  const cachedImg = imgCache[c.id];
  const thumbStyle = cachedImg
    ? `background:url(${cachedImg}) center/cover; font-size:0`
    : `background:linear-gradient(135deg,${c.pal[0]},${c.pal[1]})`;

  if (compact) {
    // Layout horizontal pour la sidebar recommandés
    return `
    <div class="video-card-compact" data-id="${encodeURIComponent(c.id)}" onclick="openVideo('${encodeURIComponent(c.id)}')">
      <div class="compact-thumb">
        <div class="thumb-bg" style="${thumbStyle}">${cachedImg ? '' : c.emoji}</div>
        <div class="thumb-duration">${fmtDuration(c.dur)}</div>
      </div>
      <div class="compact-info">
        <div class="compact-title">${c.title}</div>
        <div class="compact-channel">${c.channel}</div>
        <div class="compact-meta">${viewsLabel} · ${c.ago}</div>
      </div>
    </div>`;
  }

  return `
  <div class="video-card" data-id="${encodeURIComponent(c.id)}" onclick="openVideo('${encodeURIComponent(c.id)}')">
    ${watchedBadge}
    <div class="thumbnail">
      <div class="thumb-bg" style="${thumbStyle}">${cachedImg ? '' : c.emoji}</div>
      ${rankBadge}
      <div class="thumb-duration">${fmtDuration(c.dur)}</div>
      <div class="thumb-hd">WIKI</div>
      <div class="thumb-play"><div class="play-icon">▶</div></div>
    </div>
    <div class="card-info">
      <div class="card-channel">${c.channel}</div>
      <div class="card-title">${c.title}</div>
      <div class="card-meta">
        ${viewsLabel}
        <span>·</span>
        <span>${c.ago}</span>
        <span>·</span>
        <span>${c.cat}</span>
      </div>
    </div>
  </div>`;
}

function renderGrid(cards, containerId = 'videoGrid') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!cards.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🤔</div><p>Aucun article trouvé</p></div>`;
    return;
  }
  el.innerHTML = cards.map(c => cardHTML(c, false)).join('');
  lazyLoadThumbs(cards.filter(c => !(c.id in imgCache)));
}

function renderCompactList(cards, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = cards.map(c => cardHTML(c, true)).join('');
  lazyLoadThumbs(cards.filter(c => !(c.id in imgCache)));
}

// ── PAGE STATE ─────────────────────────────────────────
let currentView = 'home';
let currentCat  = '';
let trendingCards  = [];
let searchResults  = [];

// ── VIEW : HOME ────────────────────────────────────────
function showPageHome() {
  document.getElementById('homePage').style.display  = 'block';
  document.getElementById('videoPage').style.display = 'none';
}
function showPageVideo() {
  document.getElementById('homePage').style.display  = 'none';
  document.getElementById('videoPage').style.display = 'block';
  window.scrollTo(0, 0);
}

async function showHome() {
  currentView = 'home';
  showPageHome();
  document.getElementById('sectionTitle').textContent = 'Articles populaires';
  updateSidebarActive('nav-home');

  const reco = getRecommended();
  const recoSection = document.getElementById('recoSection');
  if (reco.length > 0 && getFavoriteCats().length > 0) {
    recoSection.style.display = 'block';
    renderGrid(reco, 'recoGrid');
  } else {
    recoSection.style.display = 'none';
  }

  renderGrid(allCards.slice(0, 20), 'videoGrid');
  document.getElementById('loadMoreBtn').style.display = 'block';
}

async function showTrending() {
  currentView = 'trending';
  showPageHome();
  document.getElementById('sectionTitle').textContent = '🔥 Tendances Wikipedia';
  updateSidebarActive('nav-trending');
  document.getElementById('recoSection').style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';

  const grid = document.getElementById('videoGrid');
  grid.innerHTML = `<div class="loading-text" style="grid-column:1/-1"><span class="spinner"></span>Chargement des tendances Wikipedia...</div>`;

  if (!trendingCards.length) {
    trendingCards = await fetchTrending();
    if (!trendingCards) {
      trendingCards = allCards.slice(0, 20).map((c,i) => ({...c, rank: i+1}));
      showToast('⚠️ API Wikipedia indisponible – fallback local');
    }
  }
  renderGrid(trendingCards, 'videoGrid');
}

function showHistory() {
  currentView = 'history';
  showPageHome();
  document.getElementById('sectionTitle').textContent = '📺 Historique';
  updateSidebarActive('nav-history');
  document.getElementById('recoSection').style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';

  const hist = getHistory();
  if (!hist.length) {
    document.getElementById('videoGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">👀</div><p>Vous n'avez pas encore regardé d'articles.</p></div>`;
    return;
  }
  renderGrid(hist, 'videoGrid');
}

function showReco() {
  currentView = 'reco';
  showPageHome();
  document.getElementById('sectionTitle').textContent = '⭐ Recommandés pour vous';
  updateSidebarActive('nav-reco');
  document.getElementById('recoSection').style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';

  const reco = getRecommended();
  if (!reco.length) {
    document.getElementById('videoGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🎯</div><p>Regardez quelques articles pour obtenir des recommandations !</p></div>`;
    return;
  }
  renderGrid(reco, 'videoGrid');
}

function filterCat(btn, cat) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (!cat) { showHome(); return; }

  currentView = 'cat';
  currentCat  = cat;
  showPageHome();
  document.getElementById('sectionTitle').textContent = cat;
  document.getElementById('recoSection').style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'block';
  renderGrid(allCards.filter(c => c.cat === cat), 'videoGrid');
}

function sideNav(el, view) {
  if (view === 'trending') showTrending();
  else if (view === 'history') showHistory();
  else if (view === 'reco') showReco();
  else showHome();
}

function updateSidebarActive(id) {
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

let loadOffset = 20;
function loadMore() {
  const source = currentCat ? allCards.filter(c => c.cat === currentCat) : allCards;
  const next = source.slice(loadOffset, loadOffset + 12);
  if (!next.length) { showToast('Plus d\'articles disponibles'); return; }
  const grid = document.getElementById('videoGrid');
  grid.innerHTML += next.map(c => cardHTML(c, false)).join('');
  lazyLoadThumbs(next.filter(c => !(c.id in imgCache)));
  loadOffset += 12;
}

// ── SEARCH ─────────────────────────────────────────────
async function searchWiki() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  currentView = 'search';
  showPageHome();

  document.getElementById('sectionTitle').textContent = `Résultats pour "${q}"`;
  document.getElementById('recoSection').style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';

  const grid = document.getElementById('videoGrid');
  grid.innerHTML = `<div class="loading-text" style="grid-column:1/-1"><span class="spinner"></span>Recherche...</div>`;

  try {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=20&format=json&origin=*`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.query?.search?.length) throw new Error('empty');
    _paletteIdx = 50;
    searchResults = data.query.search.map(r => makeCard(r.title, guessCat(r.title)));
    renderGrid(searchResults, 'videoGrid');
  } catch {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">😕</div><p>Aucun résultat pour "${q}"</p></div>`;
  }
}

// ── VIDEO PAGE ─────────────────────────────────────────
let currentCard    = null;
let playerInterval = null;
let playerSeconds  = 0;
let playerDuration = 0;
let isPlaying      = true;

function getCardById(id) {
  return allCards.find(c => c.id === id)
    || trendingCards.find(c => c.id === id)
    || searchResults.find(c => c.id === id)
    || null;
}

async function openVideo(encodedId) {
  const id = decodeURIComponent(encodedId);
  let card = getCardById(id);
  if (!card) {
    const histData = cache.history[id];
    card = makeCard(id, histData?.cat || null);
  }

  currentCard = card;
  recordView(card.id, card.cat);
  updateWatchBadges(card.id);

  showPageVideo();

  // ── Player thumb ──
  const playerThumb = document.getElementById('playerThumb');
  const cachedImg = imgCache[card.id];

  function applyThumbImg(url) {
    playerThumb.style.cssText = `width:100%;height:100%;background:url(${url}) center/cover;`;
    playerThumb.innerHTML = '';
  }
  function applyThumbGradient() {
    playerThumb.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:80px;background:linear-gradient(135deg,${card.pal[0]},${card.pal[1]})`;
    playerThumb.innerHTML = `<span>${card.emoji}</span>`;
  }

  if (cachedImg) {
    applyThumbImg(cachedImg);
  } else {
    applyThumbGradient();
    fetchThumb(card.id).then(url => {
      if (url && currentCard?.id === card.id) applyThumbImg(url);
    });
  }

  // ── Infos ──
  document.getElementById('vpChannel').textContent = card.channel;
  document.getElementById('vpTitle').textContent   = card.title;
  document.getElementById('vpMeta').innerHTML = `
    <span>👁 ${fmtViews(card.realViews ?? card.views)}</span>
    <span>⏱ ${fmtDuration(card.dur)}</span>
    <span>🗂 ${card.cat}</span>
    <span>${card.ago}</span>
  `;
  document.getElementById('vpLikeCount').textContent    = card.likes.toLocaleString();
  document.getElementById('vpDislikeCount').textContent = card.dislikes.toLocaleString();
  document.getElementById('vpLikeBtn').classList.remove('liked');

  const wc = getWatchCount(card.id);
  document.getElementById('vpWatchBadge').textContent = wc > 1 ? `Vu ${wc} fois` : 'Premier visionnage';
  document.getElementById('vpContent').innerHTML = `<div class="loading-text"><span class="spinner"></span>Chargement de l'article...</div>`;

  // ── Recommandés sidebar ──
  const related = getRecommended(card.id).slice(0, 20);
  renderCompactList(related, 'vpRelated');

  startPlayer(card.dur);
  await fetchWikiContent(card.title);
}

function updateWatchBadges(id) {
  document.querySelectorAll(`[data-id="${encodeURIComponent(id)}"]`).forEach(el => {
    const wc = getWatchCount(id);
    let badge = el.querySelector('.watched-overlay');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'watched-overlay';
      el.prepend(badge);
    }
    badge.textContent = wc > 1 ? `VU ${wc}x` : 'VU';
  });
}

async function fetchWikiContent(title) {
  try {
    const url  = `https://fr.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&exchars=3000&format=json&origin=*`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) throw new Error('No pages');
    const page = Object.values(pages)[0];

    if (page.missing !== undefined) {
      document.getElementById('vpContent').innerHTML = `<div class="empty-state"><div class="big">📭</div><p>Article introuvable sur Wikipédia FR</p></div>`;
      return;
    }

    const extract = page.extract || '<p>Contenu non disponible.</p>';
    document.getElementById('vpContent').innerHTML = `
      <div class="modal-extract">${extract}</div>
      <div class="tags-row">
        <span class="tag">${currentCard.cat}</span>
        <span class="tag">Encyclopédie</span>
        <span class="tag">Connaissance</span>
        <span class="tag">Wikipédia</span>
      </div>
      <br>
      <button class="wiki-link" onclick="openWikiDirect()">🌐 Lire l'article complet sur Wikipédia</button>
    `;
  } catch(e) {
    document.getElementById('vpContent').innerHTML = `
      <div class="empty-state"><div class="big">😕</div>
      <p>Impossible de charger l'article.<br><small>${e.message}</small></p>
      <br><button class="wiki-link" onclick="openWikiDirect()">🌐 Ouvrir sur Wikipédia</button></div>`;
  }
}

function openWikiDirect() {
  if (!currentCard) return;
  window.open(`https://fr.wikipedia.org/wiki/${encodeURIComponent(currentCard.title)}`, '_blank');
}

function goBack() {
  stopPlayer();
  showPageHome();
}

// ── PLAYER ─────────────────────────────────────────────
function startPlayer(dur) {
  stopPlayer();
  playerDuration = dur;
  playerSeconds  = 0;
  isPlaying      = true;
  document.getElementById('playPauseBtn').textContent = '⏸';
  updatePlayerUI();
  playerInterval = setInterval(() => {
    if (!isPlaying) return;
    playerSeconds = Math.min(playerSeconds + 1, playerDuration);
    updatePlayerUI();
    if (playerSeconds >= playerDuration) stopPlayer();
  }, 1000);
}
function stopPlayer() { clearInterval(playerInterval); playerInterval = null; }
function togglePlay() {
  isPlaying = !isPlaying;
  document.getElementById('playPauseBtn').textContent = isPlaying ? '⏸' : '▶';
}
function seekProgress(e) {
  playerSeconds = Math.floor((e.offsetX / e.currentTarget.offsetWidth) * playerDuration);
  updatePlayerUI();
}
function updatePlayerUI() {
  const pct = playerDuration ? (playerSeconds / playerDuration * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('timeDisplay').textContent  = `${fmtDuration(playerSeconds)} / ${fmtDuration(playerDuration)}`;
}
function toggleLike() {
  document.getElementById('vpLikeBtn').classList.toggle('liked');
  showToast('👍 Ajouté à vos préférences');
}

// ── TOAST ──────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── INIT ───────────────────────────────────────────────
async function init() {
  allCards = buildPool();

  const histCount = Object.keys(cache.history).length;
  const histBadge = document.getElementById('histBadge');
  if (histBadge && histCount > 0) histBadge.textContent = histCount;

  await showHome();
  fetchTrending().then(cards => { if (cards) trendingCards = cards; });

  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchWiki();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('videoPage').style.display !== 'none') goBack();
  });
}

document.addEventListener('DOMContentLoaded', init);
