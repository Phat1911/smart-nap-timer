module.exports = {
  openBrowserAsync: () => Promise.resolve({ type: 'dismiss' }),
  dismissBrowser: () => {},
  warmUpAsync: () => Promise.resolve(),
  mayInitWithUrlAsync: () => Promise.resolve(),
};
