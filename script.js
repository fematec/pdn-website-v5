(function(){
  const API = 'https://pdn-api.info-fematec.workers.dev';

  const btn = document.querySelector('.menu-btn');
  const nav = document.querySelector('.nav');
  if (btn && nav) btn.addEventListener('click', () => nav.classList.toggle('open'));

  async function api(path){
    const r = await fetch(API + path, {cache:'no-store'});
    const data = await r.json().catch(() => ({ok:false,error:'Geen antwoord'}));
    if(!r.ok || data.ok === false) throw new Error(data.error || 'API fout');
    return data;
  }

  function esc(s){return String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function attr(s){return esc(s).replace(/`/g,'&#96;');}
  function strip(s){const d=document.createElement('div'); d.innerHTML=String(s||''); return d.textContent||d.innerText||'';}
  function summary(s,n){s=strip(s); return s.length>n?s.slice(0,n-1)+'…':s;}
  function mediaUrl(m){return m?.data_url || (m?.id ? API + '/media-file/' + m.id : '');}
  function slugFromLocation(){
    const params = new URLSearchParams(location.search);
    if(params.get('slug')) return params.get('slug');
    const file = location.pathname.split('/').pop() || 'index.html';
    if(file === 'index.html' || file === '') return 'home';
    return file.replace(/\.html$/,'');
  }

  async function loadSettings(){
    try{
      const d = await api('/public/settings');
      const s = d.settings || {};
      document.querySelectorAll('.brand strong').forEach(x=>x.textContent = s.site_name || 'De Prins der Nederlanden');
      document.querySelectorAll('footer.footer p').forEach(f=>{
        const email = s.contact_email || 'info@deprinsdernederlanden.nl';
        const address = s.address || 'Molenstraat 7, Vaassen';
        f.innerHTML = `© 2026 S.V. ${esc(s.site_name || 'De Prins der Nederlanden')} · ${esc(address)} · <a href="mailto:${attr(email)}">${esc(email)}</a>`;
      });
    }catch(e){}
  }

  async function loadMenu(){
    const nav = document.querySelector('nav.nav');
    if(!nav) return;
    try{
      const d = await api('/public/menus?area=main');
      const items = (d.menus || []).filter(x => Number(x.active) !== 0);
      if(!items.length) return;
      const currentSlug = slugFromLocation();
      nav.innerHTML = items.map(i=>{
        const href = i.type === 'url' && i.url ? i.url : (i.page_slug === 'home' ? 'index.html' : `page.html?slug=${encodeURIComponent(i.page_slug || '')}`);
        const active = (i.page_slug && i.page_slug === currentSlug) || (currentSlug === 'home' && i.page_slug === 'home');
        return `<a href="${attr(href)}" class="${active?'active':''}" ${i.new_tab?'target="_blank" rel="noopener"':''}>${esc(i.label || i.page_title || 'Menu')}</a>`;
      }).join('');
    }catch(e){}
  }

  async function loadNews(){
    const targets=[document.getElementById('news-list'), document.getElementById('home-news-list')].filter(Boolean);
    if(!targets.length) return;
    try{
      const d=await api('/public/news');
      const sorted=(d.news||[]).filter(n=>n.status==='published').sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
      const make=(items, compact=false)=>{
        if(!items.length) return '<article class="card"><div class="card-content"><span class="badge">Nieuws</span><h3>Nog geen nieuwsberichten</h3><p>Nieuwe berichten uit het CMS verschijnen hier automatisch.</p></div></article>';
        return items.map(n=>`<article class="card news-card">${n.cover_image?`<img src="${attr(n.cover_image)}" alt="${attr(n.title)}">`:''}<div class="card-content"><span class="badge">${esc(n.created_at?new Date(n.created_at).toLocaleDateString('nl-NL'):'Clubnieuws')}</span><h3>${esc(n.title)}</h3><p>${esc(compact?summary(n.summary||n.content,150):(n.summary||summary(n.content,260)))}</p>${!compact?`<div class="news-content">${n.content||''}</div>`:''}</div></article>`).join('');
      };
      targets.forEach(el=>{el.innerHTML=make(sorted.slice(0, el.id==='home-news-list'?3:999), el.id==='home-news-list');});
    }catch(e){targets.forEach(el=>{el.innerHTML='<article class="card"><div class="card-content"><h3>Nieuws kan nog niet worden geladen</h3><p>Controleer de API-koppeling.</p></div></article>';});}
  }

  async function loadGallery(){
    const el=document.getElementById('gallery-list'); if(!el) return;
    try{
      const d=await api('/public/media');
      const media=(d.media||[]).filter(m => (m.mime_type||'').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(m.filename||''));
      if(!media.length){el.innerHTML='<p>Er staan nog geen foto’s in de galerij. Foto’s uit het CMS verschijnen hier automatisch.</p>';return;}
      el.innerHTML=media.map(m=>`<a class="gallery-item" href="${attr(mediaUrl(m))}" target="_blank"><img src="${attr(mediaUrl(m))}" alt="${attr(m.alt_text||m.title||m.filename||'Verenigingsfoto')}"><span>${esc(m.title||m.caption||m.filename||'Verenigingsfoto')}</span></a>`).join('');
    }catch(e){el.innerHTML='<p>Galerij kan nog niet worden geladen. Controleer de API-koppeling.</p>';}
  }

  async function loadDynamicPage(){
    const el=document.getElementById('cms-page-content');
    if(!el) return;
    const slug=slugFromLocation();
    try{
      const d=await api('/public/page/'+encodeURIComponent(slug));
      const p=d.item;
      document.title = `${p.title} | S.V. De Prins der Nederlanden`;
      const h1=document.getElementById('cms-page-title'); if(h1) h1.textContent=p.title;
      const lead=document.getElementById('cms-page-lead'); if(lead) lead.textContent=p.seo_description || '';
      el.innerHTML=p.content || '<p>Deze pagina heeft nog geen inhoud.</p>';
    }catch(e){
      el.innerHTML='<p>Deze pagina kon niet uit het CMS worden geladen.</p>';
    }
  }

  loadSettings();
  loadMenu();
  loadNews();
  loadGallery();
  loadDynamicPage();
})();
