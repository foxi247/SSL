/* Halachi Admin — fixed */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

let ADMIN_PASS = '';
let DB = null;

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove('is-show'), 3200);
}

function esc(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

async function apiGet(url){
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), {
    headers: ADMIN_PASS ? { 'x-admin-password': ADMIN_PASS } : {}
  });
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function apiPost(url, data){
  const res = await fetch(url, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      ...(ADMIN_PASS ? { 'x-admin-password': ADMIN_PASS } : {})
    },
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function apiDel(url){
  const res = await fetch(url, {
    method:'DELETE',
    headers: ADMIN_PASS ? { 'x-admin-password': ADMIN_PASS } : {}
  });
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function uploadImage(file){
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/upload', { method:'POST', body: fd });
  const json = await res.json().catch(()=> ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || 'Upload failed');
  return json.url;
}

function showView(name){
  $$('[data-view]').forEach(v => v.style.display = v.dataset.view === name ? '' : 'none');
  $$('#sideNav a[data-page]').forEach(a => a.classList.toggle('is-active', a.dataset.page === name));
}

function modalOpen(title, html){
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.add('is-open');
}
function modalClose(){
  $('#modal').classList.remove('is-open');
}

function fmtPrice(n, cur='₽'){
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return new Intl.NumberFormat('ru-RU').format(v) + ' ' + cur;
}

function setHotelForm(h){
  $('#hName').value = h.name || '';
  $('#hPhone').value = h.phone || '';
  $('#hEmail').value = h.email || '';
  $('#hAddress').value = h.address || '';
  $('#hCheckIn').value = h.check_in || '';
  $('#hCheckOut').value = h.check_out || '';
  $('#hTagline').value = h.tagline || '';
  $('#hDesc').value = h.description || '';
  $('#hAbout').value = h.about || '';
  $('#hHero').value = h.hero_image || '';
  $('#hHeroPreview').src = h.hero_image || '';
  $('#visCount').value = Number(h.visitor_count || 0);
}

function renderDashboard(){
  const rooms = DB?.rooms || [];
  const tours = DB?.tours || [];
  const bookings = DB?.bookings || [];

  $('#kpiRooms').textContent = rooms.length;
  $('#kpiTours').textContent = tours.length;
  $('#kpiBookings').textContent = bookings.length;

  const top = bookings.slice(0, 5);
  $('#recentBookings').innerHTML = top.length
    ? top.map(b => `• <b>${esc(b.name)}</b> — ${esc(b.phone)} <span class="small">(${esc(b.status)})</span>`).join('<br>')
    : 'Пока нет заявок.';
}

function renderRooms(){
  const rows = (DB?.rooms || []).slice().sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(r => `
    <tr>
      <td><b>${esc(r.name)}</b><div class="small">${esc(r.id)}</div></td>
      <td>${esc('от ' + fmtPrice(r.price_from, r.currency || '₽'))}</td>
      <td>до ${Number(r.max_guests || 2)}</td>
      <td>
        <div class="row-actions">
          <button class="btn" data-edit-room="${esc(r.id)}">Редакт.</button>
          <button class="btn" data-del-room="${esc(r.id)}">Удалить</button>
        </div>
      </td>
    </tr>
  `).join('');
  $('#roomsTable').innerHTML = rows || '<tr><td colspan="4" class="small">Нет номеров</td></tr>';
}

function renderTours(){
  const rows = (DB?.tours || []).slice().sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(t => `
    <tr>
      <td><b>${esc(t.title)}</b><div class="small">${esc(t.id)}</div></td>
      <td>${esc(fmtPrice(t.price, t.currency || '₽'))}</td>
      <td>${esc(t.category || 'all')}</td>
      <td>
        <div class="row-actions">
          <button class="btn" data-edit-tour="${esc(t.id)}">Редакт.</button>
          <button class="btn" data-del-tour="${esc(t.id)}">Удалить</button>
        </div>
      </td>
    </tr>
  `).join('');
  $('#toursTable').innerHTML = rows || '<tr><td colspan="4" class="small">Нет туров</td></tr>';
}

function renderCategories(){
  const rows = (DB?.categories || []).slice().sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(c => `
    <tr>
      <td style="width:70px">${esc(c.icon || '✨')}</td>
      <td><b>${esc(c.name)}</b><div class="small">${esc(c.id)}</div></td>
      <td>
        <div class="row-actions">
          <button class="btn" data-edit-cat="${esc(c.id)}">Редакт.</button>
          <button class="btn" data-del-cat="${esc(c.id)}">Удалить</button>
        </div>
      </td>
    </tr>
  `).join('');
  $('#catsTable').innerHTML = rows || '<tr><td colspan="3" class="small">Нет категорий</td></tr>';
}

function renderBookings(){
  const rows = (DB?.bookings || []).map(b => `
    <tr>
      <td>${esc(String(b.created_at || '').slice(0, 10))}</td>
      <td><b>${esc(b.name)}</b></td>
      <td>${esc(b.phone)}</td>
      <td>${esc((b.check_in||'') + ' → ' + (b.check_out||''))}</td>
      <td>${esc(b.status || 'new')}</td>
      <td>
        <div class="row-actions">
          <button class="btn" data-status="confirmed" data-bid="${esc(b.id)}">Подтвердить</button>
          <button class="btn" data-status="cancelled" data-bid="${esc(b.id)}">Отмена</button>
        </div>
      </td>
    </tr>
  `).join('');
  $('#bookingsTable').innerHTML = rows || '<tr><td colspan="6" class="small">Нет заявок</td></tr>';
}

function roomForm(room){
  const r = room || { id:'', name:'', short_name:'', description:'', price_from:0, currency:'₽', size:'', beds:'', max_guests:2, features:[], images:[], popular:false, sort_order:0 };
  const feat = (r.features || []).join(', ');
  const img = (r.images || []).join('\n');

  return `
  <div class="grid" style="grid-template-columns:repeat(2,1fr)">
    <div><div class="small">ID</div><input class="input" id="rfId" value="${esc(r.id)}" placeholder="room-..."/></div>
    <div><div class="small">Название *</div><input class="input" id="rfName" value="${esc(r.name)}"/></div>
    <div><div class="small">Короткое</div><input class="input" id="rfShort" value="${esc(r.short_name)}"/></div>
    <div><div class="small">Цена от</div><input class="input" id="rfPrice" type="number" min="0" value="${Number(r.price_from||0)}"/></div>
    <div><div class="small">Размер (м²)</div><input class="input" id="rfSize" value="${esc(r.size||'')}"/></div>
    <div><div class="small">Кровати</div><input class="input" id="rfBeds" value="${esc(r.beds||'')}"/></div>
    <div><div class="small">Макс. гостей</div><input class="input" id="rfGuests" type="number" min="1" value="${Number(r.max_guests||2)}"/></div>
    <div><div class="small">Сортировка</div><input class="input" id="rfSort" type="number" value="${Number(r.sort_order||0)}"/></div>
  </div>
  <div style="height:10px"></div>
  <div><div class="small">Описание</div><textarea id="rfDesc">${esc(r.description||'')}</textarea></div>
  <div style="height:10px"></div>
  <div><div class="small">Фичи (через запятую)</div><input class="input" id="rfFeat" value="${esc(feat)}"/></div>
  <div style="height:10px"></div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div>
      <div class="small">Картинки (каждая с новой строки URL)</div>
      <textarea id="rfImgs" placeholder="https://...">${esc(img)}</textarea>
      <div class="small" style="margin-top:8px">или загрузить:</div>
      <input class="input" id="rfFile" type="file" accept="image/*" />
    </div>
    <div>
      <div class="small">Популярный</div>
      <select id="rfPop">
        <option value="false" ${r.popular ? '' : 'selected'}>Нет</option>
        <option value="true" ${r.popular ? 'selected' : ''}>Да</option>
      </select>
      <div style="height:10px"></div>
      <button class="btn btn--primary" id="rfSave">Сохранить</button>
    </div>
  </div>`;
}

function tourForm(tour, categories){
  const t = tour || { id:'', title:'', short_desc:'', description:'', price:0, currency:'₽', duration:'', location:'', category:'all', featured:false, schedule:[], images:[], sort_order:0 };
  const sched = (t.schedule || []).join(', ');
  const img = (t.images || []).join('\n');
  const catOptions = (categories||[]).map(c => `<option value="${esc(c.id)}" ${c.id===t.category?'selected':''}>${esc((c.icon||'✨')+' '+c.name)}</option>`).join('');

  return `
  <div class="grid" style="grid-template-columns:repeat(2,1fr)">
    <div><div class="small">ID</div><input class="input" id="tfId" value="${esc(t.id)}" placeholder="tour-..."/></div>
    <div><div class="small">Название *</div><input class="input" id="tfTitle" value="${esc(t.title)}"/></div>
    <div><div class="small">Цена</div><input class="input" id="tfPrice" type="number" min="0" value="${Number(t.price||0)}"/></div>
    <div><div class="small">Категория</div><select id="tfCat">${catOptions}</select></div>
    <div><div class="small">Длительность</div><input class="input" id="tfDur" value="${esc(t.duration||'')}"/></div>
    <div><div class="small">Локация</div><input class="input" id="tfLoc" value="${esc(t.location||'')}"/></div>
    <div><div class="small">Сортировка</div><input class="input" id="tfSort" type="number" value="${Number(t.sort_order||0)}"/></div>
    <div><div class="small">Витрина (featured)</div>
      <select id="tfFeat">
        <option value="false" ${t.featured ? '' : 'selected'}>Нет</option>
        <option value="true" ${t.featured ? 'selected' : ''}>Да</option>
      </select>
    </div>
  </div>
  <div style="height:10px"></div>
  <div><div class="small">Короткое описание</div><input class="input" id="tfShort" value="${esc(t.short_desc||'')}"/></div>
  <div style="height:10px"></div>
  <div><div class="small">Полное описание</div><textarea id="tfDesc">${esc(t.description||'')}</textarea></div>
  <div style="height:10px"></div>
  <div><div class="small">Расписание (дни через запятую)</div><input class="input" id="tfSched" value="${esc(sched)}"/></div>
  <div style="height:10px"></div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div>
      <div class="small">Картинки (каждая с новой строки URL)</div>
      <textarea id="tfImgs" placeholder="https://...">${esc(img)}</textarea>
      <div class="small" style="margin-top:8px">или загрузить:</div>
      <input class="input" id="tfFile" type="file" accept="image/*" />
    </div>
    <div>
      <button class="btn btn--primary" id="tfSave">Сохранить</button>
    </div>
  </div>`;
}

function catForm(cat){
  const c = cat || { id:'', name:'', icon:'✨', sort_order:0 };
  return `
  <div class="grid" style="grid-template-columns:repeat(2,1fr)">
    <div><div class="small">ID</div><input class="input" id="cfId" value="${esc(c.id)}" placeholder="cat-..."/></div>
    <div><div class="small">Название *</div><input class="input" id="cfName" value="${esc(c.name)}"/></div>
    <div><div class="small">Иконка</div><input class="input" id="cfIcon" value="${esc(c.icon||'✨')}"/></div>
    <div><div class="small">Сортировка</div><input class="input" id="cfSort" type="number" value="${Number(c.sort_order||0)}"/></div>
  </div>
  <div style="height:12px"></div>
  <button class="btn btn--primary" id="cfSave">Сохранить</button>`;
}

async function refreshAll(){
  DB = await apiGet('/api/data');
  setHotelForm(DB.hotel || {});
  renderDashboard();
  renderRooms();
  renderTours();
  renderCategories();
  renderBookings();
}

async function init(){
  // navigation
  $('#sideNav').addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-page]');
    if (!a) return;
    e.preventDefault();
    showView(a.dataset.page);
    history.replaceState(null,'',a.getAttribute('href'));
  });

  // modal
  $('#modalClose').addEventListener('click', modalClose);
  $('#modal').addEventListener('click', (e)=>{ if (e.target.id === 'modal') modalClose(); });

  // login
  $('#btnLogin').addEventListener('click', async ()=>{
    ADMIN_PASS = $('#adminPass').value.trim();
    if (!ADMIN_PASS) return toast('Введите пароль');
    try{
      await refreshAll();
      toast('Ок, вошли');
    }catch(err){
      toast(err.message || 'Ошибка');
    }
  });

  // backup
  $('#btnBackup').addEventListener('click', ()=>{
    if (!ADMIN_PASS) return toast('Сначала войдите');
    const a = document.createElement('a');
    a.href = '/api/admin/backup';
    // for auth: open in new tab doesn't send header; so use fetch + blob
    fetch('/api/admin/backup', { headers: { 'x-admin-password': ADMIN_PASS }}).then(r=>r.blob()).then(blob=>{
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = 'backup.json';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 4000);
    }).catch(()=>toast('Не удалось скачать бэкап'));
  });

  // Save hotel
  $('#saveHotel').addEventListener('click', async ()=>{
    if (!ADMIN_PASS) return toast('Сначала войдите');
    try{
      const heroUrl = $('#hHero').value.trim();
      const payload = {
        name: $('#hName').value,
        phone: $('#hPhone').value,
        email: $('#hEmail').value,
        address: $('#hAddress').value,
        check_in: $('#hCheckIn').value,
        check_out: $('#hCheckOut').value,
        tagline: $('#hTagline').value,
        description: $('#hDesc').value,
        about: $('#hAbout').value,
        hero_image: heroUrl
      };
      await apiPost('/api/admin/hotel', payload);
      await refreshAll();
      toast('Сохранено');
    }catch(err){ toast(err.message||'Ошибка'); }
  });

  // Hero upload
  $('#hHeroFile').addEventListener('change', async (e)=>{
    if (!e.target.files?.[0]) return;
    try{
      const url = await uploadImage(e.target.files[0]);
      $('#hHero').value = url;
      $('#hHeroPreview').src = url;
      toast('Фото загружено');
    }catch(err){ toast(err.message||'Upload error'); }
  });

  // Settings
  $('#saveVis').addEventListener('click', async ()=>{
    if (!ADMIN_PASS) return toast('Сначала войдите');
    try{
      await apiPost('/api/admin/visitor-count', { count: Number($('#visCount').value || 0) });
      await refreshAll();
      toast('Ок');
    }catch(err){ toast(err.message||'Ошибка'); }
  });

  $('#savePass').addEventListener('click', async ()=>{
    if (!ADMIN_PASS) return toast('Сначала войдите');
    try{
      const np = $('#newPass').value.trim();
      await apiPost('/api/admin/password', { new_password: np });
      ADMIN_PASS = np;
      $('#adminPass').value = np;
      $('#newPass').value = '';
      toast('Пароль изменён');
      await refreshAll();
    }catch(err){ toast(err.message||'Ошибка'); }
  });

  // Rooms actions
  $('#addRoom').addEventListener('click', ()=>{
    modalOpen('Номер — добавить', roomForm(null));
  });

  $('#roomsTable').addEventListener('click', (e)=>{
    const edit = e.target.closest('[data-edit-room]');
    const del = e.target.closest('[data-del-room]');
    if (edit){
      const r = (DB.rooms||[]).find(x=>x.id===edit.dataset.editRoom);
      modalOpen('Номер — редактирование', roomForm(r));
    }
    if (del){
      const id = del.dataset.delRoom;
      if (!confirm('Удалить номер?')) return;
      apiDel('/api/admin/rooms/' + encodeURIComponent(id)).then(refreshAll).then(()=>toast('Удалено')).catch(err=>toast(err.message||'Ошибка'));
    }
  });

  // Tours actions
  $('#addTour').addEventListener('click', ()=>{
    modalOpen('Тур — добавить', tourForm(null, DB?.categories||[]));
  });

  $('#toursTable').addEventListener('click', (e)=>{
    const edit = e.target.closest('[data-edit-tour]');
    const del = e.target.closest('[data-del-tour]');
    if (edit){
      const t = (DB.tours||[]).find(x=>x.id===edit.dataset.editTour);
      modalOpen('Тур — редактирование', tourForm(t, DB?.categories||[]));
    }
    if (del){
      const id = del.dataset.delTour;
      if (!confirm('Удалить тур?')) return;
      apiDel('/api/admin/tours/' + encodeURIComponent(id)).then(refreshAll).then(()=>toast('Удалено')).catch(err=>toast(err.message||'Ошибка'));
    }
  });

  // Categories actions
  $('#addCategory').addEventListener('click', ()=>{
    modalOpen('Категория — добавить', catForm(null));
  });

  $('#catsTable').addEventListener('click', (e)=>{
    const edit = e.target.closest('[data-edit-cat]');
    const del = e.target.closest('[data-del-cat]');
    if (edit){
      const c = (DB.categories||[]).find(x=>x.id===edit.dataset.editCat);
      modalOpen('Категория — редактирование', catForm(c));
    }
    if (del){
      const id = del.dataset.delCat;
      if (!confirm('Удалить категорию?')) return;
      apiDel('/api/admin/categories/' + encodeURIComponent(id)).then(refreshAll).then(()=>toast('Удалено')).catch(err=>toast(err.message||'Ошибка'));
    }
  });

  // Bookings
  $('#refreshBookings').addEventListener('click', ()=>{
    refreshAll().then(()=>toast('Обновлено')).catch(err=>toast(err.message||'Ошибка'));
  });

  $('#bookingsTable').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-bid]');
    if (!b) return;
    apiPost('/api/admin/bookings/' + encodeURIComponent(b.dataset.bid), { status: b.dataset.status })
      .then(refreshAll)
      .then(()=>toast('Статус обновлён'))
      .catch(err=>toast(err.message||'Ошибка'));
  });

  // Modal save handlers (delegation)
  $('#modalBody').addEventListener('click', async (e)=>{
    if (e.target.id === 'rfSave'){
      try{
        const file = $('#rfFile')?.files?.[0];
        let imgs = $('#rfImgs').value.split('\n').map(s=>s.trim()).filter(Boolean);
        if (file){
          const url = await uploadImage(file);
          imgs = [url, ...imgs];
        }
        const payload = {
          id: $('#rfId').value.trim() || undefined,
          name: $('#rfName').value,
          short_name: $('#rfShort').value,
          description: $('#rfDesc').value,
          price_from: Number($('#rfPrice').value||0),
          size: $('#rfSize').value,
          beds: $('#rfBeds').value,
          max_guests: Number($('#rfGuests').value||2),
          sort_order: Number($('#rfSort').value||0),
          popular: $('#rfPop').value === 'true',
          features: $('#rfFeat').value.split(',').map(s=>s.trim()).filter(Boolean),
          images: imgs
        };
        await apiPost('/api/admin/rooms', payload);
        await refreshAll();
        modalClose();
        toast('Сохранено');
      }catch(err){ toast(err.message||'Ошибка'); }
    }

    if (e.target.id === 'tfSave'){
      try{
        const file = $('#tfFile')?.files?.[0];
        let imgs = $('#tfImgs').value.split('\n').map(s=>s.trim()).filter(Boolean);
        if (file){
          const url = await uploadImage(file);
          imgs = [url, ...imgs];
        }
        const payload = {
          id: $('#tfId').value.trim() || undefined,
          title: $('#tfTitle').value,
          short_desc: $('#tfShort').value,
          description: $('#tfDesc').value,
          price: Number($('#tfPrice').value||0),
          duration: $('#tfDur').value,
          location: $('#tfLoc').value,
          category: $('#tfCat').value,
          featured: $('#tfFeat').value === 'true',
          schedule: $('#tfSched').value.split(',').map(s=>s.trim()).filter(Boolean),
          sort_order: Number($('#tfSort').value||0),
          images: imgs
        };
        await apiPost('/api/admin/tours', payload);
        await refreshAll();
        modalClose();
        toast('Сохранено');
      }catch(err){ toast(err.message||'Ошибка'); }
    }

    if (e.target.id === 'cfSave'){
      try{
        const payload = {
          id: $('#cfId').value.trim() || undefined,
          name: $('#cfName').value,
          icon: $('#cfIcon').value,
          sort_order: Number($('#cfSort').value||0)
        };
        await apiPost('/api/admin/categories', payload);
        await refreshAll();
        modalClose();
        toast('Сохранено');
      }catch(err){ toast(err.message||'Ошибка'); }
    }
  });

  // try auto-view from hash
  const h = (location.hash || '#dashboard').slice(1);
  showView(h);
}

init();
