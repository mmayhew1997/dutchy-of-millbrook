// ===== Charm Cake Game — "Charm someone" =====
// A guided, scored build-your-own layered on top of the studio's placement engine.
(function () {
  const stage = document.getElementById('gStage');
  if (!stage) return;

  const layer = document.getElementById('gLayer');
  const scallop = document.getElementById('gScallop');

  // ---------- shared placement engine (ported from charm.js) ----------
  function scallopPath(cx, cy, R, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    const arcR = R * Math.sin(Math.PI / n);
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
    for (let i = 0; i < n; i++) {
      const p = pts[(i + 1) % n];
      d += `A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 1 ${p[0].toFixed(2)} ${p[1].toFixed(2)} `;
    }
    return d + 'Z';
  }
  scallop.setAttribute('d', scallopPath(50, 50, 33, 26));
  scallop.setAttribute('stroke', 'transparent'); // starts blank until they pick

  let selected = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stageRect = () => stage.getBoundingClientRect();
  const centerClient = (el) => { const r = stageRect(); return { x: r.left + el._x, y: r.top + el._y }; };

  function apply(el) {
    el.style.left = el._x + 'px';
    el.style.top = el._y + 'px';
    el.style.transform = `translate(-50%, -50%) rotate(${el._rot}deg)`;
    const c = el.querySelector('.cv-content');
    if (el._type === 'image') { const im = c.querySelector('img'); if (im) im.style.width = el._size + 'px'; }
    else { c.style.fontSize = el._size + 'px'; }
  }
  function select(el) { if (selected) selected.classList.remove('sel'); selected = el; if (el) el.classList.add('sel'); }

  function addItem(content, type, label) {
    type = type || 'emoji';
    const el = document.createElement('div');
    el.className = 'cv-item' + (type === 'text' ? ' text' : type === 'image' ? ' img' : '');
    el.innerHTML =
      `<span class="cv-content">${content}</span>` +
      `<button class="cv-h cv-del" type="button" aria-label="Delete">×</button>` +
      `<span class="cv-h cv-rot" aria-label="Rotate"></span>` +
      `<span class="cv-h cv-size" aria-label="Resize"></span>`;
    const r = stageRect();
    el._type = type;
    el._label = label || null;
    // scatter new charms a touch so stacking is obvious
    const jitter = () => (Math.abs((Date.now() >> 4) % 90) - 45);
    el._x = r.width / 2 + (type === 'text' ? 0 : jitter());
    el._y = r.height / 2 + (type === 'text' ? 0 : jitter());
    el._rot = 0;
    el._size = type === 'text' ? 30 : type === 'image' ? 90 : 46;
    layer.appendChild(el);
    apply(el);
    select(el);
    wire(el);
    updateMeter();
    return el;
  }
  function addImage(src, label) {
    addItem(`<img src="${String(src).replace(/"/g, '&quot;')}" draggable="false" alt="charm" />`, 'image', label);
  }

  function wire(el) {
    el.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('cv-h')) return;
      e.preventDefault(); select(el);
      const sx = e.clientX, sy = e.clientY, ox = el._x, oy = el._y, r = stageRect();
      const mv = (ev) => { el._x = clamp(ox + (ev.clientX - sx), 0, r.width); el._y = clamp(oy + (ev.clientY - sy), 0, r.height); apply(el); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    el.querySelector('.cv-rot').addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); select(el);
      const c = centerClient(el);
      const startA = Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI, oR = el._rot;
      const mv = (ev) => { const a = Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI; el._rot = oR + (a - startA); apply(el); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    el.querySelector('.cv-size').addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); select(el);
      const c = centerClient(el), d0 = Math.hypot(e.clientX - c.x, e.clientY - c.y) || 1, s0 = el._size;
      const mv = (ev) => { const d = Math.hypot(ev.clientX - c.x, ev.clientY - c.y); el._size = clamp(s0 * d / d0, 16, 240); apply(el); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    el.querySelector('.cv-del').addEventListener('click', (e) => {
      e.stopPropagation(); if (selected === el) selected = null; el.remove(); updateMeter();
    });
  }
  stage.addEventListener('pointerdown', (e) => {
    if (e.target === stage || e.target === layer || e.target.id === 'gCake' || e.target.tagName === 'svg' || e.target === scallop) select(null);
  });

  // ---------- charm catalog, grouped for guided picking ----------
  const CATS = {
    'Sports': ['🎾','⛳','🏈','⚽','🏀','⚾','🎿','🏊','🚴','🧘','🎱','🏓'],
    'Pets': ['🐶','🐱','🐰','🐴','🐩','🦮','🐦','🐠','🐢','🐝','🦋','🐻'],
    'Flowers': ['🌸','🌹','🌷','🌻','🌼','🌿','🍀','🪻','🌵','🌳'],
    'Sweets': ['🎂','🧁','🍰','🍓','🍒','🍋','🍑','🍦','🍪','🥐','☕','🥂'],
    'Hobbies': ['🎵','🎸','🎹','🎤','🎨','📚','✏️','🎭','🎬','📷','♟️','🧶'],
    'Places': ['✈️','🚗','⛵','🏖️','🗽','🏰','🗺️','🧭','🏡','🌍'],
    'Milestones': ['👑','💍','🎀','🎁','🍼','👶','🎓','💼','⚓','🕯️','❤️','⭐'],
  };
  const KEYWORDS = {
    '🎾':'tennis','⛳':'golf','🏈':'football','⚽':'soccer','🏀':'basketball','⚾':'baseball','🎿':'ski','🏊':'swim','🚴':'bike','🧘':'yoga','🎱':'pool','🏓':'pingpong',
    '🐶':'dog','🐱':'cat','🐰':'bunny','🐴':'horse','🐩':'poodle','🦮':'dog','🐦':'bird','🐠':'fish','🐢':'turtle','🐝':'bee','🦋':'butterfly','🐻':'bear',
    '🌸':'blossom','🌹':'rose','🌷':'tulip','🌻':'sunflower','🌼':'daisy','🌿':'leaf','🍀':'clover','🪻':'flower','🌵':'cactus','🌳':'tree',
    '🎂':'cake','🧁':'cupcake','🍰':'cake','🍓':'strawberry','🍒':'cherry','🍋':'lemon','🍑':'peach','🍦':'icecream','🍪':'cookie','🥐':'croissant','☕':'coffee','🥂':'champagne',
    '🎵':'music','🎸':'guitar','🎹':'piano','🎤':'sing','🎨':'art','📚':'books','✏️':'write','🎭':'theater','🎬':'movie','📷':'camera','♟️':'chess','🧶':'knit',
    '✈️':'travel','🚗':'car','⛵':'sailing','🏖️':'beach','🗽':'nyc','🏰':'castle','🗺️':'map','🧭':'compass','🏡':'home','🌍':'world',
    '👑':'crown','💍':'ring','🎀':'bow','🎁':'gift','🍼':'baby','👶':'baby','🎓':'graduate','💼':'work','⚓':'anchor','🕯️':'candle','❤️':'love','⭐':'star',
  };
  const charmLabel = (c) => KEYWORDS[c] || 'charm';

  // ---------- game state ----------
  const state = { who: 'them', step: 0 };
  const STEPS = ['border', 'charms', 'words'];

  const $ = (id) => document.getElementById(id);
  const toast = (() => {
    const t = $('gToast'); let hideT;
    return (msg) => { t.textContent = msg; t.classList.add('show'); clearTimeout(hideT); hideT = setTimeout(() => t.classList.remove('show'), 1600); };
  })();

  function countCharms() { return layer.querySelectorAll('.cv-item:not(.text)').length; }
  function countTexts() { return layer.querySelectorAll('.cv-item.text').length; }
  function hasBorder() { const s = scallop.getAttribute('stroke'); return s && s !== 'transparent' && s !== 'none'; }

  // Charm meter = softly weighted progress toward a "full, giftable" cake.
  function meterPct() {
    let p = 0;
    if (hasBorder()) p += 20;
    p += Math.min(countCharms(), 5) * 12; // up to 60
    if (countTexts()) p += 20;
    return Math.min(p, 100);
  }
  function updateMeter() {
    const p = meterPct();
    $('gMeterFill').style.width = p + '%';
    $('gMeterPct').textContent = p + '%';
  }

  // ---------- step UI ----------
  function renderStep() {
    STEPS.forEach((name, i) => {
      document.querySelector(`.g-stepwrap[data-step="${name}"]`).classList.toggle('is-active', i === state.step);
      const chip = document.querySelector(`.g-steps .s[data-for="${name}"]`);
      chip.classList.toggle('is-active', i === state.step);
      chip.classList.toggle('is-done', i < state.step);
    });
    $('gBack').textContent = state.step === 0 ? '← Studio' : '← Back';
    $('gNext').textContent = state.step === STEPS.length - 1 ? 'Reveal 🎉' : 'Next →';
  }
  function goStep(i) {
    state.step = clamp(i, 0, STEPS.length - 1);
    renderStep();
  }

  $('gNext').addEventListener('click', () => {
    if (state.step === 0 && !hasBorder()) { toast('Pick a border color first 🎨'); return; }
    if (state.step === 1 && countCharms() === 0) { toast('Add at least one charm ✨'); return; }
    if (state.step === STEPS.length - 1) { reveal(); return; }
    goStep(state.step + 1);
  });
  $('gBack').addEventListener('click', () => {
    if (state.step === 0) { window.location.href = 'charm-visualizer.html'; return; }
    goStep(state.step - 1);
  });

  // ---------- STEP 1: border swatches ----------
  const SWATCHES = ['#E2789A','#C0392B','#E07856','#E08A2B','#C9A227','#4F7A3F','#7FB069','#2C8C8C','#7FA8D0','#21345B','#7A4FA0','#6E4A2F','#2B2018'];
  const swWrap = $('gSwatches');
  SWATCHES.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'g-sw'; b.style.setProperty('--sw', c); b.setAttribute('aria-label', c);
    b.addEventListener('click', () => {
      scallop.setAttribute('stroke', c);
      swWrap.querySelectorAll('.g-sw').forEach((s) => s.classList.remove('is-active'));
      b.classList.add('is-active');
      updateMeter();
      toast('Pretty border 💗');
    });
    swWrap.appendChild(b);
  });

  // ---------- STEP 2: charm tray + categories + search ----------
  const cats = $('gCats'), tray = $('gTray');
  function renderTray(items, asImages) {
    tray.innerHTML = '';
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'g-charm';
      if (asImages) {
        const img = document.createElement('img'); img.src = it.thumb; img.alt = it.label; img.loading = 'lazy'; b.appendChild(img);
        b.addEventListener('click', () => { addImage(it.full, it.label); reactCharm(it.label); });
      } else {
        b.textContent = it;
        b.addEventListener('click', () => { addItem(it, 'emoji', charmLabel(it)); reactCharm(charmLabel(it)); });
      }
      tray.appendChild(b);
    });
  }
  const REACTIONS = ['Love it 💕','Ooh, nice 🌟','Great pick ✨','So them 🥰','Charming 💗'];
  let rIdx = 0;
  function reactCharm(label) { toast(`${REACTIONS[rIdx++ % REACTIONS.length]} (${label})`); }

  const catNames = Object.keys(CATS);
  catNames.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'g-cat' + (i === 0 ? ' is-active' : ''); b.textContent = name;
    b.addEventListener('click', () => {
      cats.querySelectorAll('.g-cat').forEach((c) => c.classList.remove('is-active'));
      b.classList.add('is-active');
      renderTray(CATS[name], false);
    });
    cats.appendChild(b);
  });
  renderTray(CATS[catNames[0]], false);

  // Search falls back to the free Iconify icon library (same source the studio uses).
  let searchT;
  $('gSearch').addEventListener('input', () => {
    clearTimeout(searchT);
    const q = $('gSearch').value.trim().toLowerCase();
    if (!q) { renderTray(CATS[document.querySelector('.g-cat.is-active').textContent] || CATS[catNames[0]], false); return; }
    // instant emoji matches
    const emojiHits = Object.entries(KEYWORDS).filter(([, kw]) => kw.includes(q)).map(([c]) => c);
    if (emojiHits.length) renderTray(emojiHits, false);
    searchT = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=42`);
        const data = await res.json();
        const icons = (data.icons || []).map((nm) => {
          const i = nm.indexOf(':'), prefix = nm.slice(0, i), icon = nm.slice(i + 1);
          return { thumb: `https://api.iconify.design/${prefix}/${icon}.svg?height=36`, full: `https://api.iconify.design/${prefix}/${icon}.svg?height=220`, label: icon.replace(/[-_]/g, ' ') };
        });
        if (icons.length) renderTray(icons, true);
        else if (!emojiHits.length) tray.innerHTML = '<p class="cv-searching" style="grid-column:1/-1;color:var(--cream-dim)">No matches — try another word.</p>';
      } catch (e) { /* keep emoji hits */ }
    }, 300);
  });

  // ---------- STEP 3: inscription ----------
  const chipWrap = $('gChips');
  function refreshChips() {
    const who = state.who && state.who !== 'them' ? state.who : '';
    const ideas = [who, `Happy Birthday${who ? ', ' + who : ''}`, 'With love', 'Congrats!', 'xoxo'].filter(Boolean);
    chipWrap.innerHTML = '';
    [...new Set(ideas)].forEach((txt) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'g-chip'; b.textContent = txt;
      b.addEventListener('click', () => { $('gText').value = txt; });
      chipWrap.appendChild(b);
    });
  }
  function addInscription() {
    const t = $('gText').value.trim(); if (!t) { toast('Type something first ✍️'); return; }
    const el = addItem(t.replace(/</g, '&lt;'), 'text');
    const c = el.querySelector('.cv-content');
    const border = hasBorder() ? scallop.getAttribute('stroke') : '#E2789A';
    el._color = border; c.style.color = border;
    const font = $('gFont').value; el._font = font; c.style.fontFamily = font;
    $('gText').value = '';
    toast('Sweet 💌');
  }
  $('gAddText').addEventListener('click', addInscription);
  $('gText').addEventListener('keydown', (e) => { if (e.key === 'Enter') addInscription(); });

  // ---------- scoring ----------
  function score() {
    const charms = countCharms(), texts = countTexts();
    let stars = 0;
    if (hasBorder()) stars++;
    if (charms >= 1) stars++;
    if (charms >= 3) stars++;
    if (texts >= 1) stars++;
    if (charms >= 5 || (charms >= 3 && texts >= 1)) stars++;
    stars = clamp(stars, 1, 5);
    const notes = { 1: 'A sweet start', 2: 'Coming together', 3: 'Charming!', 4: 'Beautifully done', 5: 'Master charmer 👑' };
    return { stars, note: notes[stars] };
  }

  // ---------- confetti ----------
  function confetti() {
    const box = $('gConfetti'); box.style.display = 'block'; box.innerHTML = '';
    const pieces = ['🎉','✨','💗','🎂','⭐','🎀','🌸'];
    for (let i = 0; i < 44; i++) {
      const s = document.createElement('span');
      s.textContent = pieces[i % pieces.length];
      s.style.left = ((i * 2.3 + (i * 37 % 11)) % 100) + 'vw';
      s.style.animationDuration = (2.6 + (i % 5) * 0.5) + 's';
      s.style.animationDelay = ((i % 8) * 0.12) + 's';
      s.style.fontSize = (16 + (i % 4) * 6) + 'px';
      box.appendChild(s);
    }
    setTimeout(() => { box.style.display = 'none'; box.innerHTML = ''; }, 5200);
  }

  // ---------- carry design into the real order form ----------
  function saveDesign() {
    const texts = [...layer.querySelectorAll('.cv-item.text .cv-content')].map((el) => el.textContent.trim()).filter(Boolean);
    const charms = [...layer.querySelectorAll('.cv-item:not(.text)')].map((el) => el._label).filter(Boolean);
    try {
      localStorage.setItem('dutchyDesign', JSON.stringify({
        inscription: texts.join(' · '),
        charms,
        for: state.who && state.who !== 'them' ? state.who : ''
      }));
    } catch (e) { /* ignore */ }
  }

  // ---------- reveal ----------
  function reveal() {
    select(null);
    const { stars, note } = score();
    const who = state.who && state.who !== 'them' ? state.who : 'them';
    $('gRevealTitle').textContent = who === 'them' ? 'You made a charm cake!' : `You charmed ${who}!`;
    $('gRevealStars').textContent = '★★★★★☆☆☆☆☆'.slice(5 - stars, 10 - stars);
    $('gRevealNote').textContent = note;
    saveDesign();
    const snapInto = (dataUrl) => {
      $('gRevealCake').innerHTML = dataUrl ? `<img src="${dataUrl}" alt="your charm cake" />` : '';
      $('gRevealOverlay').classList.add('is-open');
      confetti();
    };
    if (typeof html2canvas === 'function') {
      html2canvas(stage, { useCORS: true, backgroundColor: null, scale: 2 })
        .then((canvas) => { window._gCakeCanvas = canvas; snapInto(canvas.toDataURL('image/png')); })
        .catch(() => snapInto(null));
    } else { snapInto(null); }
  }

  // share / download
  $('gShareBtn').addEventListener('click', async () => {
    const who = state.who && state.who !== 'them' ? state.who : 'someone';
    const text = `I just charmed ${who} 🎂 at The Dutchy of Millbrook — build your own charm cake!`;
    const canvas = window._gCakeCanvas;
    try {
      if (canvas && navigator.canShare) {
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'my-charm-cake.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
      }
      if (navigator.share) { await navigator.share({ text, url: location.href }); return; }
    } catch (e) { /* fall through to download */ }
    // fallback: download the image
    if (canvas) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'my-charm-cake.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
      }, 'image/png');
      toast('Saved your cake image 💾');
    }
  });
  $('gOrderBtn').addEventListener('click', saveDesign);
  $('gAgainBtn').addEventListener('click', () => location.reload());

  // ---------- start ----------
  function startGame(name) {
    state.who = name || 'them';
    ['gWho1', 'gWho2'].forEach((id) => { const el = $(id); if (el) el.textContent = state.who === 'them' ? 'them' : state.who; });
    refreshChips();
    $('gStartOverlay').classList.remove('is-open');
    goStep(0);
    updateMeter();
  }
  $('gStartBtn').addEventListener('click', () => startGame($('gNameInput').value.trim()));
  $('gNameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('gStartBtn').click(); });

  renderStep();
  updateMeter();
})();
