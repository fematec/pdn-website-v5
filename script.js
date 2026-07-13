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


  async function apiPost(path, body) {
    const bases = [CMS_API_DIRECT, CMS_API_PROXY];
    let lastError = null;
    for (const base of bases) {
      try {
        const r = await fetch(base + path, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {})
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data || data.ok === false) throw new Error((data && data.error) || 'Versturen mislukt');
        return data;
      } catch (err) { lastError = err; }
    }
    throw lastError || new Error('Versturen mislukt');
  }


  async function renderLinkedForm(container, formId) {
    if (!container || !formId) return;
    const target = document.createElement('div');
    target.className = 'linked-form-wrap card';
    target.innerHTML = '<div class="card-content"><p>Formulier wordt geladen...</p></div>';
    container.appendChild(target);
    try {
      const d = await api('/forms/' + encodeURIComponent(formId));
      const form = pickObject(d, ['item','form']);
      if (!form || form.status === 'archived' || form.status === 'deleted') { target.remove(); return; }
      const fields = normalizeFormFields(form.fields);
      target.innerHTML = `<div class="card-content"><h3>${escapeHtml(form.title || 'Formulier')}</h3>${form.description?`<p class="lead small">${escapeHtml(form.description)}</p>`:''}<form class="linked-form" data-form-slug="${escapeAttr(form.slug)}">${fields.map(formFieldHtml).join('')}<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button type="submit">Versturen</button><p class="form-msg"></p></form></div>`;
      const frm = target.querySelector('form');
      const msg = target.querySelector('.form-msg');
      frm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = frm.querySelector('button[type="submit"]');
        btn.disabled = true;
        msg.textContent = 'Versturen...';
        try {
          const data = Object.fromEntries(new FormData(frm).entries());
          await apiPost('/public-forms/' + encodeURIComponent(form.slug) + '/submit', data);
          frm.reset();
          msg.textContent = 'Bedankt. Het formulier is verzonden.';
        } catch (err) {
          msg.textContent = err.message || 'Versturen mislukt.';
        } finally {
          btn.disabled = false;
        }
      });
    } catch (err) { target.remove(); }
  }

  function normalizeFormFields(fields) {
    if (Array.isArray(fields)) return fields;
    try { const parsed = JSON.parse(fields || '[]'); return Array.isArray(parsed) ? parsed : []; } catch(e) { return []; }
  }
  function formFieldHtml(f) {
    const name = escapeAttr(f.name || f.label || 'veld');
    const label = escapeHtml(f.label || f.name || 'Veld');
    const required = f.required ? ' required' : '';
    const req = f.required ? ' <span>*</span>' : '';
    const placeholder = escapeAttr(f.placeholder || '');
    const options = Array.isArray(f.options) ? f.options : String(f.options || '').split('\n').filter(Boolean);
    if (f.type === 'textarea') return `<label>${label}${req}<textarea name="${name}" placeholder="${placeholder}"${required}></textarea></label>`;
    if (f.type === 'select') return `<label>${label}${req}<select name="${name}"${required}><option value="">Kies...</option>${options.map(o=>`<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join('')}</select></label>`;
    if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${name}" value="ja"${required}> ${label}${req}</label>`;
    const type = f.type === 'email' ? 'email' : 'text';
    return `<label>${label}${req}<input type="${type}" name="${name}" placeholder="${placeholder}"${required}></label>`;
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

  function truthySetting(value, fallback = true) {
    if (value === undefined || value === null || value === '') return !!fallback;
    const v = String(value).toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'aan';
  }

  function findHomeSectionByTitle(text) {
    const sections = Array.from(document.querySelectorAll('section.section, section.section.alt'));
    const wanted = String(text || '').toLowerCase();
    return sections.find(sec => String(sec.querySelector('h2')?.textContent || '').toLowerCase().includes(wanted));
  }

  async function loadHomepageSettings() {
    if (!document.querySelector('.classic-home-hero')) return;
    try {
      const d = await api('/settings');
      const s = pickObject(d, ['settings', 'site']);
      window.PDN_HOME_SETTINGS = s;
      window.PDN_HOME_NEWS_COUNT = Math.max(1, Math.min(9, Number(s.homepage_news_count || 3)));
      window.PDN_HOME_GALLERY_COUNT = Math.max(1, Math.min(12, Number(s.homepage_gallery_count || 6)));
      window.PDN_HOME_GALLERY_ALBUM = s.homepage_gallery_album_id || '';
      window.PDN_HOME_GALLERY_TITLE = s.homepage_gallery_title || 'Foto’s van de vereniging';
      window.PDN_HOME_GALLERY_INTRO = s.homepage_gallery_intro || 'Een korte impressie uit de mediabibliotheek van de vereniging.';
      const hero = document.querySelector('.classic-home-hero');
      if (!hero) return;

      hero.style.display = truthySetting(s.homepage_show_hero, true) ? '' : 'none';
      const disciplinesSection = findHomeSectionByTitle('ontdek onze disciplines');
      const newsSection = findHomeSectionByTitle('laatste clubnieuws');
      const whySection = findHomeSectionByTitle('waarom lid worden');
      const contactSection = findHomeSectionByTitle('kom langs');
      const gallerySection = document.querySelector('[data-home-gallery-section]');
      if (disciplinesSection) disciplinesSection.style.display = truthySetting(s.homepage_show_disciplines, true) ? '' : 'none';
      if (newsSection) newsSection.style.display = truthySetting(s.homepage_show_news, true) ? '' : 'none';
      if (gallerySection) gallerySection.style.display = truthySetting(s.homepage_show_gallery, true) ? '' : 'none';
      if (whySection) whySection.style.display = truthySetting(s.homepage_show_why, true) ? '' : 'none';
      if (contactSection) contactSection.style.display = truthySetting(s.homepage_show_contact, true) ? '' : 'none';

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

      if (whySection) {
        const whyTitle = whySection.querySelector('.section-title h2');
        const whyIntro = whySection.querySelector('.section-title .lead');
        const whyCards = whySection.querySelectorAll('.card');
        if (whyTitle && s.homepage_why_title) whyTitle.textContent = s.homepage_why_title;
        if (whyIntro && s.homepage_why_intro) whyIntro.textContent = s.homepage_why_intro;
        const whyData = [
          [s.homepage_why_1_badge, s.homepage_why_1_title, s.homepage_why_1_text],
          [s.homepage_why_2_badge, s.homepage_why_2_title, s.homepage_why_2_text],
          [s.homepage_why_3_badge, s.homepage_why_3_title, s.homepage_why_3_text]
        ];
        whyCards.forEach((card, i) => {
          const d = whyData[i] || [];
          const badge = card.querySelector('.badge');
          const h3 = card.querySelector('h3');
          const p = card.querySelector('p:not(.arrow)');
          if (badge && d[0]) badge.textContent = d[0];
          if (h3 && d[1]) h3.textContent = d[1];
          if (p && d[2]) p.textContent = d[2];
        });
      }

      if (contactSection) {
        const contactTitle = contactSection.querySelector('.section-title h2');
        const contactIntro = contactSection.querySelector('.section-title .lead');
        const contactButton = contactSection.querySelector('.btn');
        const boxTitle = contactSection.querySelector('.info-box h3');
        const list = contactSection.querySelector('.info-box ul');
        if (contactTitle && s.homepage_contact_title) contactTitle.textContent = s.homepage_contact_title;
        if (contactIntro && s.homepage_contact_intro) contactIntro.textContent = s.homepage_contact_intro;
        if (contactButton) {
          if (s.homepage_contact_button_text) contactButton.textContent = s.homepage_contact_button_text;
          if (s.homepage_contact_button_url) contactButton.setAttribute('href', s.homepage_contact_button_url);
        }
        if (boxTitle && s.homepage_contact_box_title) boxTitle.textContent = s.homepage_contact_box_title;
        if (list && s.homepage_contact_points) {
          const points = String(s.homepage_contact_points).split(/\n+/).map(x => x.trim()).filter(Boolean);
          if (points.length) list.innerHTML = points.map(x => `<li>${escapeHtml(x)}</li>`).join('');
        }
      }
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
      applyManagedPageHeader(s);
      applyManagedDisciplineCards(s);
      applyManagedDisciplineDetail(s);
    } catch (e) {
      // V4 fallback blijft zichtbaar.
    }
  }

  function applyManagedPageHeader(s) {
    const slug = currentSlug();
    const key = 'page_' + slug + '_';
    const eyebrow = s[key + 'eyebrow'];
    const title = s[key + 'title'];
    const intro = s[key + 'intro'];
    const image = s[key + 'image'];

    const hero = document.querySelector('.page-hero') || (slug === 'home' ? document.querySelector('.classic-home-hero') : null);
    if (!hero) return;

    const eyebrowEl = hero.querySelector('.eyebrow');
    const titleEl = hero.querySelector('h1');
    const introEl = hero.querySelector('.lead') || hero.querySelector('p');

    if (eyebrowEl && eyebrow) eyebrowEl.textContent = eyebrow;
    if (titleEl && title) titleEl.textContent = title;
    if (introEl && intro) introEl.textContent = intro;
    if (image) {
      const bg = absoluteMediaUrl(image);
      hero.style.background = `linear-gradient(120deg,rgba(16,31,61,.94),rgba(16,31,61,.72)),url('${bg.replace(/'/g, "%27")}') center/cover`;
    }
  }

  function applyManagedDisciplineCards(s) {
    const section = findHomeSectionByTitle('ontdek onze disciplines');
    if (!section) return;
    const cards = section.querySelectorAll('.discipline-card');
    const ids = ['boog','lucht','vuur'];
    ids.forEach((id, i) => {
      const card = cards[i];
      if (!card) return;
      const tag = s['discipline_' + id + '_tag'];
      const title = s['discipline_' + id + '_title'];
      const text = s['discipline_' + id + '_text'];
      const linkText = s['discipline_' + id + '_link_text'];
      const url = s['discipline_' + id + '_url'];
      const image = s['discipline_' + id + '_image'];
      if (url) card.setAttribute('href', url);
      const tagEl = card.querySelector('.tag');
      const imgEl = card.querySelector('img');
      const h3 = card.querySelector('h3');
      const p = card.querySelector('.card-content p:not(.arrow)');
      const arrow = card.querySelector('.arrow');
      if (tagEl && tag) tagEl.textContent = tag;
      if (h3 && title) h3.textContent = title;
      if (p && text) p.textContent = text;
      if (arrow && linkText) arrow.textContent = linkText;
      if (imgEl && image) imgEl.src = absoluteMediaUrl(image);
      if (imgEl && title) imgEl.alt = title;
    });
  }


  function applyManagedDisciplineDetail(s) {
    const slug = currentSlug();
    const map = {'boogschieten':'boog','luchtdruk':'lucht','vuurwapen-disciplines':'vuur'};
    const id = map[slug];
    if (!id) return;
    const k = 'discipline_detail_' + id + '_';
    const hasAny = Object.keys(s || {}).some(x => x.startsWith(k));
    if (!hasAny) return;

    const hero = document.querySelector('.page-hero');
    if (hero) {
      const eyebrow = s[k + 'eyebrow'];
      const title = s[k + 'title'];
      const intro = s[k + 'intro'];
      const image = s[k + 'hero_image'];
      const eyebrowEl = hero.querySelector('.eyebrow');
      const titleEl = hero.querySelector('h1');
      const introEl = hero.querySelector('.lead') || hero.querySelector('p');
      if (eyebrowEl && eyebrow) eyebrowEl.textContent = eyebrow;
      if (titleEl && title) titleEl.textContent = title;
      if (introEl && intro) introEl.textContent = intro;
      if (image) {
        const bg = absoluteMediaUrl(image);
        hero.style.background = `linear-gradient(120deg,rgba(16,31,61,.94),rgba(16,31,61,.72)),url('${bg.replace(/'/g, "%27")}') center/cover`;
      }
    }

    const gallery = document.querySelector('.gallery');
    const galleryImages = splitSettingLines(s[k + 'gallery_images']);
    if (gallery && galleryImages.length) {
      const title = s[k + 'title'] || 'Discipline';
      gallery.innerHTML = galleryImages.map((img, i) => `<img src="${escapeAttr(absoluteMediaUrl(img))}" alt="${escapeAttr(title)} foto ${i+1}">`).join('');
    }

    const mainGrid = document.querySelector('.grid.two');
    if (mainGrid) {
      const left = mainGrid.children && mainGrid.children[0];
      const features = mainGrid.querySelector('.feature-list');
      if (left) {
        const badge = left.querySelector('.badge');
        const h2 = left.querySelector('h2');
        if (badge && s[k + 'badge']) badge.textContent = s[k + 'badge'];
        if (h2 && s[k + 'content_title']) h2.textContent = s[k + 'content_title'];
        const buttons = left.querySelector('.buttons');
        const text = s[k + 'content_text'];
        if (text) {
          const html = splitParagraphs(text).map(x => `<p>${escapeHtml(x)}</p>`).join('');
          Array.from(left.querySelectorAll('p')).forEach(p => p.remove());
          if (buttons) buttons.insertAdjacentHTML('beforebegin', html);
          else left.insertAdjacentHTML('beforeend', html);
        }
        if (buttons) {
          const a = buttons.querySelectorAll('a');
          if (a[0]) { if (s[k+'button_text']) a[0].textContent = s[k+'button_text']; if (s[k+'button_url']) a[0].setAttribute('href', s[k+'button_url']); }
          if (a[1]) { if (s[k+'button2_text']) a[1].textContent = s[k+'button2_text']; if (s[k+'button2_url']) a[1].setAttribute('href', s[k+'button2_url']); }
        }
      }
      if (features) {
        const items = features.querySelectorAll('div');
        [1,2,3].forEach((n, i) => {
          const item = items[i];
          if (!item) return;
          const st = s[k + 'feature_' + n + '_title'];
          const sx = s[k + 'feature_' + n + '_text'];
          const strong = item.querySelector('strong');
          const p = item.querySelector('p');
          if (strong && st) strong.textContent = st;
          if (p && sx) p.textContent = sx;
        });
      }
    }

    const notice = document.querySelector('.notice');
    if (notice) {
      const h2 = notice.querySelector('h2');
      const p = notice.querySelector('p');
      if (h2 && s[k + 'notice_title']) h2.textContent = s[k + 'notice_title'];
      if (p && s[k + 'notice_text']) p.textContent = s[k + 'notice_text'];
    }
  }

  function splitSettingLines(value) {
    return String(value || '').split(/\n|,/).map(x => x.trim()).filter(Boolean);
  }

  function splitParagraphs(value) {
    return String(value || '').split(/\n{2,}|\r?\n/).map(x => x.trim()).filter(Boolean);
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
    const required = ['home', 'disciplines', 'clubnieuws', 'fotogalerij', 'agenda', 'over-ons', 'geschiedenis', 'contact'];
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

    const prettyPages = {
      'clubnieuws': '/clubnieuws',
      'fotogalerij': '/fotogalerij',
      'over-ons': '/over-ons',
      'disciplines': '/disciplines',
      'geschiedenis': '/geschiedenis',
      'contact': '/contact',
      'agenda': '/agenda',
      'boogschieten': '/boogschieten',
      'luchtdruk': '/luchtdruk',
      'vuurwapen-disciplines': '/vuurwapen-disciplines'
    };
    if (prettyPages[slug]) return prettyPages[slug];
    if (String(item.url || '').endsWith('.html')) return item.url;
    return `/${encodeURIComponent(slug)}`;
  }

  function slugFromHref(href) {
    const h = String(href || '').split('?')[0].replace(/\/$/, '');
    return h.replace(/^.*\//, '').replace(/\.html$/, '') || 'home';
  }
  function currentSlug() {
    const querySlug = new URLSearchParams(location.search).get('slug');
    if (querySlug) return cleanSlug(querySlug);
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path.endsWith('/index.html')) return 'home';
    if (path.startsWith('/nieuws/')) return 'clubnieuws';
    if (path.startsWith('/agenda/')) return 'agenda';
    const f = (path.split('/').pop() || 'index.html').replace(/\.html$/, '');
    if (f === 'pagina' || f === 'page') return cleanSlug(querySlug || '');
    return cleanSlug(f);
  }

  function cleanSlug(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'home';
  }

  function isGenericCmsPage() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const file = path.split('/').pop() || '';
    if (['pagina.html', 'page.html'].includes(file)) return true;
    if (path === '/' || path.startsWith('/api') || path.startsWith('/nieuws/') || path.startsWith('/agenda/')) return false;

    // Belangrijk: vaste v4-pagina's mogen nooit als generieke CMS-pagina worden behandeld.
    // Anders kan een concept/lege CMS-pagina de werkende statische layout vervangen door 404.
    const fixedRoutes = [
      'home','index','clubnieuws','fotogalerij','agenda','over-ons','disciplines','geschiedenis','contact',
      'boogschieten','luchtdruk','vuurwapen-disciplines'
    ];
    const slug = cleanSlug(file);
    if (fixedRoutes.includes(slug)) return false;

    // Extensionless URL's zoals /bestuur of /lid-worden worden als CMS-pagina behandeld.
    return !file.includes('.');
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
        // Alleen nieuwe/generieke CMS-routes krijgen een 404.
        // Vaste v4-pagina's zoals /disciplines en /geschiedenis blijven gewoon hun originele inhoud tonen.
        if (generic) renderCms404(slug);
        return;
      }

      const title = p.title || p.name || slug;
      const lead = p.summary || p.excerpt || p.lead || '';
      // Vaste paginaheaders komen uit Instellingen en mogen niet door de CMS-pagina-inhoud overschreven worden.
      const managedHeaderSlugs = ['clubnieuws','fotogalerij','agenda','over-ons','disciplines','geschiedenis','contact'];
      if (!managedHeaderSlugs.includes(slug)) setPageHero(title, lead);
      document.title = p.seo_title || `${title} | S.V. De Prins der Nederlanden`;
      applySeoMeta({
        title: p.seo_title || title,
        description: p.meta_description || p.seo_description || p.description || stripHtml(p.content || '').slice(0, 160),
        image: p.og_image || firstImageFromHtml(p.content || ''),
        url: location.href,
        noIndex: !!p.no_index
      });

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
    renderLinkedForm(section, page.form_id || page.linked_form_id || page.formId || page.form);

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
    if (content === undefined || content === null || content === '') return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  function upsertPropertyMeta(property, content) {
    if (content === undefined || content === null || content === '') return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  function upsertCanonical(href) {
    if (!href) return;
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
    el.setAttribute('href', href);
  }

  function cleanCanonicalUrl(url) {
    try {
      const u = new URL(url || location.href, location.origin);
      u.hash = '';
      const p = u.pathname.replace(/\/+$/, '') || '/';
      const fixed = {
        '/index.html': '/',
        '/clubnieuws.html': '/clubnieuws',
        '/fotogalerij.html': '/fotogalerij',
        '/over-ons.html': '/over-ons',
        '/disciplines.html': '/disciplines',
        '/geschiedenis.html': '/geschiedenis',
        '/contact.html': '/contact',
        '/agenda.html': '/agenda'
      };
      if (p === '/pagina.html') {
        const slug = cleanSlug(u.searchParams.get('slug') || '');
        u.pathname = slug && slug !== 'home' ? '/' + slug : '/';
        u.search = '';
      } else if (p === '/clubnieuws.html' && u.searchParams.get('id')) {
        u.pathname = '/nieuws/' + encodeURIComponent(u.searchParams.get('id'));
        u.search = '';
      } else if (fixed[p]) {
        u.pathname = fixed[p];
        u.search = '';
      }
      return u.toString();
    } catch {
      return location.href;
    }
  }

  function applySeoMeta(seo) {
    if (!seo) return;
    const title = seo.title || document.title;
    const description = seo.description || '';
    const image = absoluteMediaUrl(seo.image || '');
    const canonical = cleanCanonicalUrl(seo.url || location.href);
    upsertMeta('description', description);
    upsertPropertyMeta('og:title', title);
    upsertPropertyMeta('og:description', description);
    upsertPropertyMeta('og:type', 'website');
    upsertPropertyMeta('og:url', canonical);
    upsertCanonical(canonical);
    if (image) upsertPropertyMeta('og:image', image);
    upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);
    if (image) upsertMeta('twitter:image', image);
    upsertMeta('robots', seo.noIndex ? 'noindex,nofollow' : 'index,follow');
  }

  function firstImageFromHtml(html) {
    const m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  async function loadNews() {
    const targets = [document.getElementById('news-list'), document.getElementById('home-news-list')].filter(Boolean);
    if (!targets.length) return;

    const newsId = new URLSearchParams(location.search).get('id') || newsIdFromPath();
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

  function newsIdFromPath() {
    const m = location.pathname.match(/^\/nieuws\/([^\/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : '';
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
      el.innerHTML = `<article class="card"><div class="card-content"><span class="badge">Clubnieuws</span><h3>Nieuwsbericht niet gevonden</h3><p>Het bericht bestaat niet meer of is niet gepubliceerd.</p><p><a class="btn dark" href="/clubnieuws">Terug naar clubnieuws</a></p></div></article>`;
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
      el.innerHTML = make(sorted.slice(0, compact ? (window.PDN_HOME_NEWS_COUNT || 3) : 999), compact);
    });
  }

  function renderNewsCard(n, compact, fromCms) {
    const title = n.title || n.name || 'Nieuwsbericht';
    const image = absoluteMediaUrl(n.cover_image || n.image || n.image_url || (Array.isArray(n.images) ? n.images[0] : ''));
    const rawText = n.summary || n.excerpt || stripHtml(n.content || n.body || '');
    const shortText = summary(stripHtml(rawText), compact ? 120 : 180);
    const href = fromCms && n.id ? `/nieuws/${encodeURIComponent(newsSlug(n))}` : '/clubnieuws';
    return `<a class="card news-card news-link" href="${escapeAttr(href)}">` +
      `${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy">` : ''}` +
      `<div class="card-content"><span class="badge">${escapeHtml(formatDate(newsDate(n)) || 'Clubnieuws')}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(shortText)}</p><span class="read-more">Lees bericht</span></div></a>`;
  }

  function renderNewsDetail(el, n, media) {
    const title = n.title || 'Nieuwsbericht';
    const image = absoluteMediaUrl(n.cover_image || n.image || n.image_url || '');
    const content = String(n.content || n.summary || '').trim();
    document.title = n.seo_title || `${title} | Clubnieuws | S.V. De Prins der Nederlanden`;
    applySeoMeta({
      title: n.seo_title || title,
      description: n.meta_description || n.summary || stripHtml(content).slice(0,160),
      image: n.og_image || image,
      url: location.href,
      noIndex: !!n.no_index
    });

    const extraPhotos = (media || []).map(m => {
      const url = absoluteMediaUrl(m.data_url || m.url || m.image_url || m.src || (m.id ? '/media-file/' + m.id : ''));
      const label = m.title || m.caption || m.filename || 'Foto bij nieuwsbericht';
      if (!url) return '';
      return `<a class="gallery-item" href="${escapeAttr(url)}" target="_blank" rel="noopener"><img src="${escapeAttr(url)}" alt="${escapeAttr(label)}" loading="lazy"><span>${escapeHtml(label)}</span></a>`;
    }).join('');

    el.innerHTML = `<article class="card news-detail-card">` +
      `${image ? `<img class="news-detail-cover" src="${escapeAttr(image)}" alt="${escapeAttr(title)}">` : ''}` +
      `<div class="card-content news-detail-content"><p><a href="/clubnieuws">← Terug naar clubnieuws</a></p><span class="badge">${escapeHtml(formatDate(newsDate(n)) || 'Clubnieuws')}</span><h2>${escapeHtml(title)}</h2><div class="cms-content">${content || '<p>Geen berichttekst ingevuld.</p>'}</div></div>` +
      `${extraPhotos ? `<div class="card-content"><h3>Foto’s bij dit bericht</h3><div class="gallery-grid news-media-grid">${extraPhotos}</div></div>` : ''}` +
    `</article>`;
    renderLinkedForm(el.querySelector('article'), n.form_id || n.linked_form_id || n.formId || n.form);
  }

  function newsSlug(n) {
    // Veilige fase: gebruik het ID zodat bestaande API-routes blijven werken.
    // Later kunnen we hier titel-slugs met redirects van maken.
    return n.id || cleanSlug(n.title || 'nieuws');
  }

  function newsDate(n) { return n.created_at || n.published_at || n.updated_at || n.date || ''; }

  function absoluteMediaUrl(url) {
    url = String(url || '');
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return CMS_API_DIRECT + url;
    return url;
  }


  async function loadHomeGallery() {
    const el = document.getElementById('home-gallery-list');
    if (!el) return;
    const section = document.querySelector('[data-home-gallery-section]');
    try {
      const d = await api('/media');
      let media = pickArray(d, ['media', 'images', 'files', 'items']).filter(isGalleryImage);
      const wantedAlbum = window.PDN_HOME_GALLERY_ALBUM || '';
      if (wantedAlbum) media = media.filter(m => String(m.album_id || 'algemeen') === String(wantedAlbum));
      const count = window.PDN_HOME_GALLERY_COUNT || 6;
      const title = window.PDN_HOME_GALLERY_TITLE || 'Foto’s van de vereniging';
      const intro = window.PDN_HOME_GALLERY_INTRO || 'Een korte impressie uit de mediabibliotheek van de vereniging.';
      if (section) {
        const h2 = section.querySelector('.section-title h2');
        const lead = section.querySelector('.section-title .lead');
        if (h2) h2.textContent = title;
        if (lead) lead.textContent = intro;
      }
      media = media.slice().sort((a,b)=>String(b.uploaded_at||b.created_at||b.updated_at||'').localeCompare(String(a.uploaded_at||a.created_at||a.updated_at||''))).slice(0, count);
      el.innerHTML = media.length ? renderGalleryFlatHtml(media) : '<p>Er zijn nog geen foto’s voor dit homepageblok.</p>';
    } catch (e) {
      el.innerHTML = '<p>Foto’s kunnen nog niet worden geladen.</p>';
    }
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
    if (!slug || slug === 'home') return '/';
    return `/${encodeURIComponent(slug)}`;
  }



  function eventDateLabel(e) {
    const start = formatDate(e.start_date || e.date || '');
    const end = e.end_date && e.end_date !== e.start_date ? ' t/m ' + formatDate(e.end_date) : '';
    const time = e.start_time ? ' · ' + e.start_time + (e.end_time ? ' - ' + e.end_time : '') : '';
    return (start || 'Datum volgt') + end + time;
  }
  function eventIsPast(e) {
    const d = e.end_date || e.start_date;
    if (!d) return false;
    return new Date(d + 'T23:59:59').getTime() < Date.now() - 86400000;
  }
  function eventIdFromPath() {
    const p = location.pathname.replace(/\/+$/, '');
    const m = p.match(/\/agenda\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  async function loadEvents() {
    const el = document.getElementById('events-list');
    if (!el) return;
    const id = new URLSearchParams(location.search).get('id') || eventIdFromPath();
    if (id) return loadEventDetail(id);
    try {
      const d = await api('/events?published=1');
      const items = pickArray(d, ['events','items']).slice();
      const upcoming = items.filter(e => !eventIsPast(e)).sort((a,b)=>String((a.start_date||'')+(a.start_time||'')).localeCompare(String((b.start_date||'')+(b.start_time||''))));
      const past = items.filter(e => eventIsPast(e)).sort((a,b)=>String((b.start_date||'')+(b.start_time||'')).localeCompare(String((a.start_date||'')+(a.start_time||''))));
      el.innerHTML = `<div class="agenda-section"><h2>Komende activiteiten</h2>${upcoming.length ? upcoming.map(eventCard).join('') : '<p class="lead">Er staan nog geen komende activiteiten in de agenda.</p>'}</div>` +
        (past.length ? `<div class="agenda-section"><h2>Afgelopen activiteiten</h2>${past.slice(0,6).map(eventCard).join('')}</div>` : '');
    } catch (err) {
      el.innerHTML = `<article class="card"><div class="card-content"><h3>Agenda kon niet worden geladen</h3><p>Probeer het later opnieuw.</p></div></article>`;
    }
  }
  function eventCard(e) {
    const href = e.id ? `/agenda/${encodeURIComponent(e.id)}` : '/agenda';
    const img = e.cover_image ? `<img src="${escapeAttr(e.cover_image)}" alt="${escapeAttr(e.title||'Agenda')}" loading="lazy">` : '';
    return `<a class="card event-card" href="${escapeAttr(href)}">${img}<div class="card-content"><span class="badge">${escapeHtml(eventDateLabel(e))}</span><h3>${escapeHtml(e.title||'Evenement')}</h3><p>${escapeHtml(e.summary||e.location||'')}</p>${e.location?`<p><strong>Locatie:</strong> ${escapeHtml(e.location)}</p>`:''}<span class="read-more">Bekijk activiteit</span></div></a>`;
  }
  async function loadEventDetail(id) {
    const el = document.getElementById('events-list');
    if (!el) return;
    try {
      const d = await api('/events/' + encodeURIComponent(id));
      const e = pickObject(d, ['item','event']);
      if (!e || e.status !== 'published') throw new Error('Niet gevonden');
      const content = e.content || `<p>${escapeHtml(e.summary||'')}</p>`;
      const linkedFormId = e.form_id || e.linked_form_id || e.formId || e.form;
      el.innerHTML = `<article class="card news-detail-card event-detail-card">${e.cover_image?`<img class="news-detail-cover" src="${escapeAttr(e.cover_image)}" alt="${escapeAttr(e.title||'Agenda')}">`:''}<div class="card-content news-detail-content"><p><a href="/agenda">← Terug naar agenda</a></p><span class="badge">${escapeHtml(eventDateLabel(e))}</span><h2>${escapeHtml(e.title||'Evenement')}</h2>${e.location?`<p><strong>Locatie:</strong> ${escapeHtml(e.location)}</p>`:''}${e.contact_person?`<p><strong>Contactpersoon:</strong> ${escapeHtml(e.contact_person)}</p>`:''}<div class="cms-content">${content}</div>${(e.signup_enabled && !linkedFormId)?`<div class="notice"><h3>Aanmelden</h3><p>Voor deze activiteit is aanmelden mogelijk. Neem contact op met de vereniging.</p>${e.max_participants?`<p>Maximaal aantal deelnemers: ${Number(e.max_participants)}</p>`:''}</div>`:''}</div></article>`;
      renderLinkedForm(el.querySelector('article'), linkedFormId);
    } catch (err) {
      el.innerHTML = `<article class="card"><div class="card-content"><h2>Activiteit niet gevonden</h2><p>Deze activiteit bestaat niet of is nog niet gepubliceerd.</p><p><a class="btn dark" href="/agenda">Terug naar agenda</a></p></div></article>`;
    }
  }

  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    const msg = document.getElementById('contactFormMsg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form).entries());
      if (msg) msg.textContent = 'Bericht wordt verstuurd...';
      if (btn) btn.disabled = true;
      try {
        await apiPost('/contact-messages', data);
        form.reset();
        if (msg) msg.textContent = 'Bedankt, uw bericht is verzonden.';
      } catch (err) {
        if (msg) msg.textContent = err.message || 'Versturen is mislukt. Probeer het later opnieuw.';
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  // V4-layout herstel: header, merknaam, navigatie en footer blijven uit de HTML/CSS.
  // Sprint 3 maakt pagina-inhoud wel dynamisch: bestaande pagina's worden vervangen door
  // CMS-inhoud zodra die gepubliceerd en gevuld is. Nieuwe CMS-pagina's zijn bereikbaar via nette URL's zoals /bestuur, met oude URL's als fallback.
  loadSettings();
  loadMenu();
  loadHomepageSettings();
  loadCmsPage();
  loadNews();
  loadHomeGallery();
  loadGallery();
  loadEvents();
  initContactForm();
})();
