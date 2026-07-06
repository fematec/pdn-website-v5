(function(){
  'use strict';

  // Publieke website v5: v4-layout blijft de basis. Alleen deze datalaag praat met het CMS.
  const CMS_API_DIRECT = 'https://pdn-api.info-fematec.workers.dev';
  const CMS_API_PROXY = '/api';

  const btn = document.querySelector('.menu-btn');
  const nav = document.querySelector('.nav');
  if (btn && nav) btn.addEventListener('click', () => nav.classList.toggle('open'));

  async function api(path) {
    // Website v5 draait nu als Cloudflare Worker. De Pages-function /api is daar niet
    // altijd beschikbaar, daarom eerst direct naar de publieke API en daarna pas proxy-fallback.
    const bases = [CMS_API_DIRECT, CMS_API_PROXY];
    let lastError = null;

    for (const base of bases) {
      try {
        const r = await fetch(base + path, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data || data.ok === false) {
          throw new Error((data && (data.error || data.message)) || 'CMS niet bereikbaar');
        }
        return data;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('CMS niet bereikbaar');
  }

  async function fetchJson(path) {
    const r = await fetch(path + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return [];
    return await r.json();
  }

  function pickArray(data, keys) {
    for (const key of keys) {
      if (Array.isArray(data && data[key])) return data[key];
    }
    if (Array.isArray(data)) return data;
    if (data && data.data && Array.isArray(data.data.items)) return data.data.items;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function pickObject(data, keys) {
    for (const key of keys) {
      if (data && data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) return data[key];
    }
    if (data && data.item && typeof data.item === 'object') return data.item;
    if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data;
    return data && typeof data === 'object' ? data : {};
  }

  async function loadHomepageSettings() {
    if (!document.querySelector('.classic-home-hero')) return;
    try {
      const d = await api('/settings');
      const s = pickObject(d, ['settings', 'site']);
      const hero = document.querySelector('.classic-home-hero');
      if (!hero) return;

      const eyebrow = hero.querySelector('.eyebrow');
      const title = hero.querySelector('h1');
      const intro = hero.querySelector('.hero-inner > div p');
      const buttons = hero.querySelectorAll('.buttons a');
      const infoTitle = hero.querySelector('.hero-card h2');
      const infoBlocks = hero.querySelectorAll('.quick div');

      if (s.homepage_bg_image) {
        const bg = absoluteMediaUrl(s.homepage_bg_image);
        hero.style.background = `linear-gradient(120deg,rgba(16,31,61,.94),rgba(16,31,61,.72)),url('${bg.replace(/'/g, "%27")}') center/cover`;
      }
      if (eyebrow && s.homepage_eyebrow) eyebrow.textContent = s.homepage_eyebrow;
      if (title && s.homepage_title) title.textContent = s.homepage_title;
      if (intro && s.homepage_intro) intro.textContent = s.homepage_intro;
      if (buttons[0]) {
        if (s.homepage_button_1_text) buttons[0].textContent = s.homepage_button_1_text;
        if (s.homepage_button_1_url) buttons[0].setAttribute('href', s.homepage_button_1_url);
      }
      if (buttons[1]) {
        if (s.homepage_button_2_text) buttons[1].textContent = s.homepage_button_2_text;
        if (s.homepage_button_2_url) buttons[1].setAttribute('href', s.homepage_button_2_url);
      }
      if (infoTitle && s.homepage_info_title) infoTitle.textContent = s.homepage_info_title;
      const info = [
        [s.homepage_info_1_title, s.homepage_info_1_text],
        [s.homepage_info_2_title, s.homepage_info_2_text],
        [s.homepage_info_3_title, s.homepage_info_3_text]
      ];
      infoBlocks.forEach((block, i) => {
        const pair = info[i] || [];
        if (!pair[0] && !pair[1]) return;
        block.innerHTML = `<strong>${escapeHtml(pair[0] || '')}</strong><br>${escapeHtml(pair[1] || '').replace(/\n/g, '<br>')}`;
      });
    } catch (e) {
      // Homepage valt terug op de vaste v4-teksten.
    }
  }

  async function loadSettings() {
    try {
      const d = await api('/settings');
      const s = pickObject(d, ['settings', 'site']);
      const name = s.site_name || s.name || 'De Prins der Nederlanden';
      const subtitle = s.site_subtitle || s.subtitle || 'Schietsportvereniging Vaassen sinds 1899';
      const email = s.contact_email || s.email || 'info@deprinsdernederlanden.nl';
      const address = s.address || 'Molenstraat 7, Vaassen';

      document.querySelectorAll('.brand strong').forEach(el => { el.textContent = name; });
      document.querySelectorAll('.brand span').forEach(el => { el.textContent = subtitle; });
      document.querySelectorAll('.footer').forEach(el => {
        el.innerHTML = `<p>© ${new Date().getFullYear()} ${escapeHtml(name)} · ${escapeHtml(address)} · <a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a></p>`;
      });
    } catch (e) {
      // V4 fallback blijft zichtbaar.
    }
  }

  async function loadMenu() {
    if (!nav) return;
    try {
      const settingsData = await api('/settings');
      const settings = pickObject(settingsData, ['settings', 'site']);
      const enabled = String(settings.dynamic_menu_enabled || '0') === '1' || String(settings.dynamic_menu_enabled || '').toLowerCase() === 'true';
      if (!enabled) return; // Veilig: vaste v4-header blijft zichtbaar tot dit expliciet in CMS is ingeschakeld.

      const d = await api('/menus');
      const items = pickArray(d, ['menus', 'menu', 'items'])
        .filter(x => Number(x.active ?? x.is_active ?? 1) !== 0 && (x.area || x.location || 'main') === 'main');
      if (!items.length) return;

      // Veiligheidscontrole: overschrijf de vaste v4-header alleen als het CMS-menu compleet is.
      // Zo voorkom je dat items zoals Clubnieuws/Fotogalerij verdwijnen wanneer dynamisch menu aan staat.
      if (!isCompleteMainMenu(items)) return;

      const byParent = {};
      items.forEach(x => {
        const p = x.parent_id || x.parent || '';
        (byParent[p] = byParent[p] || []).push(x);
      });
      Object.values(byParent).forEach(arr => arr.sort((a, b) =>
        (Number(a.sort_order ?? a.order ?? 0) - Number(b.sort_order ?? b.order ?? 0)) ||
        String(a.label || a.title || '').localeCompare(String(b.label || b.title || ''))
      ));

      const current = currentSlug();
      const html = (byParent[''] || byParent[null] || []).map(item => renderMenuItem(item, byParent, current)).join('');
      if (html) nav.innerHTML = html;
    } catch (e) {
      // V4 menu blijft staan.
    }
  }


  function isCompleteMainMenu(items) {
    const required = ['home', 'disciplines', 'clubnieuws', 'fotogalerij', 'over-ons', 'geschiedenis', 'contact'];
    const found = new Set();
    for (const item of items) {
      const href = menuHref(item);
      const label = cleanSlug(item.label || item.title || '');
      const slug = cleanSlug(item.page_slug || item.slug || item.url || slugFromHref(href));
      [label, slug, cleanSlug(slugFromHref(href))].forEach(v => found.add(v));
    }
    return required.every(v => found.has(v));
  }

  function renderMenuItem(item, byParent, current) {
    const id = item.id || item.uuid || item.slug;
    const children = byParent[id] || [];
    const href = menuHref(item);
    const slug = item.page_slug || item.slug || slugFromHref(href);
    const active = (slug === current || (current === 'home' && href === 'index.html')) ? 'active' : '';
    const target = item.new_tab || item.target === '_blank' ? ' target="_blank" rel="noopener"' : '';
    const label = item.label || item.title || 'Menu';
    if (!children.length) return `<a href="${escapeAttr(href)}" class="${active}"${target}>${escapeHtml(label)}</a>`;
    return `<span class="nav-group"><a href="${escapeAttr(href)}" class="${active}"${target}>${escapeHtml(label)}</a><span class="submenu">${children.map(c => renderMenuItem(c, byParent, current)).join('')}</span></span>`;
  }

  function menuHref(item) {
    const type = item.type || 'page';
    if ((type === 'external' || type === 'url') && item.url) return item.url;
    if (item.href) return item.href;
    if (item.url && /^https?:\/\//i.test(item.url)) return item.url;

    const slug = cleanSlug(item.page_slug || item.slug || item.url || '');
    if (!slug || slug === 'home' || slug === 'index') return 'index.html';

    const fixedPages = {
      'clubnieuws': 'clubnieuws.html',
      'fotogalerij': 'fotogalerij.html',
      'over-ons': 'over-ons.html',
      'disciplines': 'disciplines.html',
      'geschiedenis': 'geschiedenis.html',
      'contact': 'contact.html',
      'boogschieten': 'boogschieten.html',
      'luchtdruk': 'luchtdruk.html',
      'vuurwapen-disciplines': 'vuurwapen-disciplines.html'
    };
    if (fixedPages[slug]) return fixedPages[slug];
    if (String(item.url || '').endsWith('.html')) return item.url;
    return `pagina.html?slug=${encodeURIComponent(slug)}`;
  }

  function slugFromHref(href) { return String(href || '').replace(/^.*\//, '').replace(/\.html$/, '') || 'home'; }
  function currentSlug() {
    const querySlug = new URLSearchParams(location.search).get('slug');
    if (querySlug) return cleanSlug(querySlug);
    const f = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    if (f === 'pagina' || f === 'page') return cleanSlug(querySlug || '');
    return f === 'index' || f === '' ? 'home' : cleanSlug(f);
  }

  function cleanSlug(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'home';
  }

  function isGenericCmsPage() {
    return ['pagina.html', 'page.html'].includes(location.pathname.split('/').pop() || '');
  }

  async function loadCmsPage() {
    const slug = currentSlug();
    const staticCmsSlugs = ['home', 'over-ons', 'geschiedenis', 'disciplines', 'contact'];
    const generic = isGenericCmsPage();
    if (!generic && !staticCmsSlugs.includes(slug)) return;

    try {
      const d = await api('/pages/' + encodeURIComponent(slug));
      const p = pickObject(d, ['page', 'item']);
      if (!p || p.status === 'concept' || p.published === false) {
        if (generic) renderCms404(slug);
        return;
      }

      const title = p.title || p.name || slug;
      const lead = p.summary || p.excerpt || p.lead || '';
      setPageHero(title, lead);
      document.title = p.seo_title || `${title} | S.V. De Prins der Nederlanden`;
      upsertMeta('description', p.seo_description || p.description || stripHtml(p.content || '').slice(0, 160));

      renderCmsPageContent(p, { replaceStatic: slug !== 'home' || generic, generic });
    } catch (e) {
      if (generic) renderCms404(slug);
    }
  }

  function setPageHero(title, lead) {
    const h = document.querySelector('.page-hero h1');
    if (h && title) h.textContent = title;
    const leadEl = document.querySelector('.page-hero .lead');
    if (leadEl) leadEl.textContent = lead || 'Deze pagina wordt beheerd vanuit het CMS.';
  }

  function renderCmsPageContent(page, options = {}) {
    const content = String(page.content || '').trim();
    if (!content || !stripHtml(content)) {
      if (options.generic) renderCmsEmptyPage(page);
      return;
    }
    if (document.getElementById('cms-page-content')) return;

    const section = document.createElement('section');
    section.id = 'cms-page-content';
    section.className = 'section compact cms-page-section';
    section.innerHTML = `<div class="cms-content card"><div class="card-content">${content}</div></div>`;

    const hero = document.querySelector('.page-hero') || document.querySelector('.hero');
    if (options.replaceStatic && hero) removeStaticSectionsAfter(hero);

    if (hero && hero.parentNode) hero.parentNode.insertBefore(section, hero.nextSibling);
    else {
      const header = document.querySelector('.header');
      if (header && header.parentNode) header.parentNode.insertBefore(section, header.nextSibling);
      else document.body.insertBefore(section, document.body.firstChild);
    }
  }

  function removeStaticSectionsAfter(hero) {
    let node = hero.nextElementSibling;
    while (node && !node.classList.contains('footer')) {
      const next = node.nextElementSibling;
      if (node.tagName && node.tagName.toLowerCase() === 'section') node.remove();
      node = next;
    }
  }

  function renderCmsEmptyPage(page) {
    renderCmsPageContent({ content: '<p>Deze pagina is gepubliceerd, maar bevat nog geen inhoud.</p>' }, { generic: false, replaceStatic: true });
  }

  function renderCms404(slug) {
    setPageHero('Pagina niet gevonden', 'Deze pagina bestaat niet of is nog niet gepubliceerd.');
    document.title = 'Pagina niet gevonden | S.V. De Prins der Nederlanden';
    const hero = document.querySelector('.page-hero') || document.querySelector('.hero');
    if (hero) removeStaticSectionsAfter(hero);
    const section = document.createElement('section');
    section.id = 'cms-page-content';
    section.className = 'section compact cms-page-section';
    section.innerHTML = `<div class="cms-content card"><div class="card-content"><h2>Niet gevonden</h2><p>De pagina <strong>${escapeHtml(slug)}</strong> bestaat niet of staat nog op concept.</p><p><a class="btn dark" href="index.html">Terug naar home</a></p></div></div>`;
    if (hero && hero.parentNode) hero.parentNode.insertBefore(section, hero.nextSibling);
  }

  function upsertMeta(name, content) {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  async function loadNews() {
    const targets = [document.getElementById('news-list'), document.getElementById('home-news-list')].filter(Boolean);
    if (!targets.length) return;

    const newsId = new URLSearchParams(location.search).get('id');
    if (newsId && document.getElementById('news-list')) {
      await loadNewsDetail(newsId);
      return;
    }

    try {
      const d = await api('/news');
      const data = pickArray(d, ['news', 'posts', 'articles', 'items'])
        .filter(n => String(n.status || 'published') === 'published' || n.published === true);
      renderNewsTargets(targets, data, true);
    } catch (e) {
      try {
        const data = await fetchJson('data/news.json');
        renderNewsTargets(targets, data, false);
      } catch (err) {
        targets.forEach(el => { el.innerHTML = '<article class="card"><div class="card-content"><h3>Nieuws kan nog niet worden geladen</h3></div></article>'; });
      }
    }
  }

  async function loadNewsDetail(id) {
    const el = document.getElementById('news-list');
    if (!el) return;
    el.className = 'grid one';
    el.innerHTML = '<article class="card"><div class="card-content"><span class="badge">Laden</span><h3>Nieuwsbericht wordt geladen</h3></div></article>';
    try {
      const d = await api('/news/' + encodeURIComponent(id));
      const item = pickObject(d, ['item', 'news', 'post', 'article']);
      if (!item || String(item.status || 'published') !== 'published') throw new Error('Nieuwsbericht niet gevonden');

      let media = [];
      try {
        const md = await api('/news/' + encodeURIComponent(id) + '/media');
        media = pickArray(md, ['media', 'items', 'images']).filter(isGalleryImage);
      } catch (e) {}

      renderNewsDetail(el, item, media);
    } catch (e) {
      el.innerHTML = `<article class="card"><div class="card-content"><span class="badge">Clubnieuws</span><h3>Nieuwsbericht niet gevonden</h3><p>Het bericht bestaat niet meer of is niet gepubliceerd.</p><p><a class="btn dark" href="clubnieuws.html">Terug naar clubnieuws</a></p></div></article>`;
    }
  }

  function renderNewsTargets(targets, data, fromCms) {
    const sorted = (data || []).slice().sort((a, b) => String(newsDate(b)).localeCompare(String(newsDate(a))));
    const make = (items, compact) => {
      if (!items.length) {
        return '<article class="card"><div class="card-content"><span class="badge">Nieuws</span><h3>Nog geen nieuwsberichten</h3><p>Nieuwe gepubliceerde berichten uit het CMS verschijnen hier automatisch.</p></div></article>';
      }
      return items.map(n => renderNewsCard(n, compact, fromCms)).join('');
    };
    targets.forEach(el => {
      const compact = el.id === 'home-news-list';
      el.innerHTML = make(sorted.slice(0, compact ? 3 : 999), compact);
    });
  }

  function renderNewsCard(n, compact, fromCms) {
    const title = n.title || n.name || 'Nieuwsbericht';
    const image = absoluteMediaUrl(n.cover_image || n.image || n.image_url || (Array.isArray(n.images) ? n.images[0] : ''));
    const rawText = n.summary || n.excerpt || stripHtml(n.content || n.body || '');
    const shortText = summary(stripHtml(rawText), compact ? 120 : 180);
    const href = fromCms && n.id ? `clubnieuws.html?id=${encodeURIComponent(n.id)}` : 'clubnieuws.html';
    return `<a class="card news-card news-link" href="${escapeAttr(href)}">` +
      `${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy">` : ''}` +
      `<div class="card-content"><span class="badge">${escapeHtml(formatDate(newsDate(n)) || 'Clubnieuws')}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(shortText)}</p><span class="read-more">Lees bericht</span></div></a>`;
  }

  function renderNewsDetail(el, n, media) {
    const title = n.title || 'Nieuwsbericht';
    const image = absoluteMediaUrl(n.cover_image || n.image || n.image_url || '');
    const content = String(n.content || n.summary || '').trim();
    document.title = `${title} | Clubnieuws | S.V. De Prins der Nederlanden`;

    const extraPhotos = (media || []).map(m => {
      const url = absoluteMediaUrl(m.data_url || m.url || m.image_url || m.src || (m.id ? '/media-file/' + m.id : ''));
      const label = m.title || m.caption || m.filename || 'Foto bij nieuwsbericht';
      if (!url) return '';
      return `<a class="gallery-item" href="${escapeAttr(url)}" target="_blank" rel="noopener"><img src="${escapeAttr(url)}" alt="${escapeAttr(label)}" loading="lazy"><span>${escapeHtml(label)}</span></a>`;
    }).join('');

    el.innerHTML = `<article class="card news-detail-card">` +
      `${image ? `<img class="news-detail-cover" src="${escapeAttr(image)}" alt="${escapeAttr(title)}">` : ''}` +
      `<div class="card-content news-detail-content"><p><a href="clubnieuws.html">← Terug naar clubnieuws</a></p><span class="badge">${escapeHtml(formatDate(newsDate(n)) || 'Clubnieuws')}</span><h2>${escapeHtml(title)}</h2><div class="cms-content">${content || '<p>Geen berichttekst ingevuld.</p>'}</div></div>` +
      `${extraPhotos ? `<div class="card-content"><h3>Foto’s bij dit bericht</h3><div class="gallery-grid news-media-grid">${extraPhotos}</div></div>` : ''}` +
    `</article>`;
  }

  function newsDate(n) { return n.created_at || n.published_at || n.updated_at || n.date || ''; }

  function absoluteMediaUrl(url) {
    url = String(url || '');
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return CMS_API_DIRECT + url;
    return url;
  }

  async function loadGallery() {
    const el = document.getElementById('gallery-list');
    if (!el) return;
    const selectedAlbum = new URLSearchParams(location.search).get('album');

    try {
      const [albumsData, mediaData] = await Promise.all([api('/albums'), api('/media')]);
      const albums = pickArray(albumsData, ['albums', 'items']);
      const media = pickArray(mediaData, ['media', 'images', 'files', 'items']).filter(isGalleryImage);
      renderGalleryAlbums(el, albums, media, selectedAlbum);
    } catch (e) {
      try {
        const data = await fetchJson('data/gallery.json');
        renderGalleryFlat(el, data);
      } catch (err) {
        el.innerHTML = '<p>Galerij kan nog niet worden geladen.</p>';
      }
    }
  }

  function isGalleryImage(m) {
    if (!m) return false;
    const type = String(m.mime_type || m.type || '').toLowerCase();
    const url = String(m.data_url || m.url || m.image_url || m.src || '').toLowerCase();
    return type.startsWith('image/') || url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif|svg)(\?|#|$)/.test(url) || !!m.r2_key;
  }

  function renderGalleryAlbums(el, albums, media, selectedAlbum) {
    const items = (media || []).slice().sort((a, b) =>
      String(b.uploaded_at || b.created_at || b.updated_at || '').localeCompare(String(a.uploaded_at || a.created_at || a.updated_at || ''))
    );

    if (!items.length) {
      el.innerHTML = '<p>Er staan nog geen foto’s in de galerij. Foto’s die je in het CMS uploadt verschijnen hier automatisch.</p>';
      return;
    }

    const albumMap = new Map();
    (albums || []).forEach(a => albumMap.set(String(a.id), { id: String(a.id), name: a.name || a.title || 'Album', description: a.description || '' }));
    items.forEach(m => {
      const id = String(m.album_id || 'algemeen');
      if (!albumMap.has(id)) albumMap.set(id, { id, name: m.album_name || m.album || 'Algemeen', description: '' });
    });

    if (selectedAlbum) {
      const album = albumMap.get(String(selectedAlbum)) || { id: selectedAlbum, name: 'Album' };
      const albumItems = items.filter(m => String(m.album_id || 'algemeen') === String(selectedAlbum));
      el.className = 'gallery-grid';
      el.innerHTML = `<div class="gallery-toolbar"><a class="btn dark" href="fotogalerij.html">← Terug naar albums</a><h2>${escapeHtml(album.name)}</h2>${album.description ? `<p>${escapeHtml(album.description)}</p>` : ''}</div>` +
        (albumItems.length ? renderGalleryFlatHtml(albumItems) : '<p>Dit album bevat nog geen foto’s.</p>');
      return;
    }

    const albumCards = Array.from(albumMap.values()).map(album => {
      const albumItems = items.filter(m => String(m.album_id || 'algemeen') === String(album.id));
      if (!albumItems.length) return '';
      const cover = albumItems.find(x => x.data_url || x.url || x.image_url || x.src) || albumItems[0];
      const coverUrl = absoluteMediaUrl(cover.data_url || cover.url || cover.image_url || cover.src || (cover.id ? '/media-file/' + cover.id : ''));
      return `<a class="gallery-item album-item" href="fotogalerij.html?album=${encodeURIComponent(album.id)}">` +
        `${coverUrl ? `<img src="${escapeAttr(coverUrl)}" alt="${escapeAttr(album.name)}" loading="lazy">` : ''}` +
        `<span>${escapeHtml(album.name)}<small>${albumItems.length} foto${albumItems.length === 1 ? '' : '’s'}</small></span>` +
      `</a>`;
    }).join('');

    el.className = 'gallery-grid album-grid';
    el.innerHTML = albumCards;
  }

  function renderGalleryFlat(el, data) {
    if (!data || !data.length) {
      el.innerHTML = '<p>Er staan nog geen foto’s in de galerij.</p>';
      return;
    }
    el.innerHTML = renderGalleryFlatHtml(data);
  }

  function renderGalleryFlatHtml(data) {
    const items = (data || []).slice().sort((a, b) =>
      String(b.uploaded_at || b.created_at || b.updated_at || '').localeCompare(String(a.uploaded_at || a.created_at || a.updated_at || ''))
    );
    return items.map(g => {
      const url = absoluteMediaUrl(g.data_url || g.url || g.image_url || g.src || (g.id ? '/media-file/' + g.id : ''));
      const title = g.title || g.caption || g.filename || g.album_name || g.album || 'Verenigingsfoto';
      const album = g.album_name || g.album || '';
      if (!url) return '';
      return `<a class="gallery-item" href="${escapeAttr(url)}" target="_blank" rel="noopener">` +
        `<img src="${escapeAttr(url)}" alt="${escapeAttr(title)}" loading="lazy">` +
        `<span>${escapeHtml(title)}${album ? `<small>${escapeHtml(album)}</small>` : ''}</span>` +
      `</a>`;
    }).join('');
  }

  function formatDate(s) {
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(s))) {
      const parts = String(s).split('-');
      s = `${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`;
    }
    const d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function summary(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function stripHtml(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

  function publicPageUrl(slug) {
    slug = cleanSlug(slug);
    const staticMap = {
      home: 'index.html',
      'over-ons': 'over-ons.html',
      geschiedenis: 'geschiedenis.html',
      disciplines: 'disciplines.html',
      contact: 'contact.html'
    };
    return staticMap[slug] || `pagina.html?slug=${encodeURIComponent(slug)}`;
  }

  // V4-layout herstel: header, merknaam, navigatie en footer blijven uit de HTML/CSS.
  // Sprint 3 maakt pagina-inhoud wel dynamisch: bestaande pagina's worden vervangen door
  // CMS-inhoud zodra die gepubliceerd en gevuld is. Nieuwe CMS-pagina's zijn bereikbaar via
  // pagina.html?slug=... .
  // loadSettings();
  loadMenu();
  loadHomepageSettings();
  loadCmsPage();
  loadNews();
  loadGallery();
})();
