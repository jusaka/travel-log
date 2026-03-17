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
    document.getElementById('btnDuplicateTrip').onclick = () => this.duplicateTrip();
    
    // New group button
    document.getElementById('btnNewGroup').onclick = () => {
      const name = prompt('旅行名称（如"2025春节回家"）：');
      if (!name || !name.trim()) return;
      const group = Store.addGroup(name.trim());
      this._refreshGroupSelect();
      document.getElementById('tripGroupSelect').value = group.id;
    };

    // Filters
    document.getElementById('filterType').onchange = () => this.render();
    document.getElementById('filterYear').onchange = () => this.render();
    document.getElementById('filterGroup').onchange = () => this.render();
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
    document.getElementById('btnDuplicateTrip').style.display = 'none';
    // Reset to manual mode
    document.getElementById('addModeToggle').style.display = '';
    document.getElementById('manualFormSection').style.display = '';
    document.getElementById('aiImportSection').style.display = 'none';
    document.getElementById('btnSaveTrip').textContent = '保存';
    document.getElementById('aiPasteInput').value = '';
    document.getElementById('aiPastePreview').innerHTML = '';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'manual'));
    this.clearForm();
    // Remember last used date, or default to today
    const lastDate = localStorage.getItem('travellog_lastDate') || new Date().toISOString().split('T')[0];
    document.getElementById('fDate').value = lastDate;
    document.getElementById('tDate').value = lastDate;
    this._refreshGroupSelect();
    // Collapse extra fields for new trips
    this._collapseFormExtra();
    openModal('addTripModal');
  },

  openEdit(id) {
    const trip = Store.getById(id);
    if (!trip) return;
    this.editingId = id;
    document.getElementById('modalTitle').textContent = '编辑行程';
    document.getElementById('btnDeleteTrip').style.display = '';
    document.getElementById('btnDuplicateTrip').style.display = '';
    // Edit mode: hide mode toggle, force manual
    document.getElementById('addModeToggle').style.display = 'none';
    document.getElementById('manualFormSection').style.display = '';
    document.getElementById('aiImportSection').style.display = 'none';
    document.getElementById('btnSaveTrip').textContent = '保存';
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
      document.getElementById('fPrice').value = trip.price || '';
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
      document.getElementById('tPrice').value = trip.price || '';
    }

    this._refreshGroupSelect(trip.groupId);
    // Expand extra fields when editing
    this._expandFormExtra(trip.type);
    openModal('addTripModal');
  },

  clearForm() {
    ['fDate','fFlightNo','fFrom','fTo','fDepTime','fArrTime','fAircraft','fSeat','fNote','fPrice',
     'tDate','tTrainNo','tFrom','tTo','tDepTime','tArrTime','tSeat','tNote','tPrice'].forEach(id => {
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

    // Clear previous validation errors
    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));

    if (this.currentType === 'flight') {
      const date = document.getElementById('fDate').value;
      const fromEl = document.getElementById('fFrom');
      const toEl = document.getElementById('fTo');
      if (!date) { document.getElementById('fDate').classList.add('form-error'); showToast('⚠️ 请选择日期', 3000); return; }
      if (!fromEl.dataset.lat) { fromEl.classList.add('form-error'); showToast('⚠️ 请选择出发机场', 3000); return; }
      if (!toEl.dataset.lat) { toEl.classList.add('form-error'); showToast('⚠️ 请选择到达机场', 3000); return; }

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
      const fPrice = document.getElementById('fPrice').value;
      if (fPrice) trip.price = parseFloat(fPrice);
      trip.distance = calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng);
      trip.duration = calcTripDuration(trip.depTime, trip.arrTime, trip.fromCode, trip.toCode);
    } else {
      const date = document.getElementById('tDate').value;
      const fromEl = document.getElementById('tFrom');
      const toEl = document.getElementById('tTo');
      if (!date) { document.getElementById('tDate').classList.add('form-error'); showToast('⚠️ 请选择日期', 3000); return; }
      if (!fromEl.dataset.lat) { fromEl.classList.add('form-error'); showToast('⚠️ 请选择出发站', 3000); return; }
      if (!toEl.dataset.lat) { toEl.classList.add('form-error'); showToast('⚠️ 请选择到达站', 3000); return; }

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
      const tPrice = document.getElementById('tPrice').value;
      if (tPrice) trip.price = parseFloat(tPrice);
      // 高铁实际运行距离约为直线距离的1.3倍
      trip.distance = Math.round(calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng) * 1.3);
      trip.duration = calcTripDuration(trip.depTime, trip.arrTime);
    }

    // Group assignment
    const groupId = document.getElementById('tripGroupSelect').value;
    if (groupId) {
      trip.groupId = groupId;
      const group = Store.getGroupById(groupId);
      if (group && this.editingId) {
        if (!group.tripIds.includes(this.editingId)) group.tripIds.push(this.editingId);
      }
    } else {
      delete trip.groupId;
    }

    if (this.editingId) {
      Store.update(this.editingId, trip);
      showToast('行程已更新');
      closeModal('addTripModal');
    } else {
      const newTrip = Store.add(trip);
      // Add to group if selected
      if (groupId) {
        const group = Store.getGroupById(groupId);
        if (group && !group.tripIds.includes(newTrip.id)) {
          group.tripIds.push(newTrip.id);
          Store.save();
        }
      }
      localStorage.setItem('travellog_lastDate', trip.date);
      closeModal('addTripModal');
      // Offer return trip
      this._offerReturnTrip(trip);
    }

    this.render();
    TravelMap.draw();
    TravelMap.updateSummary();
    Stats.render();
  },

  _offerReturnTrip(trip) {
    // Only offer return trip if we have from and to
    const hasRoute = trip.type === 'flight' ? (trip.fromCode && trip.toCode) : (trip.fromStation && trip.toStation);
    if (!hasRoute) {
      showToast('行程已添加 ✅');
      return;
    }

    // Show a toast with "add return trip" option
    const el = document.getElementById('toast');
    el.innerHTML = `<span>行程已保存 ✅</span><span style="margin:0 8px;opacity:0.3">|</span><button id="btnReturnTrip" style="background:none;border:none;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;padding:6px 12px;min-height:44px;min-width:44px;text-decoration:underline">添加返程 ↩️</button>`;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, 6000);
    
    document.getElementById('btnReturnTrip').onclick = () => {
      el.classList.remove('show');
      // Create return trip data
      const returnTrip = { ...trip };
      delete returnTrip.id;
      delete returnTrip.createdAt;
      // Swap from/to
      if (trip.type === 'flight') {
        returnTrip.fromCode = trip.toCode;
        returnTrip.toCode = trip.fromCode;
        returnTrip.fromCity = trip.toCity;
        returnTrip.toCity = trip.fromCity;
        returnTrip.fromLat = trip.toLat;
        returnTrip.fromLng = trip.toLng;
        returnTrip.toLat = trip.fromLat;
        returnTrip.toLng = trip.fromLng;
        returnTrip.flightNo = ''; // Different flight number usually
      } else {
        returnTrip.fromStation = trip.toStation;
        returnTrip.toStation = trip.fromStation;
        returnTrip.fromCity = trip.toCity;
        returnTrip.toCity = trip.fromCity;
        returnTrip.fromLat = trip.toLat;
        returnTrip.fromLng = trip.toLng;
        returnTrip.toLat = trip.fromLat;
        returnTrip.toLng = trip.fromLng;
        returnTrip.trainNo = '';
      }
      returnTrip.depTime = '';
      returnTrip.arrTime = '';
      returnTrip.seat = '';
      returnTrip.note = '';
      
      // Open add form pre-filled with return trip
      this.editingId = null;
      document.getElementById('modalTitle').textContent = '添加返程';
      document.getElementById('btnDeleteTrip').style.display = 'none';
      document.getElementById('btnDuplicateTrip').style.display = 'none';
      // Reset to manual mode
      document.getElementById('addModeToggle').style.display = '';
      document.getElementById('manualFormSection').style.display = '';
      document.getElementById('aiImportSection').style.display = 'none';
      document.getElementById('btnSaveTrip').textContent = '保存';
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'manual'));
      this.clearForm();
      this._prefillForm(returnTrip);
      this._refreshGroupSelect(returnTrip.groupId);
      this._collapseFormExtra();
      openModal('addTripModal');
    };
  },

  _refreshGroupSelect(selectedId) {
    const sel = document.getElementById('tripGroupSelect');
    sel.innerHTML = '<option value="">不归组</option>';
    Store.getGroups().forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      sel.appendChild(opt);
    });
    if (selectedId) sel.value = selectedId;
  },

  _collapseFormExtra() {
    ['flight', 'train'].forEach(type => {
      const extra = document.getElementById(type + 'FormExtra');
      if (extra) extra.style.display = 'none';
      const toggle = extra?.parentElement?.querySelector('.form-toggle');
      if (toggle) { toggle.textContent = '▾ 更多详情'; toggle.classList.remove('expanded'); }
    });
    const groupRow = document.getElementById('groupSelectorRow');
    if (groupRow) groupRow.style.display = 'none';
  },

  _expandFormExtra(type) {
    const extra = document.getElementById(type + 'FormExtra');
    if (extra) extra.style.display = '';
    const toggle = extra?.parentElement?.querySelector('.form-toggle');
    if (toggle) { toggle.textContent = '▴收起详情'; toggle.classList.add('expanded'); }
    const groupRow = document.getElementById('groupSelectorRow');
    if (groupRow) groupRow.style.display = '';
  },

  _prefillForm(trip) {
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
      document.getElementById('fAirline').value = trip.airline || '';
      document.getElementById('fClass').value = trip.seatClass || 'economy';
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
      document.getElementById('tSeatType').value = trip.seatType || 'second';
    }
  },

  deleteTrip() {
    if (!this.editingId) return;
    showConfirm('确定删除这条行程？', () => {
      const trip = Store.getById(this.editingId);
      Store.delete(this.editingId);
      closeModal('addTripModal');
      closeModal('confirmModal');
      showUndoToast('已删除行程', trip);
      this.render();
      TravelMap.draw();
      TravelMap.updateSummary();
      Stats.render();
    });
  },

  duplicateTrip() {
    if (!this.editingId) return;
    const original = Store.getById(this.editingId);
    if (!original) return;
    
    // Create a copy with new id and today's date
    const copy = { ...original };
    delete copy.id;
    delete copy.createdAt;
    copy.date = new Date().toISOString().split('T')[0];
    
    Store.add(copy);
    closeModal('addTripModal');
    showToast('已复制行程');
    this.render();
    TravelMap.draw();
    TravelMap.updateSummary();
    Stats.render();
    Annual.render();
  },

  showQuickActions(id, x, y) {
    // Create or reuse context menu
    let menu = document.getElementById('quickActionsMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'quickActionsMenu';
      menu.style.cssText = 'position:fixed;background:var(--bg2);border:1px solid var(--bg3);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);padding:8px;z-index:300;min-width:140px';
      document.body.appendChild(menu);
    }
    
    menu.innerHTML = `
      <button class="quick-action-btn" data-action="edit">✏️ 编辑</button>
      <button class="quick-action-btn" data-action="duplicate">📋 复制</button>
      <button class="quick-action-btn" data-action="delete" style="color:var(--danger)">🗑️ 删除</button>
    `;
    
    // Position menu
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    menu.style.top = (y - 80) + 'px';
    menu.style.display = 'block';
    
    // Handle clicks (use event delegation on the menu itself)
    const handler = (e) => {
      const btn = e.target.closest('.quick-action-btn');
      if (!btn) return;
      menu.style.display = 'none';
      const action = btn.dataset.action;
      if (action === 'edit') {
        this.openEdit(id);
      } else if (action === 'duplicate') {
        const original = Store.getById(id);
        if (original) {
          const copy = { ...original };
          delete copy.id;
          delete copy.createdAt;
          copy.date = new Date().toISOString().split('T')[0];
          Store.add(copy);
          showToast('已复制行程');
          this.render();
          TravelMap.draw();
          TravelMap.updateSummary();
          Stats.render();
          Annual.render();
        }
      } else if (action === 'delete') {
        showConfirm('确定删除这条行程？', () => {
          const trip = Store.getById(id);
          Store.delete(id);
          closeModal('confirmModal');
          showUndoToast('已删除行程', trip);
          this.render();
          TravelMap.draw();
          TravelMap.updateSummary();
          Stats.render();
        });
      }
    };
    // Remove previous listener, add new one
    menu.removeEventListener('click', menu._handler);
    menu._handler = handler;
    menu.addEventListener('click', handler);
    
    // Close on backdrop click (use single tracked listener)
    if (menu._backdropHandler) {
      document.removeEventListener('click', menu._backdropHandler);
    }
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
        menu._backdropHandler = null;
      }
    };
    menu._backdropHandler = closeMenu;
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
  },

  render() {
    const type = document.getElementById('filterType').value;
    const yearVal = document.getElementById('filterYear').value;
    const groupVal = document.getElementById('filterGroup').value;
    const sort = document.getElementById('filterSort').value;
    const searchQuery = (document.getElementById('tripSearch').value || '').trim().toLowerCase();

    let trips = Store.getAll();

    // Filter by type
    if (type !== 'all') trips = trips.filter(t => t.type === type);
    // Filter by year
    if (yearVal !== 'all') trips = trips.filter(t => getYear(t.date) === parseInt(yearVal));
    // Filter by group
    if (groupVal !== 'all') {
      if (groupVal === 'ungrouped') {
        trips = trips.filter(t => !t.groupId);
      } else {
        trips = trips.filter(t => t.groupId === groupVal);
      }
    }
    // Filter by search query (supports pinyin)
    if (searchQuery) {
      trips = trips.filter(t => {
        const searchFields = [
          t.fromCity, t.toCity, t.fromStation, t.toStation,
          t.flightNo, t.trainNo, t.fromCode, t.toCode, t.note
        ].filter(Boolean).join(' ');
        const lower = searchFields.toLowerCase();
        const pinyinFull = toPinyinFull(searchFields);
        const pinyinInit = toPinyinInitials(searchFields);
        return lower.includes(searchQuery) || pinyinFull.includes(searchQuery) || pinyinInit.includes(searchQuery);
      });
    }
    
    // Helper: highlight search query in text
    const highlight = (str) => {
      if (!str || !searchQuery) return escHtml(str || '');
      const escaped = escHtml(str);
      const escapedQ = escHtml(searchQuery);
      return escaped.replace(new RegExp(escapedQ, 'gi'), m => `<mark style="background:rgba(245,158,11,0.35);color:var(--flight);border-radius:2px;padding:0 2px">${m}</mark>`);
    };
    
    // Sort
    if (sort === 'oldest') trips = [...trips].reverse();

    // Update year filter options
    const yearSelect = document.getElementById('filterYear');
    const years = Store.getYears();
    const currentYearVal = yearSelect.value;
    yearSelect.innerHTML = '<option value="all">年份</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y + '年';
      yearSelect.appendChild(opt);
    });
    yearSelect.value = currentYearVal;

    // Update group filter
    const groupSelect = document.getElementById('filterGroup');
    const currentGroupVal = groupSelect.value;
    const groups = Store.getGroups();
    groupSelect.innerHTML = '<option value="all">旅行组</option>';
    if (groups.length > 0) {
      groupSelect.style.display = '';
      groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = '🏷️ ' + g.name;
        groupSelect.appendChild(opt);
      });
      const ungrouped = document.createElement('option');
      ungrouped.value = 'ungrouped'; ungrouped.textContent = '未归组';
      groupSelect.appendChild(ungrouped);
    } else {
      groupSelect.style.display = 'none';
    }
    groupSelect.value = currentGroupVal;

    const list = document.getElementById('tripList');
    const empty = document.getElementById('emptyTrips');
    const allTrips = Store.getAll();

    if (trips.length === 0) {
      list.innerHTML = '';
      if (allTrips.length === 0) {
        // 真正无数据 — 显示引导空态
        empty.innerHTML = '<div class="empty-icon">✈️</div><div class="empty-text">开启你的旅程</div><div class="empty-sub">记录每一次飞行和铁路旅行<br>构建你的专属足迹地图</div><button class="btn btn-primary" style="margin-top:20px" onclick="Trips.openAdd()">📝 添加第一条行程</button>';
      } else {
        // 搜索/筛选无结果 — 显示搜索空态
        empty.innerHTML = '<div class="empty-icon">🔍</div><div class="empty-text">未找到匹配的行程</div><div class="empty-sub">试试其他关键词或调整筛选条件</div>';
      }
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = '';
    // Group by month
    let currentMonth = '';
    trips.forEach(t => {
      const ym = t.date ? t.date.substring(0, 7) : '';
      if (ym && ym !== currentMonth) {
        currentMonth = ym;
        const [y, m] = ym.split('-');
        const monthTrips = trips.filter(tr => tr.date && tr.date.startsWith(ym));
        const monthKm = monthTrips.reduce((sum, tr) => sum + (tr.distance || 0), 0);
        const header = document.createElement('div');
        header.className = 'trip-month-header';
        header.dataset.month = parseInt(m) - 1;
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;padding:12px 4px 6px;font-size:13px;font-weight:700;color:var(--accent2);border-bottom:1px solid var(--bg3);margin-bottom:4px';
        const kmText = monthKm > 0 ? fmtDist(monthKm) : '—';
        header.innerHTML = `<span>${y}年${parseInt(m)}月 <span style="font-weight:400;color:var(--text3);font-size:11px">${monthTrips.length}次</span></span><span style="font-size:11px;color:var(--text3);font-weight:400">${kmText}</span>`;
        list.appendChild(header);
      }

      const isF = t.type === 'flight';
      const typeBadge = isF ? '<span class="trip-type flight">✈️ 飞行</span>' : '<span class="trip-type train">🚄 高铁</span>';
      const no = isF ? (t.flightNo || '') : (t.trainNo || '');
      const dur = t.duration ? fmtDuration(t.duration) : '';
      const dist = t.distance ? fmtDist(t.distance) : '—';
      const fromLabel = isF ? (t.fromCode || t.fromCity || '?') : (t.fromStation && t.fromStation !== t.fromCity ? t.fromStation : '');
      const toLabel = isF ? (t.toCode || t.toCity || '?') : (t.toStation && t.toStation !== t.toCity ? t.toStation : '');
      const airline = isF && t.airline ? (AIRLINES[t.airline]?.name || t.airline) : '';
      const group = t.groupId ? Store.getGroupById(t.groupId) : null;
      const groupBadge = group ? `<span style="font-size:10px;background:rgba(59,130,246,0.15);color:var(--accent);padding:1px 6px;border-radius:8px;margin-left:6px">🏷️ ${escHtml(group.name)}</span>` : '';

      const card = document.createElement('div');
      card.className = `trip-card ${isF ? 'flight-card' : 'train-card'}`;
      card.dataset.id = t.id;
      card.innerHTML = `
        <div class="trip-card-header">
          <span class="trip-date">${fmtDate(t.date)}${groupBadge}</span>
          ${typeBadge}
        </div>
        <div class="trip-route" style="margin:10px 0">
          <div style="text-align:center">
            <div class="trip-city">${highlight(t.fromCity || t.fromStation || '?')}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${highlight(fromLabel)}</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="font-size:10px;color:var(--text3)">${dur || ''}</div>
            <div style="height:1px;width:100%;background:linear-gradient(90deg,transparent,var(--text3),transparent)"></div>
            <div style="font-size:10px;color:${isF ? 'var(--flight)' : 'var(--train)'}">→</div>
          </div>
          <div style="text-align:center">
            <div class="trip-city">${highlight(t.toCity || t.toStation || '?')}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${highlight(toLabel)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--bg3)">
          <div style="font-size:12px;color:var(--text3)">${highlight([no, airline].filter(Boolean).join(' · '))}</div>
          ${dist ? `<span class="trip-km">${dist}</span>` : ''}
        </div>`;
      list.appendChild(card);
    });

    // Click to edit
    list.querySelectorAll('.trip-card').forEach(card => {
      let longPressTimer = null;
      let startX = 0, startY = 0;
      
      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        longPressTimer = setTimeout(() => {
          // Vibrate if supported
          if (navigator.vibrate) navigator.vibrate(50);
          this.showQuickActions(card.dataset.id, e.touches[0].clientX, e.touches[0].clientY);
        }, 500);
      }, { passive: true });
      
      card.addEventListener('touchmove', (e) => {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimer);
        }
      }, { passive: true });
      
      card.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
      });
      
      card.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
      });
      
      card.onclick = () => this.showDetail(card.dataset.id);
    });
  },

  showDetail(id) {
    const t = Store.getById(id);
    if (!t) return;
    
    const isF = t.type === 'flight';
    const body = document.getElementById('tripDetailBody');
    
    // Header section - boarding pass style
    const fromName = isF ? (t.fromCode || t.fromCity) : (t.fromStation || t.fromCity);
    const toName = isF ? (t.toCode || t.toCity) : (t.toStation || t.toCity);
    const typeIcon = isF ? '✈️' : '🚄';
    const typeColor = isF ? 'var(--flight)' : 'var(--train)';
    const no = isF ? (t.flightNo || '') : (t.trainNo || '');
    const airlineName = isF && t.airline ? (AIRLINES[t.airline]?.name || t.airline) : '';
    
    let html = `
      <div style="text-align:center;padding:20px 0;border-bottom:1px dashed var(--bg3);margin-bottom:16px;position:relative">
        <div style="font-size:11px;color:var(--text3);margin-bottom:16px">${fmtDate(t.date)}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:20px">
          <div style="text-align:center;flex:1">
            <div style="font-size:28px;font-weight:800;color:var(--text)">${escHtml(fromName)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px">${escHtml(t.fromCity || '')}</div>
            ${t.depTime ? `<div style="font-size:14px;color:var(--text2);margin-top:8px;font-weight:600">${t.depTime}</div>` : ''}
          </div>
          <div style="text-align:center;flex-shrink:0">
            <div style="font-size:24px">${typeIcon}</div>
            <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,${typeColor},transparent);margin:8px 0"></div>
            ${t.duration ? `<div style="font-size:11px;color:var(--text3)">${fmtDuration(t.duration)}</div>` : ''}
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:28px;font-weight:800;color:var(--text)">${escHtml(toName)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px">${escHtml(t.toCity || '')}</div>
            ${t.arrTime ? `<div style="font-size:14px;color:var(--text2);margin-top:8px;font-weight:600">${t.arrTime}</div>` : ''}
          </div>
        </div>
        ${t.distance ? `<div style="margin-top:16px;font-size:16px;font-weight:700;color:${typeColor}">${fmtDist(t.distance)}</div>` : ''}
      </div>
    `;
    
    // Detail rows
    const rows = [];
    if (no) rows.push(['航班/车次', `<span style="font-weight:700">${escHtml(no)}</span>`]);
    if (airlineName) rows.push(['航空公司', escHtml(airlineName)]);
    if (t.aircraft) rows.push(['机型', escHtml(t.aircraft)]);
    if (t.seat) rows.push(['座位', escHtml(t.seat)]);
    if (isF && t.seatClass) {
      const classMap = {economy:'经济舱',business:'商务舱',first:'头等舱',premium:'超级经济舱'};
      rows.push(['舱位', classMap[t.seatClass] || t.seatClass]);
    }
    if (!isF && t.seatType) {
      const typeMap = {second:'二等座',first:'一等座',business:'商务座',standing:'站票'};
      rows.push(['席别', typeMap[t.seatType] || t.seatType]);
    }
    if (t.note) rows.push(['备注', escHtml(t.note)]);
    if (t.price) rows.push(['票价', '¥' + t.price.toLocaleString()]);
    const detailGroup = t.groupId ? Store.getGroupById(t.groupId) : null;
    if (detailGroup) rows.push(['旅行', escHtml(detailGroup.name)]);
    
    if (rows.length > 0) {
      html += `<div style="margin-bottom:16px">
        ${rows.map(([label, val]) => `
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bg3)">
            <span style="color:var(--text3);font-size:13px">${label}</span>
            <span style="font-size:14px">${val}</span>
          </div>
        `).join('')}
      </div>`;
    }
    
    body.innerHTML = html;
    
    // Delete button in detail modal
    document.getElementById('btnDeleteFromDetail').onclick = () => {
      showConfirm('确定删除这条行程？', () => {
        const tripData = Store.getById(id);
        Store.delete(id);
        closeModal('confirmModal');
        closeModal('tripDetailModal');
        showUndoToast('已删除行程', tripData);
        this.render();
        TravelMap.draw();
        TravelMap.updateSummary();
        Stats.render();
        Annual.render();
      });
    };

    // Edit button — openModal inside openEdit auto-closes tripDetailModal (mutual exclusion)
    document.getElementById('btnEditFromDetail').onclick = () => {
      this.openEdit(id);
    };
    
    openModal('tripDetailModal');
  },
};
