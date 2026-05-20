const fs = require('fs');
const path = require('path');

const PRICE_CACHE_FILE = path.join(__dirname, 'sol_price_cache.json');

class SolPriceCache {
  constructor() {
    this.price = null;
    this.lastUpdated = null;
    this._loadFromFile();
  }

  // Lưu giá mới
  setPrice(price, timestamp = Date.now()) {
    this.price = price;
    this.lastUpdated = timestamp;
    this._saveToFile();
  }

  // Lấy giá hiện tại
  getPrice() {
    return this.price;
  }

  // Kiểm tra giá có cũ không (nếu cần validate)
  isStale(maxAgeMs = 5 * 60 * 1000) { // 5 phút default
    if (!this.lastUpdated) return true;
    return (Date.now() - this.lastUpdated) > maxAgeMs;
  }

  // Load từ file khi khởi động
  _loadFromFile() {
    try {
      if (fs.existsSync(PRICE_CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(PRICE_CACHE_FILE, 'utf8'));
        this.price = data.price;
        this.lastUpdated = data.lastUpdated;
      }
    } catch (error) {
      console.error('Error loading SOL price cache:', error.message);
    }
  }

  // Save vào file
  _saveToFile() {
    try {
      fs.writeFileSync(PRICE_CACHE_FILE, JSON.stringify({
        price: this.price,
        lastUpdated: this.lastUpdated
      }, null, 2));
    } catch (error) {
      console.error('Error saving SOL price cache:', error.message);
    }
  }
}

// Singleton instance
const solPriceCache = new SolPriceCache();

module.exports = solPriceCache;