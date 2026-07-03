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
      const d = await api('/menus');
      const items = pickArray(d, ['menus', 'menu', 'items'])
        .filter(x => Number(x.active ?? x.is_active ?? 1) !== 0 && (x.area || x.location || 'main') === 'main');
      if (!items.length) return;

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
    if ((item.type || 'page') === 'external' && item.url) return item.url;
    if (item.href) return item.href;
    if (item.url && /^https?:\/\//i.test(item.url)) return item.url;
    const slug = item.page_slug || item.slug || item.url || '';
    if (!slug || slug === 'home' || slug === 'index') return 'index.html';
    return String(slug).endsWith('.html') ? slug : `${slug}.html`;
  }

  function slugFromHref(href) { return String(href || '').replace(/^.*\//, '').replace(/\.html$/, '') || 'home'; }
  function currentSlug() {
    const f = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    return f === 'index' || f === '' ? 'home' : f;
  }

  async function loadCmsPageMetaOnly() {
    // Bewust veilig: geen complete v4-secties vervangen. Alleen titel/lead/meta als CMS dit levert.
    const slug = currentSlug();
    // Voorkomt onnodige 404's op vaste pagina's zoals clubnieuws/fotogalerij.
    const cmsManagedSlugs = ['home', 'over-ons', 'geschiedenis', 'disciplines', 'contact'];
    if (!cmsManagedSlugs.includes(slug)) return;
    try {
      const d = await api('/pages/' + encodeURIComponent(slug));
      const p = pickObject(d, ['page', 'item']);
      if (!p || p.status === 'concept' || p.published === false) return;

      const title = p.title || p.name;
      const lead = p.summary || p.excerpt || p.lead;
      if (title) {
        const h = document.querySelector('.page-hero h1');
        if (h) h.textContent = title;
        if (slug !== 'home') document.title = `${title} | S.V. De Prins der Nederlanden`;
      }
      if (lead) {
        const leadEl = document.querySelector('.page-hero .lead');
        if (leadEl) leadEl.textContent = lead;
      }
      if (p.seo_title) document.title = p.seo_title;
      upsertMeta('description', p.seo_description || p.description || '');
    } catch (e) {}
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
    const rawText = n.summary || n.excerpt || n.body || stripHtml(n.content || '');
    const full = fromCms && n.content ? `<div class="cms-content">${n.content}</div>` : `<p>${escapeHtml(rawText).replace(/\n/g, '<br>')}</p>`;
    const shortText = summary(stripHtml(rawText), 160);
    return `<article class="card news-card">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}">` : ''}<div class="card-content"><span class="badge">${escapeHtml(formatDate(newsDate(n)) || 'Clubnieuws')}</span><h3>${escapeHtml(title)}</h3>${compact ? `<p>${escapeHtml(shortText)}</p>` : full}</div></article>`;
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
    try {
      const d = await api('/media');
      const data = pickArray(d, ['media', 'images', 'files', 'items'])
        .filter(m => String(m.mime_type || m.type || 'image/').startsWith('image/') || m.data_url || m.url || m.image_url);
      renderGallery(el, data, true);
    } catch (e) {
      try {
        const data = await fetchJson('data/gallery.json');
        renderGallery(el, data, false);
      } catch (err) {
        el.innerHTML = '<p>Galerij kan nog niet worden geladen.</p>';
      }
    }
  }

  function renderGallery(el, data, fromCms) {
    if (!data || !data.length) { el.innerHTML = '<p>Er staan nog geen foto’s in de galerij.</p>'; return; }
    el.innerHTML = data.slice().sort((a, b) => String(b.uploaded_at || b.created_at || '').localeCompare(String(a.uploaded_at || a.created_at || '')))
      .map(g => {
        const url = absoluteMediaUrl(g.data_url || g.url || g.image_url || g.src || '');
        const title = g.title || g.caption || g.filename || g.album || 'Verenigingsfoto';
        if (!url) return '';
        return `<a class="gallery-item" href="${escapeAttr(url)}" target="_blank" rel="noopener"><img src="${escapeAttr(url)}" alt="${escapeAttr(title)}"><span>${escapeHtml(title)}</span></a>`;
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

  loadSettings();
  loadMenu();
  loadCmsPageMetaOnly();
  loadNews();
  loadGallery();
})();
