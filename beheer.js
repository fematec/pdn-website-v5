(function(){
  const $ = id => document.getElementById(id);
  const setupPanel=$('setupPanel'), dashboard=$('dashboard');
  const cfgKey='pdn_github_cms_config_v2';
  const getCfg=()=>{try{return JSON.parse(localStorage.getItem(cfgKey)||'null')}catch(e){return null}};
  const setCfg=c=>localStorage.setItem(cfgKey,JSON.stringify(c));

  function show(){
    const c=getCfg();
    if(c&&c.owner&&c.repo&&c.token){setupPanel.classList.add('hidden');dashboard.classList.remove('hidden');loadExisting();}
    else{setupPanel.classList.remove('hidden');dashboard.classList.add('hidden');}
  }

  function initDates(){
    const today=new Date().toISOString().slice(0,10);
    ['newsDate','eventDate'].forEach(id=>{if($(id)) $(id).value=today;});
  }
  initDates();

  if($('saveConfig')) $('saveConfig').addEventListener('click',()=>{
    const c={owner:$('ghOwner').value.trim(),repo:$('ghRepo').value.trim(),branch:$('ghBranch').value.trim()||'main',token:$('ghToken').value.trim()};
    if(!c.owner||!c.repo||!c.token){$('setupMsg').textContent='Vul eigenaar, repository en token in.';return;}
    setCfg(c); show();
  });
  if($('logoutBtn')) $('logoutBtn').addEventListener('click',()=>{localStorage.removeItem(cfgKey); location.reload();});

  document.querySelectorAll('.admin-tabs button').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.admin-tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    const el=$('tab-'+btn.dataset.tab); if(el) el.classList.add('active');
  }));

  async function api(path, opts={}){
    const c=getCfg();
    const r=await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}${opts.ref?`?ref=${encodeURIComponent(opts.ref)}`:''}`,{
      method:opts.method||'GET',
      headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28'},
      body:opts.body?JSON.stringify(opts.body):undefined
    });
    if(!r.ok){throw new Error((await r.text()).slice(0,500));}
    return await r.json();
  }
  async function getFile(path, fallback){
    try{const f=await api(path,{ref:getCfg().branch}); const text=decodeUtf8Base64(f.content); return {data:JSON.parse(text),sha:f.sha};}
    catch(e){return {data:fallback,sha:null};}
  }
  async function putFile(path, content, message, sha){
    const c=getCfg(); const body={message,content:encodeUtf8Base64(content),branch:c.branch}; if(sha) body.sha=sha; return api(path,{method:'PUT',body});
  }
  async function uploadFile(file, folder){
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const safe=slug(file.name.replace(/\.[^.]+$/,''));
    const name=`${folder}/${new Date().toISOString().slice(0,10)}-${Date.now()}-${safe}.${ext}`;
    const base64=await fileToBase64(file);
    await putFileRawBase64(name, base64, `Upload ${name}`);
    return name;
  }
  async function putFileRawBase64(path, base64, message, sha){
    const c=getCfg(); const body={message,content:base64,branch:c.branch}; if(sha) body.sha=sha; return api(path,{method:'PUT',body});
  }
  async function saveJson(path, arr, sha, msg){await putFile(path, JSON.stringify(arr,null,2), msg, sha);}

  if($('saveNews')) $('saveNews').addEventListener('click',async()=>{
    const msg=$('newsMsg'); msg.textContent='Bezig met publiceren...';
    try{
      const title=$('newsTitle').value.trim(), date=$('newsDate').value, body=$('newsBody').value.trim();
      if(!title||!body) throw new Error('Vul minimaal titel en tekst in.');
      const files=[...$('newsImages').files]; const images=[];
      for(const f of files){images.push(await uploadFile(f,'uploads/news'));}
      const f=await getFile('data/news.json',[]);
      f.data.unshift({id:uuid(),title,date,body,images,created_at:new Date().toISOString()});
      await saveJson('data/news.json',f.data,f.sha,`Nieuws toegevoegd: ${title}`);
      msg.textContent='Nieuws gepubliceerd. Cloudflare publiceert de site nu automatisch opnieuw.';
      $('newsTitle').value=''; $('newsBody').value=''; $('newsImages').value=''; loadExisting();
    }catch(e){msg.textContent='Fout: '+e.message;}
  });

  if($('saveGallery')) $('saveGallery').addEventListener('click',async()=>{
    const msg=$('galleryMsg'); msg.textContent='Bezig met uploaden...';
    try{
      const album=$('galleryAlbum').value.trim()||'Vereniging', title=$('galleryTitle').value.trim()||album;
      const files=[...$('galleryImages').files]; if(!files.length) throw new Error('Kies minimaal één foto.');
      const f=await getFile('data/gallery.json',[]);
      for(const file of files){const image_url=await uploadFile(file,'uploads/gallery'); f.data.unshift({id:uuid(),title,album,image_url,created_at:new Date().toISOString()});}
      await saveJson('data/gallery.json',f.data,f.sha,`Galerij bijgewerkt: ${album}`);
      msg.textContent='Foto’s toegevoegd. Cloudflare publiceert de site nu automatisch opnieuw.';
      $('galleryImages').value=''; loadExisting();
    }catch(e){msg.textContent='Fout: '+e.message;}
  });

  if($('saveEvent')) $('saveEvent').addEventListener('click',async()=>{
    const msg=$('eventMsg'); msg.textContent='Bezig met publiceren...';
    try{
      const title=$('eventTitle').value.trim(), date=$('eventDate').value, time=$('eventTime').value.trim(), location=$('eventLocation').value.trim(), body=$('eventBody').value.trim();
      if(!title) throw new Error('Vul minimaal een titel in.');
      const f=await getFile('data/events.json',[]);
      f.data.unshift({id:uuid(),title,date,time,location,body,created_at:new Date().toISOString()});
      await saveJson('data/events.json',f.data,f.sha,`Agenda-item toegevoegd: ${title}`);
      msg.textContent='Agenda-item gepubliceerd. Cloudflare publiceert de site nu automatisch opnieuw.';
      ['eventTitle','eventTime','eventLocation','eventBody'].forEach(id=>$(id).value=''); loadExisting();
    }catch(e){msg.textContent='Fout: '+e.message;}
  });

  if($('saveDownload')) $('saveDownload').addEventListener('click',async()=>{
    const msg=$('downloadMsg'); msg.textContent='Bezig met uploaden...';
    try{
      const title=$('downloadTitle').value.trim(), description=$('downloadDescription').value.trim();
      if(!title) throw new Error('Vul minimaal een titel in.');
      const file=$('downloadFile').files[0]; let file_url='';
      if(file) file_url=await uploadFile(file,'uploads/downloads');
      const f=await getFile('data/downloads.json',[]);
      f.data.unshift({id:uuid(),title,description,file_url,created_at:new Date().toISOString()});
      await saveJson('data/downloads.json',f.data,f.sha,`Download toegevoegd: ${title}`);
      msg.textContent='Download toegevoegd. Cloudflare publiceert de site nu automatisch opnieuw.';
      $('downloadTitle').value=''; $('downloadDescription').value=''; $('downloadFile').value=''; loadExisting();
    }catch(e){msg.textContent='Fout: '+e.message;}
  });

  async function loadExisting(){
    try{
      const n=await getFile('data/news.json',[]);
      if($('existingNews')) $('existingNews').innerHTML='<h3>Bestaand nieuws</h3>'+rowList(n.data, x=>`<strong>${escapeHtml(x.title)}</strong><br><small>${escapeHtml(x.date||'')}</small>`,'Nog geen nieuws.');
      const g=await getFile('data/gallery.json',[]);
      if($('existingGallery')) $('existingGallery').innerHTML='<h3>Laatste galerijfoto’s</h3>'+rowList(g.data, x=>`<strong>${escapeHtml(x.title||'Foto')}</strong><br><small>${escapeHtml(x.album||'')}</small>`,'Nog geen foto’s.');
      const e=await getFile('data/events.json',[]);
      if($('existingEvents')) $('existingEvents').innerHTML='<h3>Bestaande agenda-items</h3>'+rowList(e.data, x=>`<strong>${escapeHtml(x.title)}</strong><br><small>${escapeHtml(x.date||'')}</small>`,'Nog geen agenda-items.');
      const d=await getFile('data/downloads.json',[]);
      if($('existingDownloads')) $('existingDownloads').innerHTML='<h3>Bestaande downloads</h3>'+rowList(d.data, x=>`<strong>${escapeHtml(x.title)}</strong><br><small>${escapeHtml(x.file_url||'Geen bestand')}</small>`,'Nog geen downloads.');
    }catch(e){}
  }
  function rowList(arr, render, empty){return ((arr||[]).slice(0,8).map(x=>`<div class="item-row">${render(x)}</div>`).join('')||`<p>${empty}</p>`);}
  function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]); r.onerror=rej; r.readAsDataURL(file);});}
  function encodeUtf8Base64(str){return btoa(unescape(encodeURIComponent(str)));}
  function decodeUtf8Base64(str){return decodeURIComponent(escape(atob(String(str).replace(/\s/g,''))));}
  function slug(s){return String(s||'bestand').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'bestand';}
  function uuid(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
  function escapeHtml(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  show();
})();
