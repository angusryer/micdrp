fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios ios_beta

```sh
[bundle exec] fastlane ios ios_beta
```

Build, sign, and upload an iOS beta build to TestFlight

### ios ios_release

```sh
[bundle exec] fastlane ios ios_release
```

Submit an approved TestFlight build to App Store production review

----


## Android

### android android_beta

```sh
[bundle exec] fastlane android android_beta
```

Build a release AAB and upload to Google Play internal test track

### android android_release

```sh
[bundle exec] fastlane android android_release
```

Promote the latest internal track build to Google Play production

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
