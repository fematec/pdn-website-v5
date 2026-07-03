const API = 'https://pdn-api.info-fematec.workers.dev';
const $ = (sel) => document.querySelector(sel);

async function api(path){
  const res = await fetch(API + path, { headers: { 'Accept':'application/json' }});
  const data = await res.json().catch(() => ({}));
  if(!res.ok || data.ok === false) throw new Error(data.error || 'API fout');
  return data;
}
function esc(s){return String(s ?? '').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function plain(html, len=140){const d=document.createElement('div');d.innerHTML=html||'';return (d.textContent||'').trim().slice(0,len);}
function mediaUrl(m){return m?.data_url || (m?.id ? API + '/media-file/' + m.id : '');}
function pageLink(slug){return slug === 'home' ? 'index.html' : `page.html?slug=${encodeURIComponent(slug)}`;}

async function loadBase(){
  try{
    const [settingsData, menuData] = await Promise.all([api('/settings'), api('/menus')]);
    const s = settingsData.settings || {};
    document.querySelectorAll('#siteName,#heroTitle,#footerName').forEach(el=>{ if(el) el.textContent = s.site_name || 'De Prins der Nederlanden'; });
    const footer = [s.address, s.phone, s.contact_email].filter(Boolean).join(' · ');
    document.querySelectorAll('#footerContact,#contactBlock').forEach(el=>{ if(el) el.textContent = footer || 'Contactgegevens nog niet ingevuld.'; });
    renderMenu((menuData.menus || []).filter(m => m.area === 'main' && Number(m.active) !== 0));
  }catch(e){
    const nav = $('#mainMenu'); if(nav) nav.innerHTML = `<span class="muted">Menu kon niet laden</span>`;
    console.error(e);
  }
  const toggle = $('#menuToggle'); if(toggle) toggle.onclick = () => $('#mainMenu')?.classList.toggle('open');
}
function renderMenu(items){
  const nav = $('#mainMenu'); if(!nav) return;
  const top = items.filter(i => !i.parent_id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  nav.innerHTML = top.map(item => {
    const href = item.type === 'url' && item.url ? item.url : pageLink(item.page_slug || 'home');
    const target = item.new_tab ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${target}>${esc(item.label || item.page_title || 'Menu')}</a>`;
  }).join('') || `<a href="index.html">Home</a>`;
}

async function loadHome(){
  const home = $('#homePageContent');
  const latest = $('#latestNews');
  if(home){
    try{ const p = await api('/pages/home'); home.innerHTML = p.item?.content || '<p>Welkom bij De Prins der Nederlanden.</p>'; }
    catch(e){ home.innerHTML = '<p>Welkom bij De Prins der Nederlanden.</p>'; }
  }
  if(latest){
    try{
      const d = await api('/news');
      const news = (d.news || []).filter(n=>n.status === 'published').slice(0,3);
      latest.innerHTML = news.length ? news.map(cardNews).join('') : '<p class="muted">Nog geen clubnieuws gepubliceerd.</p>';
    }catch(e){ latest.innerHTML = '<p class="muted">Clubnieuws kon niet laden.</p>'; }
  }
}
function cardNews(n){
  const img = n.cover_image ? `<img src="${n.cover_image}" alt="">` : '';
  return `<article class="card">${img}<h3>${esc(n.title)}</h3><p>${esc(n.summary || plain(n.content))}</p><a href="clubnieuws.html?id=${encodeURIComponent(n.id)}">Lees meer</a></article>`;
}

async function loadPage(){
  const el = $('#pageContent'); if(!el) return;
  const slug = new URLSearchParams(location.search).get('slug') || 'home';
  try{
    const d = await api('/pages/' + encodeURIComponent(slug));
    const p = d.item;
    document.title = `${p.seo_title || p.title} - De Prins der Nederlanden`;
    el.innerHTML = `<h1>${esc(p.title)}</h1>${p.content || '<p></p>'}`;
  }catch(e){ el.innerHTML = `<h1>Pagina niet gevonden</h1><p class="muted">Deze pagina kon niet worden geladen.</p>`; }
}

async function loadNews(){
  const el = $('#newsList'); if(!el) return;
  const id = new URLSearchParams(location.search).get('id');
  try{
    if(id){
      const d = await api('/news/' + encodeURIComponent(id));
      const n = d.item;
      let extra = '';
      try{ const md = await api('/news/' + encodeURIComponent(id) + '/media'); extra = (md.media||[]).map(m=>`<figure><img src="${mediaUrl(m)}" alt="${esc(m.alt_text||m.filename||'')}"></figure>`).join(''); }catch{}
      el.className='content-card';
      el.innerHTML = `${n.cover_image?`<img src="${n.cover_image}" alt="">`:''}<h1>${esc(n.title)}</h1><p><strong>${esc(n.summary||'')}</strong></p>${n.content||''}${extra}`;
    }else{
      const d = await api('/news');
      const news = (d.news || []).filter(n=>n.status === 'published');
      el.innerHTML = news.length ? news.map(cardNews).join('') : '<p class="muted">Nog geen clubnieuws gepubliceerd.</p>';
    }
  }catch(e){ el.innerHTML = '<p class="muted">Clubnieuws kon niet laden.</p>'; }
}

async function loadGallery(){
  const el = $('#gallery'); if(!el) return;
  try{
    const d = await api('/media');
    const items = (d.media || []).filter(m => String(m.mime_type||'').startsWith('image/') || m.data_url);
    el.innerHTML = items.length ? items.map(m=>`<a href="${mediaUrl(m)}" target="_blank"><img src="${mediaUrl(m)}" alt="${esc(m.alt_text||m.title||m.filename||'')}"></a>`).join('') : '<p class="muted">Nog geen foto\'s.</p>';
  }catch(e){ el.innerHTML = '<p class="muted">Fotogalerij kon niet laden.</p>'; }
}

loadBase();
loadHome();
loadPage();
loadNews();
loadGallery();
