// ===== Map Renderer v2 =====

const TravelMap = {
  canvas: null,
  ctx: null,
  scale: 1,
  centerLng: 105,
  centerLat: 35,
  baseScale: 1,
  isDragging: false,
  _animPhase: 0,
  _animFrame: null,
  lastX: 0, lastY: 0,
  pinchDist: 0,
  animFrame: null,
  geoData: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.bindEvents();
    window.addEventListener('resize', () => this.resize());
    // Load geo data
    fetch('/data/world.json')
      .then(r => r.json())
      .then(d => { this.geoData = d; this.draw(); })
      .catch(() => { /* no geo data */ });
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
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
    // Auto-fit view to all trip endpoints
    const trips = Store.getAll();
    if (trips.length > 0) {
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      trips.forEach(t => {
        [t.fromLat, t.toLat].forEach(lat => { if (lat != null) { minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); }});
        [t.fromLng, t.toLng].forEach(lng => { if (lng != null) { minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng); }});
      });
      // Add padding
      const latPad = Math.max((maxLat - minLat) * 0.15, 3);
      const lngPad = Math.max((maxLng - minLng) * 0.15, 5);
      minLat -= latPad; maxLat += latPad;
      minLng -= lngPad; maxLng += lngPad;
      this.centerLat = (minLat + maxLat) / 2;
      this.centerLng = (minLng + maxLng) / 2;
      const lngSpan = maxLng - minLng;
      const latSpan = maxLat - minLat;
      this.baseScale = Math.min(this.W / lngSpan, this.H / latSpan) * 0.9;
      this.scale = this.baseScale;
    } else {
      // Default: China centered
      const chinaLngSpan = 62;
      const chinaLatSpan = 36;
      this.baseScale = Math.min(this.W / chinaLngSpan, this.H / chinaLatSpan) * 0.9;
      this.scale = this.baseScale;
      this.centerLng = 105;
      this.centerLat = 35;
    }
    this.draw();
  },

  project(lat, lng) {
    const x = this.W / 2 + (lng - this.centerLng) * this.scale;
    const y = this.H / 2 - (lat - this.centerLat) * this.scale;
    return [x, y];
  },

  unproject(x, y) {
    const lng = (x - this.W / 2) / this.scale + this.centerLng;
    const lat = -(y - this.H / 2) / this.scale + this.centerLat;
    return [lat, lng];
  },

  bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => this.onPointerDown(e.clientX, e.clientY - c.getBoundingClientRect().top));
    c.addEventListener('mousemove', e => {
      if (this.isDragging) {
        this.onPointerMove(e.clientX, e.clientY - c.getBoundingClientRect().top);
      } else {
        this._checkHover(e.offsetX, e.offsetY);
      }
    });
    c.addEventListener('mouseleave', () => { document.getElementById('mapTooltip').style.display = 'none'; });
    window.addEventListener('mousemove', e => { if (this.isDragging) this.onPointerMove(e.clientX, e.clientY - c.getBoundingClientRect().top); });
    window.addEventListener('mouseup', () => this.isDragging = false);
    c.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 0.85 : 1.15, e.offsetX, e.offsetY); }, { passive: false });

    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        const r = c.getBoundingClientRect();
        const tx = e.touches[0].clientX - r.left;
        const ty = e.touches[0].clientY - r.top;
        this._touchStartX = tx;
        this._touchStartY = ty;
        this._touchStartTime = Date.now();
        this.onPointerDown(tx, ty);
      } else if (e.touches.length === 2) {
        this.pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this.isDragging = false;
      }
    }, { passive: true });

    c.addEventListener('touchend', e => {
      this.isDragging = false;
      this.pinchDist = 0;
      // Detect tap (short, minimal movement)
      if (this._touchStartTime && Date.now() - this._touchStartTime < 300) {
        const r = c.getBoundingClientRect();
        const endX = e.changedTouches[0]?.clientX - r.left || this._touchStartX;
        const endY = e.changedTouches[0]?.clientY - r.top || this._touchStartY;
        if (Math.hypot(endX - this._touchStartX, endY - this._touchStartY) < 10) {
          this._checkHover(endX, endY, true);
        }
      }
      this._touchStartTime = 0;
    });

    c.addEventListener('touchmove', e => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      if (e.touches.length === 1 && this.isDragging) {
        this.onPointerMove(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        if (this.pinchDist > 0) this.zoom(d / this.pinchDist, cx, cy);
        this.pinchDist = d;
      }
    }, { passive: false });

    document.getElementById('btnZoomIn').onclick = () => this.zoom(1.4, this.W / 2, this.H / 2);
    document.getElementById('btnZoomOut').onclick = () => this.zoom(0.7, this.W / 2, this.H / 2);
    document.getElementById('btnResetView').onclick = () => this.resetView();
  },

  onPointerDown(x, y) {
    this.isDragging = true;
    this.lastX = x;
    this.lastY = y;
  },

  onPointerMove(x, y) {
    const dx = (x - this.lastX) / this.scale;
    const dy = (y - this.lastY) / this.scale;
    this.centerLng -= dx;
    this.centerLat += dy;
    this.lastX = x;
    this.lastY = y;
    this.draw();
  },

  zoom(factor, cx, cy) {
    const newScale = Math.max(this.baseScale * 0.4, Math.min(this.baseScale * 30, this.scale * factor));
    const lngAtCursor = this.centerLng + (cx - this.W / 2) / this.scale;
    const latAtCursor = this.centerLat - (cy - this.H / 2) / this.scale;
    this.scale = newScale;
    this.centerLng = lngAtCursor - (cx - this.W / 2) / this.scale;
    this.centerLat = latAtCursor + (cy - this.H / 2) / this.scale;
    this.draw();
  },

  draw() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this._startAnimation();
  },

  _startAnimation() {
    const animate = () => {
      this._animPhase = (this._animPhase + 0.003) % 1; // Slow smooth movement
      this._draw();
      this._animFrame = requestAnimationFrame(animate);
    };
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this._animFrame = requestAnimationFrame(animate);
  },

  stopAnimation() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  },

  // Draw GeoJSON polygon ring
  _drawRing(ctx, coords) {
    if (!coords || coords.length < 2) return;
    const [x0, y0] = this.project(coords[0][1], coords[0][0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < coords.length; i++) {
      const [x, y] = this.project(coords[i][1], coords[i][0]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  },

  _drawGeo(ctx) {
    if (!this.geoData) return;
    ctx.beginPath();
    for (const feature of this.geoData.features) {
      const geom = feature.geometry;
      if (!geom) continue;
      if (geom.type === 'Polygon') {
        for (const ring of geom.coordinates) this._drawRing(ctx, ring);
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates)
          for (const ring of poly) this._drawRing(ctx, ring);
      }
    }
    // Theme-aware colors
    const isLight = document.documentElement.classList.contains('light');
    ctx.fillStyle = isLight ? 'rgba(229, 231, 235, 0.5)' : 'rgba(20, 30, 50, 0.85)';
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },

  _draw() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const isLight = document.documentElement.classList.contains('light');
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
    if (isLight) {
      bgGrad.addColorStop(0, '#f9fafb');
      bgGrad.addColorStop(1, '#e5e7eb');
    } else {
      bgGrad.addColorStop(0, '#0d1b2e');
      bgGrad.addColorStop(1, '#070d18');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Draw geographic borders
    this._drawGeo(ctx);

    // Empty state
    const trips = Store.getAll();
    if (trips.length === 0) {
      ctx.fillStyle = isLight ? 'rgba(75, 85, 99, 0.6)' : 'rgba(107, 114, 128, 0.8)';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('添加行程后，您的旅行足迹将在这里展现', W / 2, H / 2 + 20);
      return;
    }

    // Count route frequency (both directions merged)
    const routeFreq = {};
    let maxFreq = 1;
    trips.forEach(t => {
      if (!t.fromLat || !t.toLat) return;
      const a = `${t.fromLat.toFixed(2)},${t.fromLng.toFixed(2)}`;
      const b = `${t.toLat.toFixed(2)},${t.toLng.toFixed(2)}`;
      // Merge both directions
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      routeFreq[key] = (routeFreq[key] || 0) + 1;
      if (routeFreq[key] > maxFreq) maxFreq = routeFreq[key];
    });
    // Helper to get freq for a trip
    const getFreq = t => {
      const a = `${t.fromLat.toFixed(2)},${t.fromLng.toFixed(2)}`;
      const b = `${t.toLat.toFixed(2)},${t.toLng.toFixed(2)}`;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      return routeFreq[key] || 1;
    };

    const flights = trips.filter(t => t.type === 'flight' && t.fromLat != null && t.toLat != null);
    const trains = trips.filter(t => t.type === 'train' && t.fromLat != null && t.toLat != null);

    // Deduplicate routes - draw each route only once with combined frequency
    const drawnTrainRoutes = new Set();
    trains.forEach(t => {
      const a = `${t.fromLat.toFixed(2)},${t.fromLng.toFixed(2)}`;
      const b = `${t.toLat.toFixed(2)},${t.toLng.toFixed(2)}`;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (drawnTrainRoutes.has(key)) return;
      drawnTrainRoutes.add(key);

      const [x1, y1] = this.project(t.fromLat, t.fromLng);
      const [x2, y2] = this.project(t.toLat, t.toLng);
      const freq = getFreq(t);
      const lw = 1 + Math.log2(freq + 1) * 1.5;

      // Glow
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(16,185,129,${0.08 + freq * 0.04})`;
      ctx.lineWidth = lw + 4;
      ctx.stroke();

      // Line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(16,185,129,${0.5 + Math.min(freq * 0.1, 0.4)})`;
      ctx.lineWidth = lw;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw flight routes - deduplicate, thicker = more frequent
    const drawnFlightRoutes = new Set();
    flights.forEach(f => {
      const a = `${f.fromLat.toFixed(2)},${f.fromLng.toFixed(2)}`;
      const b = `${f.toLat.toFixed(2)},${f.toLng.toFixed(2)}`;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (drawnFlightRoutes.has(key)) return;
      drawnFlightRoutes.add(key);

      const [x1, y1] = this.project(f.fromLat, f.fromLng);
      const [x2, y2] = this.project(f.toLat, f.toLng);
      const freq = getFreq(f);
      const lw = 1 + Math.log2(freq + 1) * 1.8;

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const arcH = dist * 0.22;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const cpx = mx - arcH * Math.sin(angle);
      const cpy = my + arcH * Math.cos(angle);

      // Glow - intensity based on frequency
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.strokeStyle = `rgba(245,158,11,${0.06 + freq * 0.04})`;
      ctx.lineWidth = lw + 5;
      ctx.stroke();

      // Animated-style gradient arc
      const alpha = 0.3 + Math.min(freq * 0.12, 0.6);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, `rgba(245,158,11,${alpha * 0.5})`);
      grad.addColorStop(0.5, `rgba(251,191,36,${alpha})`);
      grad.addColorStop(1, `rgba(245,158,11,${alpha * 0.5})`);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw;
      ctx.stroke();

      // Frequency badge for hot routes
      if (freq >= 4 && dist > 40) {
        const badgeT = 0.5;
        const bx = (1-badgeT)*(1-badgeT)*x1 + 2*(1-badgeT)*badgeT*cpx + badgeT*badgeT*x2;
        const by = (1-badgeT)*(1-badgeT)*y1 + 2*(1-badgeT)*badgeT*cpy + badgeT*badgeT*y2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(245,158,11,0.9)';
        ctx.fill();
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(freq + '', bx, by);
        ctx.restore();
      }

      // Arrow at destination
      if (dist > 30) {
        const t = 0.85;
        const ax = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpx + t * t * x2;
        const ay = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpy + t * t * y2;
        const dx2 = 2 * (1 - t) * (cpx - x1) + 2 * t * (x2 - cpx);
        const dy2 = 2 * (1 - t) * (cpy - y1) + 2 * t * (y2 - cpy);
        const arrAngle = Math.atan2(dy2, dx2);
        const arrowSize = Math.min(6, dist * 0.06);
        ctx.beginPath();
        ctx.moveTo(ax + arrowSize * Math.cos(arrAngle), ay + arrowSize * Math.sin(arrAngle));
        ctx.lineTo(ax + arrowSize * Math.cos(arrAngle + 2.5), ay + arrowSize * Math.sin(arrAngle + 2.5));
        ctx.lineTo(ax + arrowSize * Math.cos(arrAngle - 2.5), ay + arrowSize * Math.sin(arrAngle - 2.5));
        ctx.closePath();
        ctx.fillStyle = 'rgba(251,191,36,0.85)';
        ctx.fill();
      }
    });

    // Draw animated plane icons on flight routes
    const phase = this._animPhase;
    flights.forEach((f, i) => {
      const [x1, y1] = this.project(f.fromLat, f.fromLng);
      const [x2, y2] = this.project(f.toLat, f.toLng);
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (dist < 20) return;

      const arcH = dist * 0.22;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const cpx = mx - arcH * Math.sin(angle);
      const cpy = my + arcH * Math.cos(angle);

      // Each plane has different phase offset
      const t = ((phase + i * 0.15) % 1);
      const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpx + t * t * x2;
      const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpy + t * t * y2;
      // Direction tangent
      const dx = 2 * (1 - t) * (cpx - x1) + 2 * t * (x2 - cpx);
      const dy = 2 * (1 - t) * (cpy - y1) + 2 * t * (y2 - cpy);
      const dir = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(dir);
      const planeSize = Math.max(12, Math.min(18, dist * 0.08));
      ctx.font = `${planeSize}px sans-serif`;
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✈', 0, 0);
      ctx.restore();
    });

    // Collect endpoints - merge same-city airports
    const endpoints = new Map();
    [...flights, ...trains].forEach(t => {
      const addPoint = (lat, lng, city, type) => {
        if (!lat || !lng) return;
        // Group by city name to merge multi-airport cities (SHA+PVG→上海)
        const key = city || `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (!endpoints.has(key)) endpoints.set(key, { lat, lng, city, types: new Set(), count: 0, _lats: [], _lngs: [] });
        const ep = endpoints.get(key);
        ep.types.add(type);
        ep.count++;
        ep._lats.push(lat);
        ep._lngs.push(lng);
        // Use average position for multi-airport cities
        ep.lat = ep._lats.reduce((a, b) => a + b) / ep._lats.length;
        ep.lng = ep._lngs.reduce((a, b) => a + b) / ep._lngs.length;
      };
      addPoint(t.fromLat, t.fromLng, t.fromCity, t.type);
      addPoint(t.toLat, t.toLng, t.toCity, t.type);
    });

    // Draw endpoints
    const zoom = this.scale / this.baseScale;
    const labelsToDraw = [];
    endpoints.forEach(ep => {
      const [x, y] = this.project(ep.lat, ep.lng);
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) return;

      const hasFlight = ep.types.has('flight');
      const hasTrain = ep.types.has('train');
      const r = Math.min(3 + ep.count * 1.2, 9);
      const color = hasFlight ? '#f59e0b' : '#10b981';

      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = hasFlight ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
      ctx.fill();

      // Glow ring
      ctx.beginPath();
      ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = hasFlight ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';
      ctx.fill();

      // Main dot
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner core (white shine)
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();

      // Second ring if both types
      if (hasFlight && hasTrain) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // City label - collect for smart placement later
      if (ep.city && (zoom >= 1.0 || ep.count >= 2)) {
        const fontSize = Math.round(9 + Math.min(ep.count, 3) + (zoom > 1.5 ? 2 : 0));
        labelsToDraw.push({ x, y: y - r - 5, text: ep.city, fontSize, color: hasFlight ? '#fbbf24' : '#34d399', r });
      }
    });

    // Smart label placement - avoid overlaps
    const labelRects = [];
    labelsToDraw.forEach(label => {
      ctx.font = `bold ${label.fontSize}px -apple-system, sans-serif`;
      const tw = ctx.measureText(label.text).width;
      const th = label.fontSize;
      // Try positions: top, right, left, bottom
      const positions = [
        { x: label.x, y: label.y, ax: 'center' },           // top
        { x: label.x + label.r + 4, y: label.y + label.r + th/2, ax: 'left' },   // right
        { x: label.x - label.r - 4, y: label.y + label.r + th/2, ax: 'right' },  // left
        { x: label.x, y: label.y + label.r * 2 + th + 4, ax: 'center' },         // bottom
      ];
      let placed = false;
      for (const pos of positions) {
        const lx = pos.ax === 'center' ? pos.x - tw/2 : pos.ax === 'left' ? pos.x : pos.x - tw;
        const ly = pos.y - th;
        const rect = { x: lx - 2, y: ly - 1, w: tw + 4, h: th + 2 };
        // Check overlap with existing labels
        const overlaps = labelRects.some(r => !(rect.x + rect.w < r.x || rect.x > r.x + r.w || rect.y + rect.h < r.y || rect.y > r.y + r.h));
        if (!overlaps) {
          labelRects.push(rect);
          ctx.font = `bold ${label.fontSize}px -apple-system, sans-serif`;
          ctx.textAlign = pos.ax;
          ctx.strokeStyle = 'rgba(7,13,24,0.9)';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText(label.text, pos.x, pos.y);
          ctx.fillStyle = label.color;
          ctx.fillText(label.text, pos.x, pos.y);
          placed = true;
          break;
        }
      }
      // If all positions overlap, draw at default with reduced opacity
      if (!placed) {
        ctx.font = `bold ${label.fontSize}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = 'rgba(7,13,24,0.9)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(label.text, label.x, label.y);
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, label.x, label.y);
        ctx.globalAlpha = 1;
      }
    });
  },

  _checkHover(mx, my, isTap) {
    const trips = Store.getAll();
    if (!trips.length) return;

    const endpoints = new Map();
    trips.forEach(t => {
      const addPoint = (lat, lng, city, type) => {
        if (!lat || !lng) return;
        // Group by city name (merge multi-airport cities)
        const key = city || `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (!endpoints.has(key)) endpoints.set(key, { lat, lng, city, types: new Set(), flightCount: 0, trainCount: 0, _lats: [], _lngs: [] });
        const ep = endpoints.get(key);
        ep.types.add(type);
        if (type === 'flight') ep.flightCount++;
        else ep.trainCount++;
        ep._lats.push(lat);
        ep._lngs.push(lng);
        ep.lat = ep._lats.reduce((a, b) => a + b) / ep._lats.length;
        ep.lng = ep._lngs.reduce((a, b) => a + b) / ep._lngs.length;
      };
      addPoint(t.fromLat, t.fromLng, t.fromCity, t.type);
      addPoint(t.toLat, t.toLng, t.toCity, t.type);
    });

    const tooltip = document.getElementById('mapTooltip');
    let found = false;
    endpoints.forEach(ep => {
      if (found) return;
      const [x, y] = this.project(ep.lat, ep.lng);
      const r = Math.min(3 + (ep.flightCount + ep.trainCount) * 1.2, 9) * 2.5; // hover radius
      if (Math.hypot(mx - x, my - y) < r + 6) {
        found = true;
        tooltip.style.display = 'block';
        // Position tooltip
        const px = Math.min(mx + 12, this.W - 140);
        const py = Math.max(my - 80, 8);
        tooltip.style.left = px + 'px';
        tooltip.style.top = py + 'px';
        const totalTrips = ep.flightCount + ep.trainCount;
        tooltip.innerHTML = `<div class="tt-city">${escHtml(ep.city || '未知')}</div>
          ${ep.flightCount > 0 ? `<div class="tt-row"><span>✈️ 飞行</span><span>${ep.flightCount} 次</span></div>` : ''}
          ${ep.trainCount > 0 ? `<div class="tt-row"><span>🚄 高铁</span><span>${ep.trainCount} 次</span></div>` : ''}
          <div class="tt-row"><span>合计</span><span>${totalTrips} 次</span></div>
          <div style="margin-top:8px;text-align:center;font-size:11px;color:var(--accent);cursor:pointer" class="tt-view-trips" data-city="${escHtml(ep.city || '')}">查看该城市行程 →</div>`;
        
        // Add click handler for "view trips" link
        const viewBtn = tooltip.querySelector('.tt-view-trips');
        if (viewBtn) {
          viewBtn.onclick = () => {
            const city = viewBtn.dataset.city;
            tooltip.style.display = 'none';
            // Switch to trips tab and search for city
            document.querySelector('[data-tab=trips]').click();
            const searchInput = document.getElementById('tripSearch');
            searchInput.value = city;
            searchInput.dispatchEvent(new Event('input'));
          };
        }
      }
    });
    if (!found) {
      tooltip.style.display = 'none';
      tooltip.style.pointerEvents = 'none';
    } else if (isTap) {
      tooltip.style.pointerEvents = 'auto';
      // Auto-hide after 5s on mobile tap
      clearTimeout(this._tooltipTimer);
      this._tooltipTimer = setTimeout(() => { tooltip.style.display = 'none'; tooltip.style.pointerEvents = 'none'; }, 5000);
    }
  },

  updateSummary() {
    const trips = Store.getAll();
    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');
    const cities = new Set();
    trips.forEach(t => { if (t.fromCity) cities.add(t.fromCity); if (t.toCity) cities.add(t.toCity); });
    document.getElementById('mapFlightCount').textContent = flights.length + ' 次飞行';
    document.getElementById('mapTrainCount').textContent = trains.length + ' 次高铁';
    document.getElementById('mapCityCount').textContent = cities.size + ' 个城市';
  },
};
