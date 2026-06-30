/* eslint-disable @typescript-eslint/no-empty-function */
// Jest setup: mock the native modules the app pulls in so component/hook tests
// can run on the host without a device. Individual test files may override these.

require('react-native-gesture-handler/jestSetup');

// Inline reanimated mock. (react-native-reanimated v3 no longer ships the
// `/mock` subpath, so we provide the small surface our UI actually uses.)
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const shared = (init) => ({ value: init });
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      Image: RN.Image,
      ScrollView: RN.ScrollView,
      createAnimatedComponent: (c) => c
    },
    useSharedValue: (v) => shared(v),
    useDerivedValue: (fn) => shared(typeof fn === 'function' ? fn() : undefined),
    useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
    useAnimatedProps: (fn) => (typeof fn === 'function' ? fn() : {}),
    useAnimatedReaction: () => {},
    withTiming: (v) => v,
    withSpring: (v) => v,
    withDelay: (_d, v) => v,
    withRepeat: (v) => v,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: () => 0,
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: new Proxy({}, { get: () => () => 0 })
  };
});

// react-native-mmkv: in-memory backing store.
jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  class MMKV {
    constructor(opts) {
      const id = (opts && opts.id) || 'default';
      if (!stores.has(id)) stores.set(id, new Map());
      this._m = stores.get(id);
    }
    set(k, v) {
      this._m.set(k, v);
    }
    getString(k) {
      const v = this._m.get(k);
      return typeof v === 'string' ? v : undefined;
    }
    getNumber(k) {
      const v = this._m.get(k);
      return typeof v === 'number' ? v : undefined;
    }
    getBoolean(k) {
      const v = this._m.get(k);
      return typeof v === 'boolean' ? v : undefined;
    }
    contains(k) {
      return this._m.has(k);
    }
    delete(k) {
      this._m.delete(k);
    }
    getAllKeys() {
      return Array.from(this._m.keys());
    }
    clearAll() {
      this._m.clear();
    }
  }
  return { MMKV };
});

// @shopify/react-native-skia: render children, stub drawing primitives.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const passthrough = ({ children }) => React.createElement(React.Fragment, null, children);
  const noop = () => null;
  return {
    Canvas: passthrough,
    Group: passthrough,
    Path: noop,
    Line: noop,
    Circle: noop,
    Rect: noop,
    Text: noop,
    Skia: {
      Path: { Make: () => ({ moveTo() {}, lineTo() {}, reset() {}, close() {} }) }
    },
    useFont: () => null,
    vec: (x, y) => ({ x, y })
  };
});

// Native audio engine + fs + share: virtual mocks (may be absent in some setups).
jest.mock(
  'react-native-audio-api',
  () => ({ AudioRecorder: function () {}, AudioContext: function () {} }),
  { virtual: true }
);
jest.mock(
  'react-native-fs',
  () => ({
    DocumentDirectoryPath: '/tmp/micdrp',
    writeFile: jest.fn(() => Promise.resolve()),
    readFile: jest.fn(() => Promise.resolve('')),
    unlink: jest.fn(() => Promise.resolve()),
    exists: jest.fn(() => Promise.resolve(true)),
    mkdir: jest.fn(() => Promise.resolve())
  }),
  { virtual: true }
);
jest.mock(
  'react-native-share',
  () => ({ default: { open: jest.fn(() => Promise.resolve()) } }),
  { virtual: true }
);

// Hardware-backed token store (Supabase session adapter).
jest.mock(
  'react-native-keychain',
  () => {
    const store = new Map();
    return {
      setGenericPassword: jest.fn((u, p, opts) => {
        store.set((opts && opts.service) || 'default', p);
        return Promise.resolve(true);
      }),
      getGenericPassword: jest.fn((opts) => {
        const v = store.get((opts && opts.service) || 'default');
        return Promise.resolve(v ? { username: 'micdrp', password: v } : false);
      }),
      resetGenericPassword: jest.fn((opts) => {
        store.delete((opts && opts.service) || 'default');
        return Promise.resolve(true);
      }),
      ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked' }
    };
  },
  { virtual: true }
);

jest.mock(
  'react-native-localize',
  () => ({
    getLocales: () => [
      { languageCode: 'en', countryCode: 'US', languageTag: 'en-US', isRTL: false }
    ],
    findBestLanguageTag: () => ({ languageTag: 'en', isRTL: false })
  }),
  { virtual: true }
);

jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });
