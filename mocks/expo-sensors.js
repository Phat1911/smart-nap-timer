module.exports = {
  Accelerometer: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
    setUpdateInterval: () => {},
    removeAllListeners: () => {},
  },
  Gyroscope: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
    setUpdateInterval: () => {},
    removeAllListeners: () => {},
  },
  Barometer: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
  },
  Magnetometer: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
  },
};
