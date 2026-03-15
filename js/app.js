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
      } else if (tab.dataset.tab === 'trips') {
        Trips.render();
      } else if (tab.dataset.tab === 'stats') {
        Stats.render();
      } else if (tab.dataset.tab === 'annual') {
        Annual.render();
      }
    };
  });

  // Confirm modal buttons
  document.getElementById('confirmOk').onclick = () => {
    if (_confirmCb) _confirmCb();
    _confirmCb = null;
  };
  document.getElementById('confirmCancel').onclick = () => {
    closeModal('confirmModal');
    _confirmCb = null;
  };

  // Settings
  document.getElementById('btnSettings').onclick = () => openModal('settingsModal');

  // Export
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

  // Render initial trip list
  Trips.render();
})();
