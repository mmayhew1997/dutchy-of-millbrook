// ===== Charm Visualizer =====
(function () {
  const stage = document.getElementById('cvStage');
  if (!stage) return;

  // ── Real web image search (school logos, specific flowers, anything) ──
  // Fill these in to turn it on. Free to create:
  //   key: console.cloud.google.com → enable "Custom Search API" → create an API key
  //   cx:  programmablesearchengine.google.com → new engine, turn ON "Image search"
  //        and "Search the entire web", then copy the Search engine ID
  // (Restrict the key by website/referrer before going live, since it's visible here.)
  // Left blank on purpose: this file is in a PUBLIC repo, so no live API key lives here.
  // Empty key → charm search automatically falls back to the free Iconify icon library.
  // To re-enable Google image search, add a key that is RESTRICTED by HTTP referrer
  // (your site's domain) in the Google Cloud console, so it can't be abused if copied.
  const GOOGLE = { key: '', cx: '' };
  const layer = document.getElementById('cvLayer');
  const scallop = document.getElementById('cvScallop');

  // ---- scalloped edge path (viewBox 0..100) ----
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

  // swatches set scallop color
  // when the scalloped edge color changes, default the text color to match it too
  function syncTextColorTo(c) {
    const tc = document.getElementById('cvTextColor');
    if (tc && c && c !== 'none') tc.value = c;
  }
  document.querySelectorAll('[data-scallop]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.scallop;
      scallop.setAttribute('stroke', c === 'none' ? 'transparent' : c);
      document.querySelectorAll('.cv-swatch').forEach((s) => s.classList.remove('is-active'));
      btn.classList.add('is-active');
      syncTextColorTo(c);
    });
  });

  // ---- items (charms + text) ----
  let selected = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stageRect = () => stage.getBoundingClientRect();
  const centerClient = (el) => {
    const r = stageRect();
    return { x: r.left + el._x, y: r.top + el._y };
  };

  function apply(el) {
    el.style.left = el._x + 'px';
    el.style.top = el._y + 'px';
    el.style.transform = `translate(-50%, -50%) rotate(${el._rot}deg)`;
    const c = el.querySelector('.cv-content');
    if (el._type === 'image') {
      const im = c.querySelector('img');
      if (im) im.style.width = el._size + 'px';
    } else {
      c.style.fontSize = el._size + 'px';
    }
  }

  function select(el) {
    if (selected) selected.classList.remove('sel');
    selected = el;
    if (el) el.classList.add('sel');
  }

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
    el._x = r.width / 2;
    el._y = r.height / 2;
    el._rot = 0;
    el._size = type === 'text' ? 30 : type === 'image' ? 90 : 46;
    layer.appendChild(el);
    apply(el);
    select(el);
    wire(el);
    return el;
  }
  function addImage(src, label) {
    addItem(`<img src="${String(src).replace(/"/g, '&quot;')}" draggable="false" alt="charm" />`, 'image', label);
  }

  function wire(el) {
    const content = el.querySelector('.cv-content');
    // drag (on body, not handles)
    el.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('cv-h')) return;
      e.preventDefault();
      select(el);
      const sx = e.clientX, sy = e.clientY, ox = el._x, oy = el._y, r = stageRect();
      const mv = (ev) => {
        el._x = clamp(ox + (ev.clientX - sx), 0, r.width);
        el._y = clamp(oy + (ev.clientY - sy), 0, r.height);
        apply(el);
      };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    });
    // rotate
    el.querySelector('.cv-rot').addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); select(el);
      const c = centerClient(el);
      const startA = Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI;
      const oR = el._rot;
      const mv = (ev) => {
        const a = Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI;
        el._rot = oR + (a - startA); apply(el);
      };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    });
    // resize
    el.querySelector('.cv-size').addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); select(el);
      const c = centerClient(el);
      const d0 = Math.hypot(e.clientX - c.x, e.clientY - c.y) || 1;
      const s0 = el._size;
      const mv = (ev) => {
        const d = Math.hypot(ev.clientX - c.x, ev.clientY - c.y);
        el._size = clamp(s0 * d / d0, 16, 240); apply(el);
      };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    });
    // delete
    el.querySelector('.cv-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (selected === el) selected = null;
      el.remove();
    });
  }

  // deselect when clicking empty stage
  stage.addEventListener('pointerdown', (e) => {
    if (e.target === stage || e.target === layer || e.target.id === 'cvCake' || e.target.tagName === 'svg' || e.target === scallop) {
      select(null);
    }
  });

  // ---- text (with color) ----
  const textInput = document.getElementById('cvText');
  const textColor = document.getElementById('cvTextColor');
  const fontSelect = document.getElementById('cvFont');
  document.getElementById('cvAddText').addEventListener('click', () => {
    const t = textInput.value.trim();
    if (!t) return;
    const el = addItem(t.replace(/</g, '&lt;'), 'text');
    const c = el.querySelector('.cv-content');
    const col = textColor ? textColor.value : '#21345B';
    el._color = col; c.style.color = col;
    if (fontSelect && fontSelect.value) { el._font = fontSelect.value; c.style.fontFamily = fontSelect.value; }
    textInput.value = '';
  });
  textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('cvAddText').click(); });
  if (textColor) textColor.addEventListener('input', () => {
    if (selected && selected.classList.contains('text')) {
      selected._color = textColor.value;
      selected.querySelector('.cv-content').style.color = textColor.value;
    }
  });
  if (fontSelect) fontSelect.addEventListener('change', () => {
    if (selected && selected.classList.contains('text')) {
      selected._font = fontSelect.value;
      selected.querySelector('.cv-content').style.fontFamily = fontSelect.value;
    }
  });

  // ---- clear: blank the whole cake ----
  document.getElementById('cvClear').addEventListener('click', () => {
    layer.innerHTML = '';
    selected = null;
    scallop.setAttribute('stroke', 'transparent');
    document.querySelectorAll('.cv-swatch').forEach((s) => s.classList.remove('is-active'));
    const noneSw = document.querySelector('.cv-swatch-none');
    if (noneSw) noneSw.classList.add('is-active');
  });

  // ---- download the cake as a PNG ----
  const downloadBtn = document.getElementById('cvDownload');
  if (downloadBtn) downloadBtn.addEventListener('click', () => {
    select(null); // hide selection handles before the snapshot
    if (typeof html2canvas !== 'function') { alert('Download is still loading — try again in a second.'); return; }
    html2canvas(stage, { useCORS: true, backgroundColor: null, scale: 2 }).then((canvas) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'my-charm-cake.png';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    }).catch(() => alert('Could not download — a web-searched image may be blocking it. Try removing it or uploading the image instead.'));
  });

  // ---- custom image charms (upload or paste a link) ----
  const upload = document.getElementById('cvUpload');
  if (upload) upload.addEventListener('change', () => {
    const f = upload.files && upload.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => addImage(rd.result, 'my uploaded photo');
    rd.readAsDataURL(f);
    upload.value = '';
  });

  // ---- custom scallop color ----
  const colorInput = document.getElementById('cvColor');
  if (colorInput) colorInput.addEventListener('input', () => {
    scallop.setAttribute('stroke', colorInput.value);
    document.querySelectorAll('.cv-swatch').forEach((s) => s.classList.remove('is-active'));
    syncTextColorTo(colorInput.value);
  });

  // ---- charm palette (emoji, searchable) ----
  const CHARMS = [
    ['❤️','heart love red'],['💕','hearts love'],['💗','heart pink love'],['💙','heart blue'],['💚','heart green'],['🩷','heart pink'],
    ['⭐','star'],['🌟','star sparkle'],['✨','sparkles'],['🌈','rainbow'],['☀️','sun sunshine'],['🌙','moon night'],['☁️','cloud'],['❄️','snow snowflake winter'],
    ['🐶','dog puppy pet'],['🐱','cat kitten pet'],['🐰','bunny rabbit'],['🐴','horse pony'],['🦋','butterfly'],['🐝','bee'],['🐞','ladybug'],['🐠','fish'],['🐢','turtle'],['🦔','hedgehog'],['🐘','elephant'],['🦁','lion'],['🐻','bear'],['🐧','penguin'],['🦢','swan'],['🐓','rooster chicken'],['🦮','dog guide'],['🐩','poodle dog'],
    ['🌸','flower blossom pink'],['🌹','rose flower red'],['🌷','tulip flower'],['🌻','sunflower'],['🌼','daisy flower'],['🌿','leaf greenery vine'],['🍀','clover luck four leaf'],['🌳','tree'],['🌵','cactus'],['🪻','flower'],
    ['🎂','cake birthday'],['🧁','cupcake'],['🍰','cake slice'],['🍓','strawberry'],['🍒','cherry'],['🍋','lemon'],['🍑','peach'],['🍉','watermelon melon'],['🍦','ice cream'],['🍪','cookie'],['🥐','croissant'],['☕','coffee'],['🍷','wine'],['🍸','cocktail martini'],['🥂','champagne cheers'],['🍾','champagne'],
    ['🎾','tennis'],['⛳','golf'],['🏈','football'],['⚽','soccer'],['🏀','basketball'],['⚾','baseball'],['🎿','ski skiing'],['🏊','swimming'],['🚴','cycling bike'],['🧘','yoga'],['🎱','pool billiards'],['🏓','ping pong table tennis'],
    ['🎵','music note'],['🎸','guitar music'],['🎹','piano music'],['🎤','microphone sing'],['🎨','art paint'],['📚','books read'],['✏️','pencil write'],['🎭','theater drama'],['🎬','movie film'],['📷','camera photo'],['♟️','chess'],['🧶','yarn knit needlepoint'],['🪡','needle thread sewing'],
    ['✈️','plane travel'],['🚗','car'],['⛵','sailboat boat'],['🏖️','beach'],['🗽','nyc new york statue liberty'],['🏰','castle'],['🗺️','map travel'],['🧭','compass'],['🏡','house home'],['🌍','world globe earth'],
    ['👑','crown queen'],['💍','ring engagement'],['🎀','bow ribbon'],['🎁','gift present'],['🍼','baby bottle'],['👶','baby'],['🎓','graduation grad'],['💼','work briefcase'],['⚓','anchor nautical'],['🧸','teddy bear toy'],['🕯️','candle'],['🔑','key'],['📖','book'],
  ];
  const searchBox = document.getElementById('cvSearch');
  const searchResults = document.getElementById('cvSearchResults');
  const emojiPalette = document.getElementById('cvEmoji');

  function emojiLabel(c) {
    const e = CHARMS.find((x) => x[0] === c);
    return e ? e[1].split(' ')[0] : '';
  }
  function emojiButton(c) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cv-charm'; b.textContent = c;
    b.addEventListener('click', () => addItem(c, 'emoji', emojiLabel(c)));
    return b;
  }
  // Emoji charms: always-visible browse grid
  if (emojiPalette) CHARMS.forEach(([c]) => emojiPalette.appendChild(emojiButton(c)));

  // Fallback search of the free Iconify icon library (used if Google search isn't on yet).
  async function searchIcons(q) {
    searchResults.innerHTML = '<p class="cv-searching">Searching…</p>';
    try {
      const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=60`);
      const data = await res.json();
      searchResults.innerHTML = '';
      CHARMS.filter(([, kw]) => kw.includes(q.toLowerCase())).forEach(([c]) => searchResults.appendChild(emojiButton(c)));
      (data.icons || []).forEach((nm) => {
        const i = nm.indexOf(':');
        const prefix = nm.slice(0, i), icon = nm.slice(i + 1);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cv-charm cv-charm-icon';
        const img = document.createElement('img');
        img.src = `https://api.iconify.design/${prefix}/${icon}.svg?height=36`;
        img.alt = icon; img.loading = 'lazy';
        b.appendChild(img);
        b.addEventListener('click', () => addImage(`https://api.iconify.design/${prefix}/${icon}.svg?height=220`, icon.replace(/[-_]/g, ' ')));
        searchResults.appendChild(b);
      });
      if (!searchResults.children.length) searchResults.innerHTML = '<p class="cv-searching">No matches — try another word, or upload your own.</p>';
    } catch (e) {
      searchResults.innerHTML = '<p class="cv-searching">Search unavailable — try uploading an image instead.</p>';
    }
  }

  // Web image search via Google Custom Search (when configured); otherwise the icon fallback.
  async function searchImages(q) {
    if (!GOOGLE.key || !GOOGLE.cx) return searchIcons(q);
    searchResults.innerHTML = '<p class="cv-searching">Searching images…</p>';
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE.key}&cx=${GOOGLE.cx}&searchType=image&num=10&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) return searchIcons(q); // key/billing not ready yet → fall back
      searchResults.innerHTML = '';
      (data.items || []).forEach((it) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cv-charm cv-charm-img';
        const img = document.createElement('img');
        img.src = (it.image && it.image.thumbnailLink) || it.link;
        img.alt = it.title || ''; img.loading = 'lazy';
        b.appendChild(img);
        b.addEventListener('click', () => addImage(it.link, it.title || 'image'));
        searchResults.appendChild(b);
      });
      if (!searchResults.children.length) searchResults.innerHTML = '<p class="cv-searching">No images found — try another word.</p>';
    } catch (e) {
      searchIcons(q);
    }
  }

  // Keep the "open Google Images" link aimed at whatever's typed
  const webSearch = document.getElementById('cvWebSearch');
  function updateWebSearchHref(q) {
    if (webSearch) webSearch.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q || 'charm cake decoration')}`;
  }

  let searchT;
  if (searchBox) searchBox.addEventListener('input', () => {
    clearTimeout(searchT);
    const q = searchBox.value.trim();
    updateWebSearchHref(q);
    searchT = setTimeout(() => { if (q) searchImages(q); else searchResults.innerHTML = ''; }, 300);
  });

  // ---- carry the design into the order form ----
  // Save inscription text + a labelled charm list so order.html can pre-fill the charm inquiry.
  function saveDesign() {
    const texts = [...layer.querySelectorAll('.cv-item.text .cv-content')].map((el) => el.textContent.trim()).filter(Boolean);
    const charms = [...layer.querySelectorAll('.cv-item:not(.text)')].map((el) => el._label).filter(Boolean);
    try {
      localStorage.setItem('dutchyDesign', JSON.stringify({ inscription: texts.join(' · '), charms }));
    } catch (e) { /* ignore */ }
  }
  document.querySelectorAll('a[href^="order.html"]').forEach((a) => a.addEventListener('click', saveDesign));
})();
