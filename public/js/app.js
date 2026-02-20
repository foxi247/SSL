/* Halachi Hotel — frontend (fixed) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

async function apiGet(endpoint) {
  const cacheBuster = endpoint.includes('?') ? '&_=' : '?_=';
  const res = await fetch(`${endpoint}${cacheBuster}${Date.now()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(endpoint, data) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API error: ${res.status}`);
  return json;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('is-show'), 3200);
}

function setOptions(select, options, { placeholder } = {}) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '';
  if (placeholder != null) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    select.appendChild(o);
  }
  options.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  });
  // restore value if possible
  if (current) select.value = current;
}

function fmtPrice(value, cur = '₽') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${new Intl.NumberFormat('ru-RU').format(n)} ${cur}`;
}

function cardRoom(room) {
  const img = (room.images && room.images[0])
    ? room.images[0]
    : 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80';

  const features = (room.features || []).slice(0, 6);

  return `
  <div class="card">
    <div class="card__img"><img src="${img}" alt="${escapeHtml(room.name)}" loading="lazy"></div>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(room.name)}</h3>
      <div class="card__meta">
        ${room.size ? `<span class="pill">${escapeHtml(room.size)} м²</span>` : ''}
        ${room.beds ? `<span class="pill">${escapeHtml(room.beds)}</span>` : ''}
        ${room.max_guests ? `<span class="pill">до ${Number(room.max_guests)} гостей</span>` : ''}
      </div>
      <div class="features">
        ${features.map(f => `<span class="feature">${escapeHtml(String(f))}</span>`).join('')}
      </div>
      <div class="card__actions">
        <button class="btn btn--primary" data-book-room="${room.id}">Забронировать</button>
        <span class="price">от ${fmtPrice(room.price_from, room.currency || '₽')}</span>
      </div>
    </div>
  </div>`;
}

function cardTour(tour) {
  const img = (tour.images && tour.images[0])
    ? tour.images[0]
    : 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80';

  const schedule = Array.isArray(tour.schedule) ? tour.schedule.join(', ') : '';

  return `
  <div class="card">
    <div class="card__img"><img src="${img}" alt="${escapeHtml(tour.title)}" loading="lazy"></div>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(tour.title)}</h3>
      <div class="card__meta">
        ${tour.duration ? `<span class="pill">${escapeHtml(tour.duration)}</span>` : ''}
        ${tour.location ? `<span class="pill">${escapeHtml(tour.location)}</span>` : ''}
        ${schedule ? `<span class="pill">${escapeHtml(schedule)}</span>` : ''}
      </div>
      <p class="p" style="margin:10px 0 0">${escapeHtml(tour.short_desc || '')}</p>
      <div class="card__actions">
        <button class="btn btn--primary" data-book-tour="${tour.id}">Записаться</button>
        <span class="price">${fmtPrice(tour.price, tour.currency || '₽')}</span>
      </div>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openModal() {
  $('#bookingModal')?.classList.add('is-open');
}

function closeModal() {
  $('#bookingModal')?.classList.remove('is-open');
}

function bindModal() {
  $('#openBooking')?.addEventListener('click', openModal);
  $('#openBooking2')?.addEventListener('click', openModal);
  $('#closeBooking')?.addEventListener('click', closeModal);
  $('#bookingModal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'bookingModal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

async function submitBooking(fromQuick = false) {
  const name = fromQuick ? 'Гость' : $('#bName')?.value;
  const phone = fromQuick ? $('#hotelPhone')?.textContent : $('#bPhone')?.value;

  const payload = {
    name: String(name || '').trim(),
    phone: String(phone || '').trim(),
    email: String(fromQuick ? '' : ($('#bEmail')?.value || '')).trim(),
    room_type: String(fromQuick ? ($('#quickRoom')?.value || '') : ($('#bRoom')?.value || '')).trim(),
    tour_type: String(fromQuick ? '' : ($('#bTour')?.value || '')).trim(),
    check_in: String(fromQuick ? ($('#quickCheckIn')?.value || '') : ($('#bCheckIn')?.value || '')).trim(),
    check_out: String(fromQuick ? ($('#quickCheckOut')?.value || '') : ($('#bCheckOut')?.value || '')).trim(),
    guests_count: Number(fromQuick ? ($('#quickGuests')?.value || 2) : ($('#bGuests')?.value || 2)),
    notes: String(fromQuick ? '' : ($('#bNotes')?.value || '')).trim()
  };

  if (!payload.name || !payload.phone) {
    toast('Заполните имя и телефон');
    return;
  }

  try {
    await apiPost('/api/booking', payload);
    toast('Заявка отправлена! Мы скоро свяжемся.');
    if (!fromQuick) {
      closeModal();
      $('#bName').value = '';
      $('#bPhone').value = '';
      $('#bEmail').value = '';
      $('#bNotes').value = '';
    }
  } catch (e) {
    toast(e.message || 'Ошибка отправки');
  }
}

function mountFilters({ el, categories, onSelect }) {
  if (!el) return;
  el.innerHTML = categories.map(c => `<button class="filter ${c.id === 'all' ? 'is-active' : ''}" data-cat="${c.id}">${escapeHtml(c.icon || '✨')} ${escapeHtml(c.name)}</button>`).join('');
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    const cat = btn.dataset.cat;
    $$('.filter', el).forEach(b => b.classList.toggle('is-active', b.dataset.cat === cat));
    onSelect(cat);
  });
}

async function init() {
  $('#year').textContent = String(new Date().getFullYear());
  bindModal();

  try {
    const db = await apiGet('/api/data');

    // Hotel
    const h = db.hotel || {};
    $('#hotelPhone').textContent = h.phone || '+7 (000) 000-00-00';
    $('#hotelTitle').textContent = `Добро пожаловать в «${h.name || 'Халачи'}»`;
    $('#hotelTagline').textContent = h.tagline || '';
    $('#heroImage').src = h.hero_image || '';
    $('#hotelAddress').textContent = h.address || '';
    $('#hotelAbout').textContent = h.about || '';
    $('#contactPhone').textContent = h.phone || '';
    $('#contactEmail').textContent = h.email || '';
    $('#contactAddress').textContent = h.address || '';
    $('#contactTimes').textContent = `${h.check_in || '14:00'} / ${h.check_out || '12:00'}`;
    $('#statsLine').textContent = `${new Intl.NumberFormat('ru-RU').format(Number(h.visitor_count || 0))} гостей останавливались у нас`;

    // Reviews
    const reviews = (db.reviews || []).filter(r => r.status === 'approved').slice(0, 3);
    $('#reviewsBox').innerHTML = reviews.length
      ? reviews.map(r => `
        <div style="border:1px solid var(--line);background:rgba(255,255,255,0.04);border-radius:14px;padding:10px;margin:8px 0">
          <b>${escapeHtml(r.name || 'Гость')}</b> · ${'★'.repeat(Math.min(5, Number(r.rating || 5)))}
          <div class="p" style="margin-top:6px">${escapeHtml(r.text || '')}</div>
        </div>
      `).join('')
      : 'Пока нет отзывов.';

    // Rooms
    const rooms = (db.rooms || []).slice().sort((a,b)=> (a.sort_order??0)-(b.sort_order??0));
    $('#roomsGrid').innerHTML = rooms.map(cardRoom).join('');

    const roomOptions = rooms.map(r => ({ value: r.id, label: `${r.name} (от ${fmtPrice(r.price_from, r.currency || '₽')})` }));
    setOptions($('#quickRoom'), roomOptions, { placeholder: 'Любой номер' });
    setOptions($('#bRoom'), roomOptions, { placeholder: 'Любой номер' });

    // Tours + categories
    const cats = (db.categories || [{ id:'all', name:'Все', icon:'✨' }])
      .slice().sort((a,b)=>(a.sort_order??0)-(b.sort_order??0));

    const tours = (db.tours || []).slice().sort((a,b)=>(a.sort_order??0)-(b.sort_order??0));

    const renderTours = (catId) => {
      const filtered = catId && catId !== 'all' ? tours.filter(t => t.category === catId) : tours;
      $('#toursGrid').innerHTML = filtered.length ? filtered.map(cardTour).join('') : '<div class="p">Туры скоро появятся.</div>';
    };

    mountFilters({ el: $('#tourFilters'), categories: cats, onSelect: renderTours });
    renderTours('all');

    const tourOptions = tours.map(t => ({ value: t.id, label: `${t.title} (${fmtPrice(t.price, t.currency || '₽')})` }));
    setOptions($('#bTour'), tourOptions, { placeholder: 'Без тура' });

    // Booking buttons
    $('#bSubmit')?.addEventListener('click', () => submitBooking(false));
    $('#quickSubmit')?.addEventListener('click', () => submitBooking(true));

    // Delegate book actions
    document.body.addEventListener('click', (e) => {
      const rb = e.target.closest('[data-book-room]');
      const tb = e.target.closest('[data-book-tour]');
      if (rb) {
        openModal();
        $('#bRoom').value = rb.dataset.bookRoom;
        return;
      }
      if (tb) {
        openModal();
        $('#bTour').value = tb.dataset.bookTour;
        return;
      }
    });

  } catch (e) {
    console.error(e);
    toast('Не удалось загрузить данные. Проверь сервер.');
  }
}

init();
