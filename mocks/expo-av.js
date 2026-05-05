module.exports = {
  Audio: {
    Sound: {
      createAsync: () => Promise.resolve({ sound: { playAsync: () => Promise.resolve(), stopAsync: () => Promise.resolve(), pauseAsync: () => Promise.resolve(), setOnPlaybackStatusUpdate: () => {} } }),
      unloadAsync: () => Promise.resolve(),
    },
    setAudioModeAsync: () => Promise.resolve(),
    getPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
    requestPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
    getAudioFocusAsync: () => Promise.resolve(),
    setAudioFocusAsync: () => Promise.resolve(),
  },
};
