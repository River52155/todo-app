const { clone } = require('./common');

function parseStoredValue(value) {
  if (value === '' || value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }
  return value;
}

function getStorageValue(key, fallback) {
  try {
    const value = parseStoredValue(wx.getStorageSync(key));
    return value === undefined ? clone(fallback) : value;
  } catch (error) {
    return clone(fallback);
  }
}

function setStorageValue(key, value) {
  wx.setStorageSync(key, value);
  return value;
}

module.exports = {
  getStorageValue,
  setStorageValue
};
