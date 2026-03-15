// ===== Data Store (localStorage) =====

const STORE_KEY = 'travellog_trips';

const Store = {
  _trips: [],

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      this._trips = raw ? JSON.parse(raw) : [];
    } catch(e) {
      this._trips = [];
    }
    // Sort by date desc
    this._trips.sort((a, b) => b.date.localeCompare(a.date));
  },

  save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(this._trips));
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
    this.save();
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
      if (t.fromCity) { cities.add(t.fromCity); fromCities[t.fromCity] = (fromCities[t.fromCity]||0)+1; }
      if (t.toCity) { cities.add(t.toCity); toCities[t.toCity] = (toCities[t.toCity]||0)+1; }
      if (t.fromStation) stations.add(t.fromStation);
      if (t.toStation) stations.add(t.toStation);
    });

    // Merge from/to city counts
    const cityCounts = {};
    for (const c in fromCities) cityCounts[c] = (cityCounts[c]||0) + fromCities[c];
    for (const c in toCities) cityCounts[c] = (cityCounts[c]||0) + toCities[c];

    return {
      totalTrips: trips.length,
      flightCount: flights.length,
      trainCount: trains.length,
      totalFlightKm, totalTrainKm,
      totalKm: totalFlightKm + totalTrainKm,
      totalFlightMins, totalTrainMins,
      totalMins: totalFlightMins + totalTrainMins,
      cityCount: cities.size,
      airportCount: airports.size,
      stationCount: stations.size,
      cities: cityCounts,
      airlines,
      topCities: Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0,10),
      topAirlines: Object.entries(airlines).sort((a,b)=>b[1]-a[1]).slice(0,5),
    };
  },

  // Export
  exportData() {
    return JSON.stringify({
      version: 1,
      app: 'travellog',
      exported: new Date().toISOString(),
      trips: this._trips,
    }, null, 2);
  },

  // Import
  importData(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (data.app !== 'travellog' || !Array.isArray(data.trips)) {
        throw new Error('Invalid format');
      }
      // Merge: skip duplicates by id
      const existingIds = new Set(this._trips.map(t => t.id));
      let added = 0;
      data.trips.forEach(t => {
        if (!existingIds.has(t.id)) {
          this._trips.push(t);
          added++;
        }
      });
      this._trips.sort((a, b) => b.date.localeCompare(a.date));
      this.save();
      return added;
    } catch(e) {
      throw new Error('数据格式错误');
    }
  },
};
