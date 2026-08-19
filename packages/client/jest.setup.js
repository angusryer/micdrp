/* eslint-disable @typescript-eslint/no-empty-function */
// Jest setup: mock the native modules the app pulls in so component/hook tests
// can run on the host without a device. Individual test files may override these.

require('react-native-gesture-handler/jestSetup');

// Inline reanimated mock. (react-native-reanimated v3 no longer ships the
// `/mock` subpath, so we provide the small surface our UI actually uses.)
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const React = require('react');
  // The real useSharedValue is ref-stable across renders. Returning a fresh
  // object each render left callbacks holding a stale one, so a frame written
  // after a re-render landed on an object nobody was reading.
  const shared = (init) => ({ value: init });
  const useShared = (init) => {
    const ref = React.useRef(null);
    if (ref.current === null) {
      ref.current = shared(init);
    }
    return ref.current;
  };
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      Image: RN.Image,
      ScrollView: RN.ScrollView,
      createAnimatedComponent: (c) => c
    },
    useSharedValue: useShared,
    useDerivedValue: (fn) => useShared(typeof fn === 'function' ? fn() : undefined),
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
}, { virtual: true });

// react-native-mmkv: in-memory backing store.
// v4 replaced the MMKV class with a createMMKV() factory and renamed delete()
// to remove(), so the mock mirrors that shape.
jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  const createMMKV = (opts) => {
    const id = (opts && opts.id) || 'default';
    if (!stores.has(id)) stores.set(id, new Map());
    const m = stores.get(id);
    return {
      set: (k, v) => m.set(k, v),
      getString: (k) => (typeof m.get(k) === 'string' ? m.get(k) : undefined),
      getNumber: (k) => (typeof m.get(k) === 'number' ? m.get(k) : undefined),
      getBoolean: (k) => (typeof m.get(k) === 'boolean' ? m.get(k) : undefined),
      getBuffer: (k) => m.get(k),
      contains: (k) => m.has(k),
      remove: (k) => m.delete(k),
      getAllKeys: () => Array.from(m.keys()),
      clearAll: () => m.clear(),
      recrypt: () => undefined,
      trim: () => undefined
    };
  };
  return {
    createMMKV,
    existsMMKV: (id) => stores.has(id),
    deleteMMKV: (id) => stores.delete(id)
  };
}, { virtual: true });

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
      Path: {
        Make: () => ({ moveTo() {}, lineTo() {}, reset() {}, close() {} }),
        MakeFromSVGString: () => ({
          moveTo() {},
          lineTo() {},
          reset() {},
          close() {}
        })
      }
    },
    useFont: () => null,
    vec: (x, y) => ({ x, y })
  };
}, { virtual: true });

// Native audio engine + fs + share: virtual mocks (may be absent in some setups).
jest.mock(
  'react-native-audio-api',
  () => ({ AudioRecorder: function () {}, AudioContext: function () {} }),
  { virtual: true }
);
jest.mock(
  '@dr.pogodin/react-native-fs',
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

// react-native-config: supply test Supabase env so `lib/supabase` can construct
// the client at import time (it throws when URL/key are absent). Real values are
// injected from the environment on device builds; these are inert test stand-ins.
jest.mock(
  'react-native-config',
  () => ({
    __esModule: true,
    default: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_ANON_KEY: 'test-anon-key'
    }
  }),
  { virtual: true }
);
