// ===== Trip List & Forms =====

const Trips = {
  editingId: null,
  currentType: 'flight',

  init() {
    // Type toggle
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
        document.getElementById('flightForm').style.display = this.currentType === 'flight' ? '' : 'none';
        document.getElementById('trainForm').style.display = this.currentType === 'train' ? '' : 'none';
      };
    });

    // Airport search
    this.setupSearch('fFrom', 'fFromResults', 'airport');
    this.setupSearch('fTo', 'fToResults', 'airport');
    this.setupSearch('tFrom', 'tFromResults', 'station');
    this.setupSearch('tTo', 'tToResults', 'station');

    // Auto-detect airline from flight number
    document.getElementById('fFlightNo').addEventListener('input', e => {
      const code = detectAirline(e.target.value);
      if (code) document.getElementById('fAirline').value = code;
    });

    // Populate airline select
    const sel = document.getElementById('fAirline');
    for (const [code, info] of Object.entries(AIRLINES)) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} ${info.name}`;
      sel.appendChild(opt);
    }

    // Save button
    document.getElementById('btnSaveTrip').onclick = () => this.saveTrip();
    document.getElementById('btnDeleteTrip').onclick = () => this.deleteTrip();

    // Filters
    document.getElementById('filterType').onchange = () => this.render();
    document.getElementById('filterYear').onchange = () => this.render();
    document.getElementById('filterSort').onchange = () => this.render();
    
    // Search
    let searchTimer;
    document.getElementById('tripSearch').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.render(), 200);
    });

    // Add trip button
    document.getElementById('btnAddTrip').onclick = () => this.openAdd();
  },

  setupSearch(inputId, resultsId, type) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    
    input.addEventListener('input', () => {
      const q = input.value.trim();
      const items = type === 'airport' ? searchAirports(q) : searchStations(q);
      if (items.length === 0) {
        results.classList.remove('show');
        return;
      }
      results.innerHTML = items.map(item => {
        if (type === 'airport') {
          return `<div class="search-result" data-code="${item.code}" data-city="${item.city}" data-name="${item.name}" data-lat="${item.lat}" data-lng="${item.lng}">
            <span class="code">${item.code}</span><span class="name">${item.city} ${item.name}</span>
          </div>`;
        } else {
          return `<div class="search-result" data-name="${item.name}" data-city="${item.city}" data-lat="${item.lat}" data-lng="${item.lng}">
            <span class="code">${item.name}</span><span class="name">${item.city}</span>
          </div>`;
        }
      }).join('');
      results.classList.add('show');
      
      results.querySelectorAll('.search-result').forEach(el => {
        el.onclick = () => {
          if (type === 'airport') {
            input.value = el.dataset.code + ' ' + el.dataset.city + el.dataset.name;
          } else {
            input.value = el.dataset.name;
          }
          input.dataset.lat = el.dataset.lat;
          input.dataset.lng = el.dataset.lng;
          input.dataset.city = el.dataset.city;
          input.dataset.code = el.dataset.code || el.dataset.name;
          results.classList.remove('show');
        };
      });
    });

    // Auto-select first result on blur if not already selected
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!input.dataset.lat) {
          const firstResult = results.querySelector('.search-result');
          if (firstResult) {
            firstResult.click();
          }
        }
        results.classList.remove('show');
      }, 200);
    });
  },

  openAdd() {
    this.editingId = null;
    document.getElementById('modalTitle').textContent = '添加行程';
    document.getElementById('btnDeleteTrip').style.display = 'none';
    this.clearForm();
    // Default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fDate').value = today;
    document.getElementById('tDate').value = today;
    openModal('addTripModal');
  },

  openEdit(id) {
    const trip = Store.getById(id);
    if (!trip) return;
    this.editingId = id;
    document.getElementById('modalTitle').textContent = '编辑行程';
    document.getElementById('btnDeleteTrip').style.display = '';
    this.clearForm();

    // Set type
    this.currentType = trip.type;
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === trip.type);
    });
    document.getElementById('flightForm').style.display = trip.type === 'flight' ? '' : 'none';
    document.getElementById('trainForm').style.display = trip.type === 'train' ? '' : 'none';

    if (trip.type === 'flight') {
      document.getElementById('fDate').value = trip.date || '';
      document.getElementById('fFlightNo').value = trip.flightNo || '';
      const fFrom = document.getElementById('fFrom');
      fFrom.value = trip.fromCode ? `${trip.fromCode} ${trip.fromCity}${AIRPORTS[trip.fromCode]?.name || ''}` : '';
      fFrom.dataset.lat = trip.fromLat || '';
      fFrom.dataset.lng = trip.fromLng || '';
      fFrom.dataset.city = trip.fromCity || '';
      fFrom.dataset.code = trip.fromCode || '';
      const fTo = document.getElementById('fTo');
      fTo.value = trip.toCode ? `${trip.toCode} ${trip.toCity}${AIRPORTS[trip.toCode]?.name || ''}` : '';
      fTo.dataset.lat = trip.toLat || '';
      fTo.dataset.lng = trip.toLng || '';
      fTo.dataset.city = trip.toCity || '';
      fTo.dataset.code = trip.toCode || '';
      document.getElementById('fDepTime').value = trip.depTime || '';
      document.getElementById('fArrTime').value = trip.arrTime || '';
      document.getElementById('fAirline').value = trip.airline || '';
      document.getElementById('fAircraft').value = trip.aircraft || '';
      document.getElementById('fSeat').value = trip.seat || '';
      document.getElementById('fClass').value = trip.seatClass || 'economy';
      document.getElementById('fNote').value = trip.note || '';
    } else {
      document.getElementById('tDate').value = trip.date || '';
      document.getElementById('tTrainNo').value = trip.trainNo || '';
      const tFrom = document.getElementById('tFrom');
      tFrom.value = trip.fromStation || '';
      tFrom.dataset.lat = trip.fromLat || '';
      tFrom.dataset.lng = trip.fromLng || '';
      tFrom.dataset.city = trip.fromCity || '';
      tFrom.dataset.code = trip.fromStation || '';
      const tTo = document.getElementById('tTo');
      tTo.value = trip.toStation || '';
      tTo.dataset.lat = trip.toLat || '';
      tTo.dataset.lng = trip.toLng || '';
      tTo.dataset.city = trip.toCity || '';
      tTo.dataset.code = trip.toStation || '';
      document.getElementById('tDepTime').value = trip.depTime || '';
      document.getElementById('tArrTime').value = trip.arrTime || '';
      document.getElementById('tSeat').value = trip.seat || '';
      document.getElementById('tSeatType').value = trip.seatType || 'second';
      document.getElementById('tNote').value = trip.note || '';
    }

    openModal('addTripModal');
  },

  clearForm() {
    ['fDate','fFlightNo','fFrom','fTo','fDepTime','fArrTime','fAircraft','fSeat','fNote',
     'tDate','tTrainNo','tFrom','tTo','tDepTime','tArrTime','tSeat','tNote'].forEach(id => {
      const el = document.getElementById(id);
      el.value = '';
      delete el.dataset.lat;
      delete el.dataset.lng;
      delete el.dataset.city;
      delete el.dataset.code;
    });
    document.getElementById('fAirline').value = '';
    document.getElementById('fClass').value = 'economy';
    document.getElementById('tSeatType').value = 'second';
  },

  saveTrip() {
    let trip = { type: this.currentType };

    if (this.currentType === 'flight') {
      const date = document.getElementById('fDate').value;
      const fromEl = document.getElementById('fFrom');
      const toEl = document.getElementById('fTo');
      if (!date) { showToast('请选择日期'); return; }
      if (!fromEl.dataset.lat) { showToast('请选择出发机场'); return; }
      if (!toEl.dataset.lat) { showToast('请选择到达机场'); return; }

      trip.date = date;
      trip.flightNo = document.getElementById('fFlightNo').value.toUpperCase();
      trip.fromCode = fromEl.dataset.code;
      trip.fromCity = fromEl.dataset.city;
      trip.fromLat = parseFloat(fromEl.dataset.lat);
      trip.fromLng = parseFloat(fromEl.dataset.lng);
      trip.toCode = toEl.dataset.code;
      trip.toCity = toEl.dataset.city;
      trip.toLat = parseFloat(toEl.dataset.lat);
      trip.toLng = parseFloat(toEl.dataset.lng);
      trip.depTime = document.getElementById('fDepTime').value;
      trip.arrTime = document.getElementById('fArrTime').value;
      trip.airline = document.getElementById('fAirline').value;
      trip.aircraft = document.getElementById('fAircraft').value;
      trip.seat = document.getElementById('fSeat').value;
      trip.seatClass = document.getElementById('fClass').value;
      trip.note = document.getElementById('fNote').value;
      trip.distance = calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng);
      trip.duration = calcTripDuration(trip.depTime, trip.arrTime);
    } else {
      const date = document.getElementById('tDate').value;
      const fromEl = document.getElementById('tFrom');
      const toEl = document.getElementById('tTo');
      if (!date) { showToast('请选择日期'); return; }
      if (!fromEl.dataset.lat) { showToast('请选择出发站'); return; }
      if (!toEl.dataset.lat) { showToast('请选择到达站'); return; }

      trip.date = date;
      trip.trainNo = document.getElementById('tTrainNo').value.toUpperCase();
      trip.fromStation = fromEl.dataset.code;
      trip.fromCity = fromEl.dataset.city;
      trip.fromLat = parseFloat(fromEl.dataset.lat);
      trip.fromLng = parseFloat(fromEl.dataset.lng);
      trip.toStation = toEl.dataset.code;
      trip.toCity = toEl.dataset.city;
      trip.toLat = parseFloat(toEl.dataset.lat);
      trip.toLng = parseFloat(toEl.dataset.lng);
      trip.depTime = document.getElementById('tDepTime').value;
      trip.arrTime = document.getElementById('tArrTime').value;
      trip.seat = document.getElementById('tSeat').value;
      trip.seatType = document.getElementById('tSeatType').value;
      trip.note = document.getElementById('tNote').value;
      trip.distance = calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng);
      trip.duration = calcTripDuration(trip.depTime, trip.arrTime);
    }

    if (this.editingId) {
      Store.update(this.editingId, trip);
      showToast('行程已更新');
    } else {
      Store.add(trip);
      showToast('行程已添加');
    }

    closeModal('addTripModal');
    this.render();
    TravelMap.draw();
    TravelMap.updateSummary();
    Stats.render();
  },

  deleteTrip() {
    if (!this.editingId) return;
    showConfirm('确定删除这条行程？', () => {
      Store.delete(this.editingId);
      closeModal('addTripModal');
      closeModal('confirmModal');
      showToast('已删除');
      this.render();
      TravelMap.draw();
      TravelMap.updateSummary();
      Stats.render();
    });
  },

  render() {
    const type = document.getElementById('filterType').value;
    const yearVal = document.getElementById('filterYear').value;
    const sort = document.getElementById('filterSort').value;
    const searchQuery = (document.getElementById('tripSearch').value || '').trim().toLowerCase();

    let trips = Store.getAll();

    // Filter by type
    if (type !== 'all') trips = trips.filter(t => t.type === type);
    // Filter by year
    if (yearVal !== 'all') trips = trips.filter(t => getYear(t.date) === parseInt(yearVal));
    // Filter by search query
    if (searchQuery) {
      trips = trips.filter(t => {
        const searchFields = [
          t.fromCity, t.toCity, t.fromStation, t.toStation,
          t.flightNo, t.trainNo, t.fromCode, t.toCode, t.note
        ].filter(Boolean).join(' ').toLowerCase();
        return searchFields.includes(searchQuery);
      });
    }
    // Sort
    if (sort === 'oldest') trips = [...trips].reverse();

    // Update year filter options
    const yearSelect = document.getElementById('filterYear');
    const years = Store.getYears();
    const currentYearVal = yearSelect.value;
    yearSelect.innerHTML = '<option value="all">全部年份</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y + '年';
      yearSelect.appendChild(opt);
    });
    yearSelect.value = currentYearVal;

    const list = document.getElementById('tripList');
    const empty = document.getElementById('emptyTrips');

    if (trips.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = trips.map(t => {
      const isF = t.type === 'flight';
      const typeBadge = isF ? '<span class="trip-type flight">✈️ 飞行</span>' : '<span class="trip-type train">🚄 高铁</span>';
      const no = isF ? (t.flightNo || '') : (t.trainNo || '');
      const dur = t.duration ? fmtDuration(t.duration) : '';
      const dist = t.distance ? fmtDist(t.distance) : '';
      const detailParts = [no, dur].filter(Boolean).join(' · ');

      return `<div class="trip-card" data-id="${t.id}">
        <div class="trip-card-header">
          <span class="trip-date">${fmtDate(t.date)}</span>
          ${typeBadge}
        </div>
        <div class="trip-route">
          <span class="trip-city">${escHtml(t.fromCity || t.fromStation || '?')}</span>
          <span class="trip-arrow">→</span>
          <span class="trip-city">${escHtml(t.toCity || t.toStation || '?')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${detailParts ? `<div class="trip-detail">${escHtml(detailParts)}</div>` : '<div></div>'}
          ${dist ? `<span class="trip-km">${dist}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    // Click to edit
    list.querySelectorAll('.trip-card').forEach(card => {
      card.onclick = () => this.openEdit(card.dataset.id);
    });
  },
};
