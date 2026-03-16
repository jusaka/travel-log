// ===== Data Store (localStorage) =====

const STORE_KEY = 'travellog_trips';
const GROUPS_KEY = 'travellog_groups';

const Store = {
  _trips: [],
  _groups: [],

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      this._trips = raw ? JSON.parse(raw) : [];
    } catch(e) {
      this._trips = [];
    }
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      this._groups = raw ? JSON.parse(raw) : [];
    } catch(e) {
      this._groups = [];
    }
    // Sort by date desc
    this._trips.sort((a, b) => b.date.localeCompare(a.date));
  },

  save() {
    const data = JSON.stringify(this._trips);
    try {
      localStorage.setItem(STORE_KEY, data);
      localStorage.setItem(GROUPS_KEY, JSON.stringify(this._groups));
    } catch(e) {
      showToast('⚠️ 存储空间不足，请导出备份数据！');
      return;
    }
    // Warn if approaching localStorage limit (>4MB of ~5MB)
    const usedBytes = new Blob([data]).size;
    if (usedBytes > 4 * 1024 * 1024) {
      showToast('⚠️ 数据量已接近上限，建议导出备份');
    }
  },

  getAll() { return this._trips; },

  getById(id) { return this._trips.find(t => t.id === id); },

  add(trip) {
    trip.id = genId();
    trip.createdAt = new Date().toISOString();
    this._trips.push(trip);
    this._trips.sort((a, b) => b.date.localeCompare(a.date));
    this.save();
    return trip;
  },

  update(id, data) {
    const idx = this._trips.findIndex(t => t.id === id);
    if (idx >= 0) {
      Object.assign(this._trips[idx], data);
      this._trips.sort((a, b) => b.date.localeCompare(a.date));
      this.save();
    }
  },

  delete(id) {
    this._trips = this._trips.filter(t => t.id !== id);
    // Also remove from any groups
    this._groups.forEach(g => { g.tripIds = g.tripIds.filter(tid => tid !== id); });
    this.save();
  },

  // ===== Trip Groups =====
  getGroups() { return this._groups; },

  getGroupById(id) { return this._groups.find(g => g.id === id); },

  addGroup(name, tripIds = []) {
    const group = { id: genId(), name, tripIds, createdAt: new Date().toISOString() };
    this._groups.push(group);
    // Set groupId on trips
    tripIds.forEach(tid => {
      const t = this.getById(tid);
      if (t) t.groupId = group.id;
    });
    this.save();
    return group;
  },

  updateGroup(id, data) {
    const g = this._groups.find(g => g.id === id);
    if (g) {
      Object.assign(g, data);
      // Update trip groupId references
      this._trips.forEach(t => { if (t.groupId === id && !g.tripIds.includes(t.id)) delete t.groupId; });
      g.tripIds.forEach(tid => {
        const t = this.getById(tid);
        if (t) t.groupId = id;
      });
      this.save();
    }
  },

  deleteGroup(id) {
    this._groups = this._groups.filter(g => g.id !== id);
    this._trips.forEach(t => { if (t.groupId === id) delete t.groupId; });
    this.save();
  },

  getGroupForTrip(tripId) {
    return this._groups.find(g => g.tripIds.includes(tripId));
  },

  // Get unique years
  getYears() {
    const years = new Set(this._trips.map(t => getYear(t.date)));
    return [...years].sort((a, b) => b - a);
  },

  // Get trips by year
  getByYear(year) {
    return this._trips.filter(t => getYear(t.date) === year);
  },

  // Get trips by type
  getByType(type) {
    if (type === 'all') return this._trips;
    return this._trips.filter(t => t.type === type);
  },

  // Stats
  getStats() {
    const trips = this._trips;
    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');

    let totalFlightKm = 0, totalTrainKm = 0;
    let totalFlightMins = 0, totalTrainMins = 0;
    let totalPrice = 0;
    const cities = new Set();
    const airports = new Set();
    const stations = new Set();
    const airlines = {};
    const fromCities = {};
    const toCities = {};

    flights.forEach(f => {
      const d = f.distance || 0;
      totalFlightKm += d;
      totalFlightMins += f.duration || 0;
      if (f.price) totalPrice += f.price;
      if (f.fromCode) airports.add(f.fromCode);
      if (f.toCode) airports.add(f.toCode);
      if (f.fromCity) { cities.add(f.fromCity); fromCities[f.fromCity] = (fromCities[f.fromCity]||0)+1; }
      if (f.toCity) { cities.add(f.toCity); toCities[f.toCity] = (toCities[f.toCity]||0)+1; }
      if (f.airline && AIRLINES[f.airline]) {
        airlines[f.airline] = (airlines[f.airline]||0)+1;
      }
    });

    trains.forEach(t => {
      const d = t.distance || 0;
      totalTrainKm += d;
      totalTrainMins += t.duration || 0;
      if (t.price) totalPrice += t.price;
      if (t.fromCity) { cities.add(t.fromCity); fromCities[t.fromCity] = (fromCities[t.fromCity]||0)+1; }
      if (t.toCity) { cities.add(t.toCity); toCities[t.toCity] = (toCities[t.toCity]||0)+1; }
      if (t.fromStation) stations.add(t.fromStation);
      if (t.toStation) stations.add(t.toStation);
    });

    // Merge from/to city counts
    const cityCounts = {};
    for (const c in fromCities) cityCounts[c] = (cityCounts[c]||0) + fromCities[c];
    for (const c in toCities) cityCounts[c] = (cityCounts[c]||0) + toCities[c];

    // Calculate streaks and records
    const sortedDates = [...new Set(trips.map(t => t.date))].sort();
    let maxStreak = 0, currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i-1]);
      const curr = new Date(sortedDates[i]);
      const dayDiff = (curr - prev) / (1000 * 60 * 60 * 24);
      if (dayDiff <= 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);

    // Longest single trip
    const longestTrip = trips.reduce((max, t) => (t.distance || 0) > (max?.distance || 0) ? t : max, trips[0]);
    // Shortest single trip
    const shortestTrip = trips.filter(t => t.distance > 0).reduce((min, t) => t.distance < (min?.distance || Infinity) ? t : min, null);
    // Most active month
    const monthCounts = {};
    trips.forEach(t => {
      const m = t.date?.substring(0, 7);
      if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
    });
    const busiestMonth = Object.entries(monthCounts).sort((a,b) => b[1] - a[1])[0];

    // Top routes (merge bidirectional)
    const routeCounts = {};
    trips.forEach(t => {
      const a = t.fromCity || '';
      const b = t.toCity || '';
      if (!a || !b) return;
      const key = a < b ? `${a}↔${b}` : `${b}↔${a}`;
      routeCounts[key] = (routeCounts[key] || 0) + 1;
    });

    return {
      totalTrips: trips.length,
      flightCount: flights.length,
      trainCount: trains.length,
      totalFlightKm, totalTrainKm,
      totalKm: totalFlightKm + totalTrainKm,
      totalFlightMins, totalTrainMins,
      totalMins: totalFlightMins + totalTrainMins,
      totalPrice,
      cityCount: cities.size,
      airportCount: airports.size,
      stationCount: stations.size,
      cities: cityCounts,
      airlines,
      topCities: Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0,10),
      topAirlines: Object.entries(airlines).sort((a,b)=>b[1]-a[1]).slice(0,5),
      topRoutes: Object.entries(routeCounts).sort((a,b)=>b[1]-a[1]).slice(0,8),
      maxStreak,
      longestTrip,
      shortestTrip,
      busiestMonth,
    };
  },

  // Export
  exportData() {
    return JSON.stringify({
      version: 2,
      app: 'travellog',
      exported: new Date().toISOString(),
      trips: this._trips,
      groups: this._groups,
    }, null, 2);
  },

  // Import - supports both JSON and CSV
  importData(data) {
    // Check if it's CSV (starts with known header or date)
    const trimmed = data.trim();
    if (trimmed.startsWith('date,') || /^\d{4}-\d{2}-\d{2}/.test(trimmed.split('\n')[0])) {
      return this._importCSV(trimmed);
    }
    return this._importJSON(data);
  },

  _importJSON(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      // Support both { app:'travellog', trips:[...] } and plain array [...]
      let trips;
      if (Array.isArray(data)) {
        trips = data;
      } else if (data.app === 'travellog' && Array.isArray(data.trips)) {
        trips = data.trips;
        // v2: also restore groups if present
        if (Array.isArray(data.groups)) {
          const existingGroupIds = new Set(this._groups.map(g => g.id));
          data.groups.forEach(g => {
            if (!existingGroupIds.has(g.id)) this._groups.push(g);
          });
        }
      } else if (Array.isArray(data.trips)) {
        trips = data.trips;
      } else {
        throw new Error('Invalid format');
      }
      // Merge: skip duplicates by date+flightNo/trainNo, or by id
      const existingIds = new Set(this._trips.map(t => t.id));
      const existingKeys = new Set(this._trips.map(t => (t.date||'') + (t.flightNo||t.trainNo||'')));
      let added = 0;
      trips.forEach(t => {
        const key = (t.date||'') + (t.flightNo||t.trainNo||'');
        if (existingIds.has(t.id) || existingKeys.has(key)) return;
        // Generate new id if missing
        if (!t.id) t.id = Date.now().toString(36) + Math.random().toString(36).slice(2,6) + added;
        // Enrich from airport/station DB
        if (t.type === 'flight' || (!t.type && t.flightNo)) {
          t.type = t.type || 'flight';
          if (t.fromCode && AIRPORTS[t.fromCode]) {
            const ap = AIRPORTS[t.fromCode];
            t.fromLat = t.fromLat || ap.lat; t.fromLng = t.fromLng || ap.lng; t.fromCity = t.fromCity || ap.city;
          }
          if (t.toCode && AIRPORTS[t.toCode]) {
            const ap = AIRPORTS[t.toCode];
            t.toLat = t.toLat || ap.lat; t.toLng = t.toLng || ap.lng; t.toCity = t.toCity || ap.city;
          }
        }
        if (!t.distance && t.fromLat && t.toLat) {
          t.distance = calcDistance(t.fromLat, t.fromLng, t.toLat, t.toLng);
          if (t.type === 'train') t.distance = Math.round(t.distance * 1.3);
        }
        if (!t.airline && t.flightNo) t.airline = detectAirline(t.flightNo);
        if (t.depTime && t.arrTime && !t.duration) {
          t.duration = calcTripDuration(t.depTime, t.arrTime, t.fromCode, t.toCode);
        }
        this._trips.push(t);
        added++;
      });
      this._trips.sort((a, b) => b.date.localeCompare(a.date));
      this.save();
      return added;
    } catch(e) {
      throw new Error('JSON格式错误');
    }
  },

  _importCSV(csv) {
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV为空或格式错误');
    
    // Parse header
    const headerLine = lines[0];
    const headers = this._parseCSVLine(headerLine);
    const hasHeader = headers.includes('date') || headers.includes('type');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    // Known fields
    const fieldMap = {
      'date': 'date', '日期': 'date',
      'type': 'type', '类型': 'type',
      'fromCity': 'fromCity', '出发城市': 'fromCity',
      'toCity': 'toCity', '到达城市': 'toCity', 
      'fromCode': 'fromCode', '出发机场': 'fromCode',
      'toCode': 'toCode', '到达机场': 'toCode',
      'fromStation': 'fromStation', '出发车站': 'fromStation',
      'toStation': 'toStation', '到达车站': 'toStation',
      'flightNo': 'flightNo', '航班号': 'flightNo',
      'trainNo': 'trainNo', '车次': 'trainNo',
      'airline': 'airline', '航司': 'airline',
      'depTime': 'depTime', '出发时间': 'depTime',
      'arrTime': 'arrTime', '到达时间': 'arrTime',
      'distance': 'distance', '里程': 'distance',
      'duration': 'duration', '时长': 'duration',
      'seatClass': 'seatClass', '舱位': 'seatClass',
      'seatType': 'seatType', '席别': 'seatType',
      'seat': 'seat', '座位': 'seat',
      'note': 'note', '备注': 'note',
      'price': 'price', '票价': 'price',
      'groupId': 'groupId',
    };

    let added = 0;
    dataLines.forEach(line => {
      const values = this._parseCSVLine(line);
      const trip = { type: 'flight' }; // default

      if (hasHeader) {
        headers.forEach((h, i) => {
          const key = fieldMap[h] || h;
          if (values[i] !== undefined && values[i] !== '') {
            trip[key] = values[i];
          }
        });
      } else {
        // Assume: date, fromCity, toCity, flightNo/trainNo
        trip.date = values[0];
        trip.fromCity = values[1];
        trip.toCity = values[2];
        trip.flightNo = values[3] || '';
      }

      if (trip.distance) trip.distance = parseInt(trip.distance) || 0;
      if (trip.duration) trip.duration = parseInt(trip.duration) || 0;
      if (trip.price) trip.price = parseFloat(trip.price) || 0;

      // Try to auto-detect type
      if (!trip.type || trip.type === '') {
        if (trip.trainNo || trip.fromStation) trip.type = 'train';
        else trip.type = 'flight';
      }

      // Generate id
      trip.id = Date.now().toString(36) + Math.random().toString(36).slice(2,6) + added;
      trip.createdAt = Date.now();

      // Try to lookup coordinates
      if (trip.type === 'flight' && trip.fromCode && AIRPORTS[trip.fromCode]) {
        const ap = AIRPORTS[trip.fromCode];
        trip.fromLat = ap.lat;
        trip.fromLng = ap.lng;
        trip.fromCity = trip.fromCity || ap.city;
      }
      if (trip.type === 'flight' && trip.toCode && AIRPORTS[trip.toCode]) {
        const ap = AIRPORTS[trip.toCode];
        trip.toLat = ap.lat;
        trip.toLng = ap.lng;
        trip.toCity = trip.toCity || ap.city;
      }
      if (trip.type === 'train' && trip.fromStation && STATIONS[trip.fromStation]) {
        const st = STATIONS[trip.fromStation];
        trip.fromLat = st.lat;
        trip.fromLng = st.lng;
        trip.fromCity = trip.fromCity || st.city;
      }
      if (trip.type === 'train' && trip.toStation && STATIONS[trip.toStation]) {
        const st = STATIONS[trip.toStation];
        trip.toLat = st.lat;
        trip.toLng = st.lng;
        trip.toCity = trip.toCity || st.city;
      }

      // Calculate distance if missing
      if (!trip.distance && trip.fromLat && trip.toLat) {
        trip.distance = calcDistance(trip.fromLat, trip.fromLng, trip.toLat, trip.toLng);
        if (trip.type === 'train') trip.distance = Math.round(trip.distance * 1.3);
      }

      this._trips.push(trip);
      added++;
    });

    this._trips.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    this.save();
    return added;
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i+1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  },
};
