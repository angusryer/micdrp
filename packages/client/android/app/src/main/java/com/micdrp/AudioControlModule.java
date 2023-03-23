package com.micdrp;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.Map;
import java.util.HashMap;

public class AudioControlModule extends ReactContextBaseJavaModule {
    AudioControlModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "AudioControlModule";
    }

    // Must use callbacks, promises or event messages to return from native methods since
    // ReactBridge asynchronously communicates with JS.
    @ReactMethod
    public String testLog(String message, Promise promise) {
        Log.d("AudioControlModule", message);
        promise.resolve(message + "--SUCCESS");
        return message;
    };
}
