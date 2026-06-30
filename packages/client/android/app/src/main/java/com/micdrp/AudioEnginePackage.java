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
 * <p>Add this package to the host application's {@code getPackages()} list
 * (alongside the existing {@code AudioPackages}). Kept separate so the legacy
 * {@code AudioControlModule} registration stays untouched.
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
