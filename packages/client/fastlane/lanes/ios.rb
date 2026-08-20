# ios.rb — App Store Connect lanes. Imported by the Fastfile; the shared
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
    build = ENV["BUILD_NUMBER"] || begin
      latest = latest_testflight_build_number(
        api_key: key, app_identifier: bundle_id, initial_build_number: 0
      )
      (latest.to_i + 1).to_s
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
      output_name:          "micdrp-beta-#{version}-#{build}.ipa",
      clean:                true,
      include_symbols:      true,
      include_bitcode:      false,
    )

    # Upload to TestFlight (internal testers only by default).
    pilot(
      api_key:              key,
      app_identifier:       bundle_id,
      distribute_external:  false,
      notify_external_testers: false,
      skip_waiting_for_build_processing: true,
      changelog:            ENV.fetch("RELEASE_NOTES", "Internal beta build #{build}"),
    )
  end

  # -------------------------------------------------------------------------
  # ios_release — promote a TestFlight build to App Store production
  # -------------------------------------------------------------------------
  desc "Submit an approved TestFlight build to App Store production review"
  lane :ios_release do
    version = EnvConfig.version
    build   = EnvConfig.build

    deliver(
      api_key:               asc_api_key,
      app_identifier:        EnvConfig.bundle_id,
      submit_for_review:     true,
      automatic_release:     false,
      force:                 true,           # skip HTML report
      skip_binary_upload:    true,           # binary already on TestFlight
      build_number:          build,
      app_version:           version,
      submission_information: {
        add_id_info_uses_idfa: false,
      },
    )
  end
end
