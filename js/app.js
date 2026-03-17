// ===== App Entry Point =====

(function() {
  // Init store
  Store.load();

  // Init components
  TravelMap.init(document.getElementById('mapCanvas'));
  Trips.init();
  Stats.render();
  Annual.init();
  Annual.render();
  TravelMap.updateSummary();

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const view = document.getElementById('view' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
      if (view) view.classList.add('active');
      
      // Refresh content on tab switch
      if (tab.dataset.tab === 'map') {
        TravelMap.resize();
        TravelMap._startAnimation(); // Resume animation
      } else {
        TravelMap.stopAnimation(); // Pause animation when map not visible
        if (tab.dataset.tab === 'trips') {
          Trips.render();
        } else if (tab.dataset.tab === 'stats') {
          Stats.render();
        } else if (tab.dataset.tab === 'annual') {
          Annual.render();
        }
      }
    };
  });

  // Confirm modal buttons
  document.getElementById('confirmOk').onclick = () => {
    closeModal('confirmModal');
    if (_confirmCb) _confirmCb();
    _confirmCb = null;
  };
  document.getElementById('confirmCancel').onclick = () => {
    closeModal('confirmModal');
    _confirmCb = null;
  };

  // Settings
  document.getElementById('btnSettings').onclick = () => {
    _renderGroupList();
    openModal('settingsModal');
  };

  function _renderGroupList() {
    const groups = Store.getGroups();
    const container = document.getElementById('groupList');
    if (groups.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">暂无旅行组，添加行程时可创建</div>';
      return;
    }
    const allTrips = Store.getAll();
    container.innerHTML = groups.map(g => {
      const groupTrips = allTrips.filter(t => t.groupId === g.id);
      const tripCount = groupTrips.length;
      const totalKm = groupTrips.reduce((s, t) => s + (t.distance || 0), 0);
      const totalPrice = groupTrips.reduce((s, t) => s + (t.price || 0), 0);
      const sortedTrips = [...groupTrips].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const dateRange = sortedTrips.length > 0 ? 
        `${fmtDateShort(sortedTrips[0].date)} ~ ${fmtDateShort(sortedTrips[sortedTrips.length-1].date)}` : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg3);border-radius:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">🏷️ ${escHtml(g.name)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${tripCount}次行程 · ${fmtDist(totalKm)}${totalPrice > 0 ? ' · ¥' + totalPrice.toLocaleString() : ''}</div>
          ${dateRange ? `<div style="font-size:10px;color:var(--text3)">${dateRange}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn-icon" style="min-width:32px;min-height:32px;font-size:14px" onclick="_renameGroup('${g.id}')">✏️</button>
          <button class="btn-icon" style="min-width:32px;min-height:32px;font-size:14px;color:var(--danger)" onclick="_deleteGroup('${g.id}','${escHtml(g.name)}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  // Global group management functions
  window._renameGroup = (id) => {
    const group = Store.getGroupById(id);
    if (!group) return;
    const name = prompt('修改旅行组名称：', group.name);
    if (!name || !name.trim()) return;
    Store.updateGroup(id, { name: name.trim() });
    _renderGroupList();
    Trips.render();
    showToast('已更新');
  };
  window._deleteGroup = (id, name) => {
    showConfirm(`确定删除旅行组「${name}」？\n（行程不会被删除，只是取消分组）`, () => {
      Store.deleteGroup(id);
      _renderGroupList();
      Trips.render();
      showToast('已删除旅行组');
    });
  };

  // Theme toggle
  const updateThemeButtons = () => {
    const theme = localStorage.getItem('travellog_theme');
    const isLight = document.documentElement.classList.contains('light');
    document.getElementById('btnThemeDark').classList.toggle('active', theme === 'dark');
    document.getElementById('btnThemeLight').classList.toggle('active', theme === 'light');
    document.getElementById('btnThemeAuto').classList.toggle('active', !theme);
  };
  document.getElementById('btnThemeDark').onclick = () => {
    document.documentElement.classList.remove('light');
    localStorage.setItem('travellog_theme', 'dark');
    updateThemeButtons();
    TravelMap.draw(); // Redraw map for theme
  };
  document.getElementById('btnThemeLight').onclick = () => {
    document.documentElement.classList.add('light');
    localStorage.setItem('travellog_theme', 'light');
    updateThemeButtons();
    TravelMap.draw();
  };
  document.getElementById('btnThemeAuto').onclick = () => {
    localStorage.removeItem('travellog_theme');
    const preferLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.classList.toggle('light', preferLight);
    updateThemeButtons();
    TravelMap.draw();
  };
  // Init theme from storage (support: dark / light / auto)
  const savedTheme = localStorage.getItem('travellog_theme');
  if (savedTheme === 'light' || (!savedTheme && window.matchMedia('(prefers-color-scheme: light)').matches)) {
    document.documentElement.classList.add('light');
  }
  // Listen for system theme changes when in auto mode
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem('travellog_theme')) {
      document.documentElement.classList.toggle('light', e.matches);
      TravelMap.draw();
    }
  });
  updateThemeButtons();

  // Copy to clipboard
  document.getElementById('btnCopyData').onclick = async () => {
    const trips = Store.getAll();
    if (!trips.length) { showToast('没有数据'); return; }
    // Export as CSV for better readability
    const headers = ['date','type','fromCity','toCity','fromCode','toCode','fromStation','toStation','flightNo','trainNo','airline','depTime','arrTime','distance','duration','seatClass','seatType','seat','aircraft','price','groupId','note'];
    const csvRows = [headers.join(',')];
    trips.forEach(t => {
      const row = headers.map(h => {
        const val = t[h] ?? '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      csvRows.push(row.join(','));
    });
    const data = csvRows.join('\n');
    // Show a modal with textarea for manual copy (iOS clipboard API unreliable)
    let copyModal = document.getElementById('copyDataModal');
    if (!copyModal) {
      copyModal = document.createElement('div');
      copyModal.id = 'copyDataModal';
      copyModal.className = 'modal';
      copyModal.style.display = 'none';
      copyModal.innerHTML = `<div class="modal-content">
        <div class="modal-header">
          <h3>📤 备份数据</h3>
          <button class="modal-close" onclick="closeModal('copyDataModal')">×</button>
        </div>
        <div class="modal-body">
          <p style="font-size:12px;color:var(--text2);margin-bottom:8px">长按下方文本框 → 全选 → 拷贝</p>
          <textarea id="copyDataText" readonly style="width:100%;height:200px;font-size:11px;font-family:monospace;background:var(--bg);color:var(--text);border:1px solid var(--bg3);border-radius:8px;padding:8px;resize:none"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('copyDataModal')">关闭</button>
        </div>
      </div>`;
      document.body.appendChild(copyModal);
      copyModal.addEventListener('click', e => { if (e.target === copyModal) closeModal('copyDataModal'); });
    }
    document.getElementById('copyDataText').value = data;
    closeModal('settingsModal');
    openModal('copyDataModal');
    // Auto select all text
    setTimeout(() => {
      const ta = document.getElementById('copyDataText');
      ta.focus();
      ta.select();
    }, 300);
  };

  // Paste from clipboard
  document.getElementById('btnPasteData').onclick = async () => {
    try {
      let text;
      try {
        text = await navigator.clipboard.readText();
      } catch(e) {
        text = prompt('粘贴数据到这里（JSON格式）：');
      }
      if (!text || !text.trim()) { showToast('剪贴板为空'); return; }
      const added = Store.importData(text.trim());
      showToast(`导入成功，新增 ${added} 条行程 ✅`);
      Trips.render();
      TravelMap.draw();
      TravelMap.updateSummary();
      Stats.render();
      Annual.render();
      closeModal('settingsModal');
    } catch(err) {
      showToast('导入失败：' + err.message);
    }
  };

  // Export JSON
  document.getElementById('btnExport').onclick = () => {
    const data = Store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travellog-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
  };

  // Import
  document.getElementById('btnImport').onclick = () => {
    document.getElementById('importFile').click();
  };
  document.getElementById('importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        // Preview: count how many will be imported
        const raw = ev.target.result;
        const isCSV = raw.trim().startsWith('date,') || /^\d{4}-\d{2}-\d{2}/.test(raw.trim().split('\n')[0]);
        const lines = raw.trim().split('\n').length;
        const approxCount = isCSV ? lines - 1 : 'N/A';
        showConfirm(`确定导入 ${file.name}？\n预计 ${approxCount} 条记录（已有的不会重复）`, () => {
          const added = Store.importData(raw);
          showToast(`导入成功，新增 ${added} 条行程`);
          Trips.render();
          TravelMap.draw();
          TravelMap.updateSummary();
          Stats.render();
          Annual.render();
          closeModal('settingsModal');
        });
      } catch(err) {
        showToast('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export CSV
  document.getElementById('btnExportCSV').onclick = () => {
    const trips = Store.getAll();
    if (!trips.length) {
      showToast('没有数据可导出');
      return;
    }
    // CSV header
    const headers = ['date','type','fromCity','toCity','fromCode','toCode','fromStation','toStation','flightNo','trainNo','airline','depTime','arrTime','distance','duration','seatClass','seatType','seat','aircraft','price','groupId','note'];
    const csvRows = [headers.join(',')];
    trips.forEach(t => {
      const row = headers.map(h => {
        const val = t[h] ?? '';
        // Escape commas and quotes
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      csvRows.push(row.join(','));
    });
    const csv = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travellog-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV已导出');
  };

  // Add sample data
  document.getElementById('btnAddSample').onclick = () => {
    const sampleTrips = [
      { type: 'flight', date: '2026-01-15', fromCode: 'PEK', toCode: 'SHA', flightNo: 'CA1515', airline: 'CA', depTime: '08:00', arrTime: '10:15', seatClass: 'economy' },
      { type: 'flight', date: '2026-02-20', fromCode: 'SHA', toCode: 'CTU', flightNo: 'MU5401', airline: 'MU', depTime: '14:30', arrTime: '17:45', seatClass: 'economy' },
      { type: 'train', date: '2026-03-05', fromStation: '上海虹桥', toStation: '杭州东', trainNo: 'G7501', depTime: '09:00', arrTime: '10:05', seatType: '二等座' },
      { type: 'flight', date: '2026-03-12', fromCode: 'CTU', toCode: 'CAN', flightNo: '3U8881', airline: '3U', depTime: '11:20', arrTime: '13:40', seatClass: 'economy' },
      { type: 'flight', date: '2026-04-01', fromCode: 'CAN', toCode: 'SIN', flightNo: 'CZ351', airline: 'CZ', depTime: '15:00', arrTime: '19:05', seatClass: 'business' },
      { type: 'flight', date: '2026-04-05', fromCode: 'SIN', toCode: 'BKK', flightNo: 'SQ972', airline: 'SQ', depTime: '10:30', arrTime: '12:00', seatClass: 'economy' },
      { type: 'flight', date: '2026-04-08', fromCode: 'BKK', toCode: 'HKG', flightNo: 'CX750', airline: 'CX', depTime: '16:45', arrTime: '20:30', seatClass: 'economy' },
      { type: 'train', date: '2026-05-01', fromStation: '广州南', toStation: '深圳北', trainNo: 'G6001', depTime: '08:00', arrTime: '08:35', seatType: '一等座' },
      { type: 'flight', date: '2026-06-15', fromCode: 'SZX', toCode: 'NRT', flightNo: 'NH932', airline: 'NH', depTime: '09:30', arrTime: '14:45', seatClass: 'economy' },
      { type: 'flight', date: '2026-06-20', fromCode: 'KIX', toCode: 'PVG', flightNo: 'MU748', airline: 'MU', depTime: '15:00', arrTime: '16:30', seatClass: 'economy' },
    ];

    let added = 0;
    sampleTrips.forEach(t => {
      const trip = { ...t, id: genId(), createdAt: Date.now() };
      // Lookup coordinates
      if (t.type === 'flight' && t.fromCode && AIRPORTS[t.fromCode]) {
        const ap = AIRPORTS[t.fromCode];
        trip.fromLat = ap.lat;
        trip.fromLng = ap.lng;
        trip.fromCity = ap.city;
      }
      if (t.type === 'flight' && t.toCode && AIRPORTS[t.toCode]) {
        const ap = AIRPORTS[t.toCode];
        trip.toLat = ap.lat;
        trip.toLng = ap.lng;
        trip.toCity = ap.city;
      }
      if (t.type === 'train' && t.fromStation && STATIONS[t.fromStation]) {
        const st = STATIONS[t.fromStation];
        trip.fromLat = st.lat;
        trip.fromLng = st.lng;
        trip.fromCity = st.city;
      }
      if (t.type === 'train' && t.toStation && STATIONS[t.toStation]) {
        const st = STATIONS[t.toStation];
        trip.toLat = st.lat;
        trip.toLng = st.lng;
        trip.toCity = st.city;
      }
      // Calculate distance
      if (trip.fromLat && trip.toLat) {
        trip.distance = calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng);
        if (trip.type === 'train') trip.distance = Math.round(trip.distance * 1.3);
      }
      trip.duration = calcTripDuration(trip.depTime, trip.arrTime, trip.fromCode, trip.toCode);
      Store.add(trip);
      added++;
    });

    closeModal('settingsModal');
    showToast(`已添加 ${added} 条示例行程 🎉`);
    Trips.render();
    TravelMap.draw();
    TravelMap.updateSummary();
    Stats.render();
    Annual.render();
  };

  // Clear all data
  document.getElementById('btnClearAll').onclick = () => {
    showConfirm('确定要清空所有行程数据？此操作不可恢复！', () => {
      localStorage.removeItem('travellog_trips');
      Store.load(); // Refresh in-memory data
      closeModal('confirmModal');
      closeModal('settingsModal');
      showToast('已清空所有数据');
      Trips.render();
      TravelMap.draw();
      TravelMap.updateSummary();
      Stats.render();
      Annual.render();
    });
  };

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Loading screen - skip/shorten if returning user
  const hasData = localStorage.getItem(STORE_KEY);
  const loadDelay = hasData ? 200 : 800;
  setTimeout(() => {
    document.getElementById('loading').style.opacity = '0';
    document.getElementById('loading').style.transition = 'opacity 0.3s';
    document.getElementById('app').style.display = '';
    setTimeout(() => {
      document.getElementById('loading').remove();
      TravelMap.resize();
      // Show onboarding for first-time users
      if (!localStorage.getItem('tl_onboarded') && !localStorage.getItem(STORE_KEY)) {
        document.getElementById('onboarding').style.display = 'flex';
      }
    }, 300);
  }, loadDelay);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Escape to close modal
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal[style*="display: flex"], .modal[style*="display:flex"]');
      if (openModal) closeModal(openModal.id);
    }
    // N for new trip (when no modal open and not typing)
    if (e.key === 'n' && !document.querySelector('.modal[style*="display: flex"], .modal[style*="display:flex"]') && 
        !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      Trips.openAdd();
    }
    // 1-4 for tab switching
    if (!document.querySelector('.modal[style*="display: flex"], .modal[style*="display:flex"]') && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      const tabs = ['map', 'trips', 'stats', 'annual'];
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4) {
        const tab = document.querySelector(`[data-tab=${tabs[num-1]}]`);
        if (tab) tab.click();
      }
    }
  });

  // Add mode toggle (manual / AI)
  let _addMode = 'manual';
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _addMode = btn.dataset.mode;
      document.getElementById('manualFormSection').style.display = _addMode === 'manual' ? '' : 'none';
      document.getElementById('aiImportSection').style.display = _addMode === 'ai' ? '' : 'none';
      // Update save button text
      document.getElementById('btnSaveTrip').textContent = _addMode === 'ai' ? '导入' : '保存';
      // Hide delete/duplicate in AI mode
      document.getElementById('btnDeleteTrip').style.display = 'none';
      document.getElementById('btnDuplicateTrip').style.display = 'none';
    };
  });

  // AI inline copy prompt
  document.getElementById('btnCopyPromptInline').onclick = async () => {
    const text = document.getElementById('aiPromptInline').textContent;
    try {
      await navigator.clipboard.writeText(text);
      showToast('提示词已复制 ✅');
    } catch(e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('提示词已复制 ✅');
    }
  };

  // AI inline preview
  document.getElementById('aiPasteInput').addEventListener('input', () => {
    const raw = document.getElementById('aiPasteInput').value.trim();
    const preview = document.getElementById('aiPastePreview');
    if (!raw) { preview.innerHTML = ''; return; }
    const lines = raw.split('\n').filter(l => l.trim());
    const hasHeader = lines[0]?.startsWith('date,') || lines[0]?.includes(',type,');
    const dataCount = hasHeader ? lines.length - 1 : lines.length;
    preview.innerHTML = `<div style="font-size:12px;color:var(--accent);padding:6px 8px;background:var(--bg3);border-radius:6px">检测到 <b>${dataCount}</b> 条行程</div>`;
  });

  // Override save button to handle AI mode
  const _originalSaveTrip = document.getElementById('btnSaveTrip').onclick;
  document.getElementById('btnSaveTrip').onclick = () => {
    if (_addMode === 'ai') {
      const raw = document.getElementById('aiPasteInput').value.trim();
      if (!raw) { showToast('请粘贴CSV数据'); return; }
      try {
        const added = Store.importData(raw);
        closeModal('addTripModal');
        showToast(`导入成功，新增 ${added} 条行程 🎉`);
        Trips.render();
        TravelMap.draw();
        TravelMap.updateSummary();
        Stats.render();
        Annual.render();
      } catch(e) {
        showToast('导入失败：' + e.message, 4000);
      }
    } else {
      Trips.saveTrip();
    }
  };

  // ===== PWA Install Banner =====
  let _deferredPrompt = null;

  // Listen for beforeinstallprompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
  });

  // Check if already installed (standalone mode)
  function _isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  // Show banner after 3 minutes if conditions met
  function _maybeShowPWABanner() {
    if (_isPWAInstalled()) return;
    if (localStorage.getItem('tl_pwa_dismissed')) return;
    if (!_deferredPrompt) return;
    const banner = document.getElementById('pwaBanner');
    if (banner) banner.style.display = '';
  }

  setTimeout(_maybeShowPWABanner, 3 * 60 * 1000);

  // Install button
  document.getElementById('pwaBannerInstall').onclick = async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const result = await _deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      showToast('安装成功 🎉');
    }
    _deferredPrompt = null;
    document.getElementById('pwaBanner').style.display = 'none';
  };

  // Close button
  document.getElementById('pwaBannerClose').onclick = () => {
    document.getElementById('pwaBanner').style.display = 'none';
    localStorage.setItem('tl_pwa_dismissed', '1');
  };

  // Render initial trip list
  Trips.render();
})();

// Onboarding functions
let _onboardCurrentStep = 1;

// Form progressive disclosure toggle
function toggleFormExtra(type) {
  const extra = document.getElementById(type + 'FormExtra');
  const groupRow = document.getElementById('groupSelectorRow');
  const toggleBtn = extra.parentElement.querySelector('.form-toggle');
  if (extra.style.display === 'none') {
    extra.style.display = '';
    groupRow.style.display = '';
    toggleBtn.textContent = '▴ 收起详情';
    toggleBtn.classList.add('expanded');
  } else {
    extra.style.display = 'none';
    groupRow.style.display = 'none';
    toggleBtn.textContent = '▾ 更多详情';
    toggleBtn.classList.remove('expanded');
  }
}

function onboardNext(step) {
  _onboardCurrentStep = step;
  document.querySelectorAll('.onboard-step').forEach(s => s.style.display = 'none');
  const el = document.getElementById('onboardStep' + step);
  if (el) el.style.display = '';
  // Update dots
  document.querySelectorAll('.onboard-dot').forEach((d, i) => {
    d.classList.toggle('active', i + 1 === Math.min(step, 4));
  });
}

function onboardLoadSample() {
  _loadRichSampleData();
  closeModal('onboarding');
  // Short delay then show step 3
  setTimeout(() => {
    openModal('onboarding');
    onboardNext(3);
  }, 1500);
}

function onboardPlayMap() {
  closeModal('onboarding');
  // Switch to map tab and play
  document.querySelector('.tab[data-tab="map"]').click();
  setTimeout(() => {
    TravelMap._togglePlayback();
    // After animation (~10s), show step 4
    setTimeout(() => {
      openModal('onboarding');
      onboardNext(4);
    }, 12000);
  }, 500);
}

function onboardShareMap() {
  closeModal('onboarding');
  document.querySelector('.tab[data-tab="map"]').click();
  setTimeout(() => TravelMap.shareMap(), 500);
  localStorage.setItem('tl_onboarded', '1');
}

function onboardAddTrip() {
  localStorage.setItem('tl_onboarded', '1');
  closeModal('onboarding');
  // Open add trip form with pre-filled example
  Trips.openAdd();
  setTimeout(() => {
    // Pre-fill date
    const dateInput = document.getElementById('fDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    // Pre-fill flight number
    const flightInput = document.getElementById('fFlightNo');
    if (flightInput) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(flightInput, 'CA1234');
      flightInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 300);
}

function onboardFinish() {
  localStorage.setItem('tl_onboarded', '1');
  closeModal('onboarding');
  showToast('引导完成！开始记录你的旅程 🎉');
}

function onboardSample() {
  localStorage.setItem('tl_onboarded', '1');
  closeModal('onboarding');
  document.getElementById('btnAddSample').click();
}

// Rich sample data with travel groups
function _loadRichSampleData() {
  // Create travel groups
  const group1 = Store.addGroup('东南亚之旅');
  const group2 = Store.addGroup('日本自由行');
  const group3 = Store.addGroup('出差');

  const sampleTrips = [
    // 出差组
    { type: 'flight', date: '2026-01-15', fromCode: 'PEK', toCode: 'SHA', flightNo: 'CA1515', airline: 'CA', depTime: '08:00', arrTime: '10:15', seatClass: 'economy', seat: '32A', note: '年初出差', groupId: group3.id },
    { type: 'train', date: '2026-01-16', fromStation: '上海虹桥', toStation: '杭州东', trainNo: 'G7501', depTime: '09:00', arrTime: '10:05', seatType: '二等座', groupId: group3.id },
    { type: 'flight', date: '2026-02-20', fromCode: 'SHA', toCode: 'CTU', flightNo: 'MU5401', airline: 'MU', depTime: '14:30', arrTime: '17:45', seatClass: 'economy', groupId: group3.id },
    { type: 'train', date: '2026-03-05', fromStation: '广州南', toStation: '深圳北', trainNo: 'G6001', depTime: '08:00', arrTime: '08:35', seatType: '一等座', groupId: group3.id },
    // 东南亚之旅组
    { type: 'flight', date: '2026-04-01', fromCode: 'CAN', toCode: 'SIN', flightNo: 'CZ351', airline: 'CZ', depTime: '15:00', arrTime: '19:05', seatClass: 'business', seat: '1A', note: '期待已久的东南亚游', groupId: group1.id },
    { type: 'flight', date: '2026-04-05', fromCode: 'SIN', toCode: 'BKK', flightNo: 'SQ972', airline: 'SQ', depTime: '10:30', arrTime: '12:00', seatClass: 'economy', groupId: group1.id },
    { type: 'flight', date: '2026-04-08', fromCode: 'BKK', toCode: 'HKG', flightNo: 'CX750', airline: 'CX', depTime: '16:45', arrTime: '20:30', seatClass: 'economy', groupId: group1.id },
    { type: 'flight', date: '2026-04-09', fromCode: 'HKG', toCode: 'CAN', flightNo: 'CZ306', airline: 'CZ', depTime: '10:00', arrTime: '11:00', seatClass: 'economy', groupId: group1.id },
    // 日本自由行组
    { type: 'flight', date: '2026-06-15', fromCode: 'SZX', toCode: 'NRT', flightNo: 'NH932', airline: 'NH', depTime: '09:30', arrTime: '14:45', seatClass: 'economy', seat: '24C', note: '日本之旅开始！', groupId: group2.id },
    { type: 'train', date: '2026-06-17', fromStation: '东京', toStation: '大阪', trainNo: 'のぞみ231', depTime: '10:00', arrTime: '12:30', seatType: '指定席', groupId: group2.id },
    { type: 'flight', date: '2026-06-20', fromCode: 'KIX', toCode: 'PVG', flightNo: 'MU748', airline: 'MU', depTime: '15:00', arrTime: '16:30', seatClass: 'economy', groupId: group2.id },
    // 无组别
    { type: 'flight', date: '2026-03-12', fromCode: 'CTU', toCode: 'CAN', flightNo: '3U8881', airline: '3U', depTime: '11:20', arrTime: '13:40', seatClass: 'economy', note: '回广州' },
  ];

  let added = 0;
  sampleTrips.forEach(t => {
    const trip = { ...t };
    if (t.type === 'flight' && t.fromCode && AIRPORTS[t.fromCode]) {
      const ap = AIRPORTS[t.fromCode]; trip.fromLat = ap.lat; trip.fromLng = ap.lng; trip.fromCity = ap.city;
    }
    if (t.type === 'flight' && t.toCode && AIRPORTS[t.toCode]) {
      const ap = AIRPORTS[t.toCode]; trip.toLat = ap.lat; trip.toLng = ap.lng; trip.toCity = ap.city;
    }
    if (t.type === 'train' && t.fromStation && STATIONS[t.fromStation]) {
      const st = STATIONS[t.fromStation]; trip.fromLat = st.lat; trip.fromLng = st.lng; trip.fromCity = st.city;
    }
    if (t.type === 'train' && t.toStation && STATIONS[t.toStation]) {
      const st = STATIONS[t.toStation]; trip.toLat = st.lat; trip.toLng = st.lng; trip.toCity = st.city;
    }
    if (trip.fromLat && trip.toLat) {
      trip.distance = calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng);
      if (trip.type === 'train') trip.distance = Math.round(trip.distance * 1.3);
    }
    trip.duration = calcTripDuration(trip.depTime, trip.arrTime, trip.fromCode, trip.toCode);
    Store.add(trip);
    added++;
  });

  showToast(`已添加 ${added} 条示例行程（含3个旅行组）🎉`);
  Trips.render();
  TravelMap.draw();
  TravelMap.updateSummary();
  Stats.render();
  Annual.render();
}
