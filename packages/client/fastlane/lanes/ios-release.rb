# ios-release.rb — promoting an accepted TestFlight build to the App
# Store. Split from ios.rb, which owns the beta lane.

platform :ios do
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
