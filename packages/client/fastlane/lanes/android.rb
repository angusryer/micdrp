# android.rb — Google Play lanes. Imported by the Fastfile.

platform :android do
  # -------------------------------------------------------------------------
  # android_beta — assemble release AAB and upload to Play internal track
  # -------------------------------------------------------------------------
  desc "Build a release AAB and upload to Google Play internal test track"
  lane :android_beta do
    version = EnvConfig.version
    build   = EnvConfig.build

    # gradle tasks run from packages/client/android/
    gradle(
      project_dir:   "android",
      task:          "bundle",
      build_type:    "Release",
      # Signing material is read from environment variables inside build.gradle
      # via react-native-config / .env.production.  The keystore file must be
      # present at packages/client/android/app/micdrp.keystore (restored by CI
      # from the ANDROID_KEYSTORE_BASE64 secret — see release-android.sh).
      properties: {
        "android.injected.signing.store.file"     => ENV.fetch("ANDROID_KEYSTORE_PATH"),
        "android.injected.signing.store.password" => ENV.fetch("ANDROID_KEYSTORE_PASSWORD"),
        "android.injected.signing.key.alias"      => ENV.fetch("ANDROID_KEY_ALIAS"),
        "android.injected.signing.key.password"   => ENV.fetch("ANDROID_KEY_PASSWORD"),
        "VERSION_NUMBER"                          => version,
        "BUILD_NUMBER"                            => build,
      },
    )

    # Upload the AAB to the Play Store internal track.
    supply(
      package_name:       ENV.fetch("ANDROID_PACKAGE_NAME", "com.micdrp"),
      json_key_data:      ENV.fetch("SUPPLY_JSON_KEY_DATA"),  # service-account JSON from CI secret
      track:              "internal",
      aab:                "android/app/build/outputs/bundle/release/app-release.aab",
      skip_upload_apk:    true,
      release_status:     "draft",
    )
  end

  # -------------------------------------------------------------------------
  # android_release — promote the internal track build to production
  # -------------------------------------------------------------------------
  desc "Promote the latest internal track build to Google Play production"
  lane :android_release do
    supply(
      package_name:   ENV.fetch("ANDROID_PACKAGE_NAME", "com.micdrp"),
      json_key_data:  ENV.fetch("SUPPLY_JSON_KEY_DATA"),
      track:          "internal",
      track_promote_to: "production",
      skip_upload_apk: true,
      skip_upload_aab: true,
    )
  end
end
