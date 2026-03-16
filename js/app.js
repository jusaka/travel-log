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
  document.getElementById('btnSettings').onclick = () => openModal('settingsModal');

  // Theme toggle
  const updateThemeButtons = () => {
    const isLight = document.documentElement.classList.contains('light');
    document.getElementById('btnThemeDark').classList.toggle('active', !isLight);
    document.getElementById('btnThemeLight').classList.toggle('active', isLight);
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
  // Init theme from storage
  if (localStorage.getItem('travellog_theme') === 'light') {
    document.documentElement.classList.add('light');
  }
  updateThemeButtons();

  // Copy to clipboard
  document.getElementById('btnCopyData').onclick = async () => {
    const trips = Store.getAll();
    if (!trips.length) { showToast('没有数据'); return; }
    const data = Store.exportData();
    try {
      await navigator.clipboard.writeText(data);
      showToast(`已复制 ${trips.length} 条行程到剪贴板 ✅`);
    } catch(e) {
      const ta = document.createElement('textarea');
      ta.value = data; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`已复制 ${trips.length} 条行程到剪贴板 ✅`);
    }
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
        const added = Store.importData(ev.target.result);
        showToast(`导入成功，新增 ${added} 条行程`);
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
    const headers = ['date','type','fromCity','toCity','fromCode','toCode','fromStation','toStation','flightNo','trainNo','airline','depTime','arrTime','distance','duration','seatClass','seatType','seat','aircraft','note'];
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

  // Loading screen
  setTimeout(() => {
    document.getElementById('loading').style.opacity = '0';
    document.getElementById('loading').style.transition = 'opacity 0.3s';
    document.getElementById('app').style.display = '';
    setTimeout(() => {
      document.getElementById('loading').remove();
      TravelMap.resize();
    }, 300);
  }, 800);

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

  // Render initial trip list
  Trips.render();
})();
