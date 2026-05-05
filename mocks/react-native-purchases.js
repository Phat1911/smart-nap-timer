module.exports = {
  Purchases: {
    configure: () => Promise.resolve(),
    getCustomerInfo: () => Promise.resolve({ entitlements: { all: {}, active: {} }, offerings: { current: null, all: {} } }),
    getOfferings: () => Promise.resolve({ current: null, all: {} }),
    purchasePackage: () => Promise.resolve({ customerInfo: {}, productIdentifier: '' }),
    restorePurchases: () => Promise.resolve({ entitlements: { all: {}, active: {} } }),
    logIn: () => Promise.resolve({ customerInfo: {}, created: false }),
    logOut: () => Promise.resolve(),
    setLogLevel: () => {},
    addCustomerInfoUpdateListener: () => {},
    removeCustomerInfoUpdateListener: () => {},
  },
};
