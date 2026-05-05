module.exports = {
  registerTaskAsync: () => Promise.resolve(),
  unregisterTaskAsync: () => Promise.resolve(),
  getRegisteredTasksAsync: () => Promise.resolve([]),
  getStatusAsync: () => Promise.resolve(1),
};
