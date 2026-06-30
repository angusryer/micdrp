package com.micdrp;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * WP-AUDIO-BRIDGE — registers the Tier-1 native {@link AudioEngineModule}.
 *
 * <p>This is the only audio React package; it is added to the host
 * application's {@code getPackages()} list in {@code MainApplication}.
 */
public class AudioEnginePackage implements ReactPackage {

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }

  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new AudioEngineModule(reactContext));
    return modules;
  }
}
