// ===== Map Renderer =====

const TravelMap = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  baseScale: 1,
  isDragging: false,
  lastX: 0, lastY: 0,
  pinchDist: 0,
  animFrame: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.bindEvents();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
    this.resetView();
  },

  resetView() {
    // China bounds: approximately 73°E-135°E, 18°N-54°N
    // Center: ~105°E, 35°N
    // Map needs to fit 62° longitude and 36° latitude
    const chinaLngSpan = 62;  // degrees
    const chinaLatSpan = 36;  // degrees
    const chinaCenterLng = 105;
    const chinaCenterLat = 35;
    
    this.baseScale = Math.min(this.W / chinaLngSpan, this.H / chinaLatSpan) * 0.9; // 90% to have some margin
    this.scale = this.baseScale;
    this.centerLng = chinaCenterLng;
    this.centerLat = chinaCenterLat;
    this.draw();
  },

  // Equirectangular projection centered on China
  project(lat, lng) {
    const x = this.W / 2 + (lng - this.centerLng) * this.scale;
    const y = this.H / 2 - (lat - this.centerLat) * this.scale;
    return [x, y];
  },

  bindEvents() {
    const c = this.canvas;
    // Mouse
    c.addEventListener('mousedown', e => this.onPointerDown(e.clientX, e.clientY));
    c.addEventListener('mousemove', e => { if(this.isDragging) this.onPointerMove(e.clientX, e.clientY) });
    c.addEventListener('mouseup', () => this.isDragging = false);
    c.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY) }, {passive:false});
    // Touch
    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this.pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, {passive:true});
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        this.onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (this.pinchDist > 0) this.zoom(d / this.pinchDist, cx, cy);
        this.pinchDist = d;
      }
    }, {passive:false});
    c.addEventListener('touchend', () => { this.isDragging = false; this.pinchDist = 0 });

    // Zoom buttons
    document.getElementById('btnZoomIn').onclick = () => this.zoom(1.3, this.W/2, this.H/2);
    document.getElementById('btnZoomOut').onclick = () => this.zoom(0.7, this.W/2, this.H/2);
    document.getElementById('btnResetView').onclick = () => this.resetView();
  },

  onPointerDown(x, y) {
    this.isDragging = true;
    this.lastX = x;
    this.lastY = y;
  },

  onPointerMove(x, y) {
    // Pan: move the center point
    const dx = (x - this.lastX) / this.scale;
    const dy = (y - this.lastY) / this.scale;
    this.centerLng -= dx;
    this.centerLat += dy;
    this.lastX = x;
    this.lastY = y;
    this.draw();
  },

  zoom(factor, cx, cy) {
    const newScale = Math.max(this.baseScale * 0.5, Math.min(this.baseScale * 20, this.scale * factor));
    // Zoom toward the cursor position
    const lngAtCursor = this.centerLng + (cx - this.W/2) / this.scale;
    const latAtCursor = this.centerLat - (cy - this.H/2) / this.scale;
    
    this.scale = newScale;
    
    // Adjust center so cursor stays at same geo position
    this.centerLng = lngAtCursor - (cx - this.W/2) / this.scale;
    this.centerLat = latAtCursor + (cy - this.H/2) / this.scale;
    
    this.draw();
  },

  draw() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.animFrame = requestAnimationFrame(() => this._draw());
  },

  _draw() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, W, H);

    const trips = Store.getAll();
    if (trips.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('添加行程后，您的旅行足迹将在这里展现', W/2, H/2);
      return;
    }

    // Draw routes
    const flights = trips.filter(t => t.type === 'flight' && t.fromLat != null && t.toLat != null);
    const trains = trips.filter(t => t.type === 'train' && t.fromLat != null && t.toLat != null);

    // Draw train routes (green, straight lines)
    trains.forEach(t => {
      const [x1, y1] = this.project(t.fromLat, t.fromLng);
      const [x2, y2] = this.project(t.toLat, t.toLng);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(16,185,129,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Draw flight routes (amber, curved arcs)
    flights.forEach(f => {
      const [x1, y1] = this.project(f.fromLat, f.fromLng);
      const [x2, y2] = this.project(f.toLat, f.toLng);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      // Arc height proportional to distance
      const arcH = dist * 0.2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const cpx = mx - arcH * Math.sin(angle);
      const cpy = my + arcH * Math.cos(angle);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.strokeStyle = 'rgba(245,158,11,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Collect unique endpoints
    const endpoints = new Map(); // key: "lat,lng" -> { lat, lng, city, type, count }
    [...flights, ...trains].forEach(t => {
      const addPoint = (lat, lng, city, type) => {
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (!endpoints.has(key)) {
          endpoints.set(key, { lat, lng, city, types: new Set(), count: 0 });
        }
        const ep = endpoints.get(key);
        ep.types.add(type);
        ep.count++;
      };
      addPoint(t.fromLat, t.fromLng, t.fromCity, t.type);
      addPoint(t.toLat, t.toLng, t.toCity, t.type);
    });

    // Draw endpoints
    endpoints.forEach(ep => {
      const [x, y] = this.project(ep.lat, ep.lng);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;

      const hasFlight = ep.types.has('flight');
      const hasTrain = ep.types.has('train');
      const r = Math.min(4 + ep.count * 0.5, 8);

      // Glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      const color = hasFlight ? 'rgba(245,158,11,' : 'rgba(16,185,129,';
      grad.addColorStop(0, color + '0.3)');
      grad.addColorStop(1, color + '0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r*3, y - r*3, r*6, r*6);

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = hasFlight ? '#f59e0b' : '#10b981';
      ctx.fill();

      if (hasFlight && hasTrain) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
      }

      // Label
      const zoom = this.scale / this.baseScale;
      if (zoom > 1.5 || ep.count >= 3) {
        ctx.fillStyle = '#d1d5db';
        ctx.font = `${Math.max(9, 11)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ep.city || '', x, y - r - 4);
      }
    });
  },

  updateSummary() {
    const trips = Store.getAll();
    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');
    const cities = new Set();
    trips.forEach(t => { if(t.fromCity) cities.add(t.fromCity); if(t.toCity) cities.add(t.toCity); });
    
    document.getElementById('mapFlightCount').textContent = flights.length + ' 次飞行';
    document.getElementById('mapTrainCount').textContent = trains.length + ' 次高铁';
    document.getElementById('mapCityCount').textContent = cities.size + ' 个城市';
  },
};
