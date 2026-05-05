module.exports = {
  isAvailableAsync: () => Promise.resolve(false),
  defineTask: () => {},
  unregisterTaskAsync: () => Promise.resolve(),
  getRegisteredTasksAsync: () => Promise.resolve([]),
  getStatusAsync: () => Promise.resolve(1),
};
