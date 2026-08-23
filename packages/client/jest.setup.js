 
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
    // Pass the completion through: a throw that removes a bar line does it
    // from this callback, so dropping it would make the gesture untestable.
    withTiming: (v, _config, cb) => {
      if (typeof cb === 'function') {
        cb(true);
      }
      return v;
    },
    withSpring: (v) => v,
    withDelay: (_d, v) => v,
    withRepeat: (v) => v,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    // GestureDetector asks reanimated for an event handler object and for the
    // worklet that sets gesture state. Neither does anything on the host —
    // RNGH's jest utilities deliver events through DeviceEventEmitter instead —
    // but both must exist or rendering any GestureDetector throws.
    useEvent: () => ({}),
    setGestureState: () => {},
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

// @lodev09/react-native-true-sheet: the real module throws at import when the
// native side is absent, which is every test. Render the children inline so a
// sheet's contents are still queryable, and no-op the imperative methods.
jest.mock('@lodev09/react-native-true-sheet', () => {
  const React = require('react');
  class TrueSheet extends React.Component {
    present() { return Promise.resolve(); }
    dismiss() { return Promise.resolve(); }
    render() {
      return React.createElement(React.Fragment, null, this.props.children);
    }
  }
  return { TrueSheet };
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
    RoundedRect: noop,
    BlurMask: noop,
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
  () => ({
    // A recorder that behaves like the real one without a microphone: the
    // dogfood session's timing and trail are the things under test, not the
    // native capture. No pause/resume here — the session no longer holds a
    // recording, and a call to either should fail loudly rather than pass.
    AudioRecorder: class {
      enableFileOutput() {
        return { status: 'success' };
      }
      start() {
        return Promise.resolve({ status: 'success' });
      }
      stop() {
        return Promise.resolve({
          status: 'success',
          paths: ['/tmp/micdrp/dogfood/clip.m4a'],
          size: 0.1,
          duration: 4
        });
      }
    },
    AudioContext: function () {},
    // The session has to be told it is recording speech before the recorder's
    // engine will activate it.
    AudioManager: {
      setAudioSessionOptions: jest.fn(),
      setAudioSessionActivity: jest.fn(() => Promise.resolve())
    },
    FileFormat: { Wav: 0, Caf: 1, M4A: 2, Flac: 3 },
    FileDirectory: { Document: 0, Cache: 1 }
  }),
  { virtual: true }
);
jest.mock(
  '@dr.pogodin/react-native-fs',
  () => ({
    DocumentDirectoryPath: '/tmp/micdrp',
    // The app bundle root. `updates/eligibility` looks for the StoreKit
    // receipt beneath it to tell a TestFlight install from an App Store one.
    MainBundlePath: '/tmp/micdrp/micdrp.app',
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

// @hot-updater/react-native reaches for a TurboModule at import time, which
// throws on the host. The `updates` domain owns the policy around these calls,
// not the calls themselves, so every test stubs the whole surface and asserts
// on what was asked of it. Individual tests override the return values.
jest.mock(
  '@hot-updater/react-native',
  () => ({
    __esModule: true,
    HotUpdater: {
      init: jest.fn(),
      reload: jest.fn(() => Promise.resolve()),
      checkForUpdate: jest.fn(() => Promise.resolve(null)),
      updateBundle: jest.fn(() => Promise.resolve(true)),
      getCrashHistory: jest.fn(() => []),
      getBundleId: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
      getAppVersion: jest.fn(() => '1.0.0'),
      getChannel: jest.fn(() => 'beta')
    }
  }),
  { virtual: true }
);

// The install-info TurboModule is native, so it is absent on the host. The
// default answers "no receipt", which is what a simulator or a development
// build reports — tests that care override it.
jest.mock('./src/specs/NativeInstallInfo', () => ({
  __esModule: true,
  default: { getReceiptName: jest.fn(() => '') }
}));

jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });

// pocketbase ships ESM from every entry point its CJS build exports only the
// client class, so neither is loadable here. No test exercises the real SDK —
// the repos and auth run against src/testing/fakeBackend, which enforces the
// same ownership rules — so this stands in for module construction only.
jest.mock(
  'pocketbase',
  () => {
    class AsyncAuthStore {
      constructor(config) {
        this.config = config;
        this.token = '';
        this.record = null;
      }
      get isValid() {
        return false;
      }
      clear() {}
      onChange() {
        return () => undefined;
      }
    }
    class PocketBase {
      constructor(url, authStore) {
        this.baseURL = url;
        this.authStore = authStore ?? new AsyncAuthStore({});
        this.files = {
          getToken: () => Promise.resolve('file-token'),
          getURL: () => ''
        };
      }
      collection() {
        throw new Error(
          'The real PocketBase SDK is not exercised in tests; mock ' +
            'src/lib/backend with src/testing/fakeBackend instead.'
        );
      }
      autoCancellation() {}
    }
    return { __esModule: true, default: PocketBase, AsyncAuthStore };
  },
  { virtual: true }
);

// react-native-config: supply a test backend URL so `lib/backend` can construct
// the client at import time (it throws when the URL is absent). The real value
// is injected from the environment on device builds; this is an inert stand-in.
jest.mock(
  'react-native-config',
  () => ({
    __esModule: true,
    default: { BACKEND_URL: 'http://127.0.0.1:8090' }
  }),
  { virtual: true }
);
