# ios.rb — the TestFlight beta lane. Imported by the Fastfile; the shared
# helpers and requires live there.

platform :ios do
  # -- shared pre-actions --------------------------------------------------
  before_all do
    # Ensure all tools agree on the Ruby bundle
    # (Gemfile lives at packages/client/Gemfile)
  end

  # -------------------------------------------------------------------------
  # ios_beta — build, sign, upload to TestFlight (beta / internal)
  # -------------------------------------------------------------------------
  desc "Build, sign, and upload an iOS beta build to TestFlight"
  lane :ios_beta do
    version   = EnvConfig.version
    bundle_id = EnvConfig.bundle_id
    key       = asc_api_key

    # TestFlight rejects a build number it has already accepted. Deriving the
    # next one from what is actually up there removes the one manual step that
    # would otherwise break every second deploy, and makes repeat shipping
    # safe to trigger remotely.
    build = ENV["OVERRIDE_BUILD_NUMBER"] || begin
      # Apple registers an uploaded build minutes after accepting it, and
      # reports nothing in between. Asking TestFlight alone therefore returns
      # the *previous* answer when you deploy twice in a row, producing a
      # duplicate build number that is rejected during processing.
      #
      # The local counter always advances; TestFlight acts as a floor for the
      # case where someone uploaded from another machine.
      remote = latest_testflight_build_number(
        api_key: key, app_identifier: bundle_id, initial_build_number: 0
      ).to_i
      local = EnvConfig.build.to_i
      ([remote, local].max + 1).to_s
    end
    # Must go through the .env file: react-native-config generates
    # ios/tmp.xcconfig from it, and Info.plist reads $(BUILD_NUMBER) from there.
    EnvConfig.write("BUILD_NUMBER", build)
    UI.success("Building #{version} (#{build}) for #{bundle_id}")

    # Fetch (creating if absent) the distribution certificate and App Store
    # profile using the same API key. No match repo, no Apple ID, no 2FA.
    # Sign from a dedicated keychain, never the login keychain. See
    # fastlane/keychain.rb for why: the login keychain stops the build on a
    # GUI prompt, which makes an unattended release impossible.
    keychain_pw   = SigningKeychain.password
    keychain_path = SigningKeychain.prepare(
      password: keychain_pw,
      p12_path: SigningKeychain::P12_FILE
    )

    cert(
      api_key:           key,
      output_path:       "fastlane/certs",
      keychain_path:     keychain_path,
      keychain_password: keychain_pw
    )
    sigh(api_key: key, app_identifier: bundle_id, output_path: "fastlane/certs")

    # Apple names the profile; we do not get to pick it. Read the real name
    # back out of sigh rather than keeping a literal in the project that has
    # to be kept in sync by hand.
    profile_path = lane_context[SharedValues::SIGH_PROFILE_PATH]
    profile_name = Signing.name(profile_path)
    team_id      = Signing.team_id(profile_path)
    UI.message("Signing as team #{team_id} with profile '#{profile_name}'")

    # Scoped to the app target so the pod targets keep their own signing.
    # Skipped when already correct: the write itself invalidates the build.
    if Signing.settings_current?("ios/micdrp.xcodeproj",
                                 profile_name: profile_name, team_id: team_id)
      UI.message("Signing settings already current — leaving the project alone")
    else
      update_code_signing_settings(
        path:                  "ios/micdrp.xcodeproj",
        targets:               ["micdrp"],
        build_configurations:  ["Release"],
        use_automatic_signing: false,
        bundle_identifier:     bundle_id,
        profile_name:          profile_name,
        team_id:               team_id,
        code_sign_identity:    "Apple Distribution"
      )
    end

    # Build the iOS archive using the production scheme (micdrp).
    gym(
      workspace:            "ios/micdrp.xcworkspace",
      scheme:               "micdrp",
      configuration:        "Release",
      export_method:        "app-store",
      export_options:       {
        provisioningProfiles: { bundle_id => profile_name },
        signingCertificate:   "Apple Distribution",
        teamID:               team_id,
      },
      xcargs:               "OTHER_CODE_SIGN_FLAGS='--keychain #{keychain_path}'",
      output_directory:     "build/ios",
      output_name:          ipa_name = "micdrp-beta-#{version}-#{build}.ipa",
      # Incremental by default. A beta exists to be iterated on, and most
      # iterations change only JS, where a clean archive spends minutes
      # recompiling identical native code. Force a clean one with
      # RELEASE_CLEAN=1 when native dependencies or build settings change.
      clean:                ENV["RELEASE_CLEAN"] == "1",
      include_symbols:      true,
      include_bitcode:      false,
    )

    # Upload to TestFlight (internal testers only by default).
    pilot(
      api_key:              key,
      app_identifier:       bundle_id,
      distribute_external:  false,
      notify_external_testers: false,
      # fastlane silently ignores skip_waiting_for_build_processing when a
      # changelog is given, because writing release notes needs the processed
      # build — so passing one unconditionally makes the lane poll Apple for
      # up to an hour, and forever when the build is rejected. Opt in only
      # when notes are actually wanted.
      skip_waiting_for_build_processing: ENV["RELEASE_NOTES"].nil?,
      changelog:            ENV["RELEASE_NOTES"],
    )

    # The build is on TestFlight; nothing local is read again (INV-UPD-012).
    Artifacts.after_upload(
      archive:     lane_context[SharedValues::XCODEBUILD_ARCHIVE],
      output_dir:  File.expand_path("build/ios"),
      output_name: ipa_name
    )
  end

end
