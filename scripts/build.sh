#!/bin/bash

# TODOs remaining
# increment version numbers for iOS
# run iOS build and output file

# Make sure the local development environment is configured
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/emulator
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home

clientDir=packages/client
gradlePath=packages/client/android/app/build.gradle
env="dev"
androidVersionCode=0
androidVersionName=""
nextBuild=0
iosVersionNumber=0
metroPort=9000

keepVersion=0
bumpMinor=0
bumpMajor=0
bumpMaintenance=0

majorDigit=
nextMajorDigit=
minorDigit=
nextMinorDigit=
maintenanceDigit=
nextMaintenanceDigit=
releaseVariant=
nextReleaseVariant=
buildDigit=
nextBuildDigit=

# 0: no change, 1: build number only, 2: version and build numbers
versionChangeWillTakePlace=0

if [ ! -d "$clientDir" ]; then
  printf "Please run from the root 'micdrp' folder...\n"
  exit 0;
fi

function help () {
  printf "\n build.sh -e <OPTION> <DEVICE>\n\n"
  printf "Example for building an Android bundle with Production environment values:"
  printf "\n\n./build.sh -e prod android\n\n"
  printf "    OPTION: -e [dev|staging|prod]\n"
  printf "    DEVICE: [ios|android|all]\n"
  exit 0;
}

function die () {
  printf '%s\n' "$*" >&2
  exit 1
}

if [ $# -gt 3 ]; then
  help
  exit 1;
fi

if [ $# -le 2 ]; then
  help
  exit 1;
fi

device=
for var in "$@"; do
  [[ $var = 'ios' ]] && device="ios"
  [[ $var = 'android' ]] && device="android"
  [[ $var = 'all' ]] && device="all"
done

if [[ -z $device ]]; then
  help
fi

# This is the internal build number, integer only
function getAndroidVersionCode () {
  local androidVersionCode="$(grep -oE '^.?\s*versionCode [0-9]+' $gradlePath)"
  echo $androidVersionCode;
}

# This is the user-visible version string '^.\s*versionName \"[0-9]\.[0-9]?.?[0-9]?.\"'
function getAndroidVersionName () {
  local androidVersionName="$(grep -oE '^.?\s*versionName \"[0-9]\.[0-9]?.?[0-9]?.\"' $gradlePath)"
  echo $androidVersionName;
}

function getMajorVersion () {
  local androidVersionName=$(getAndroidVersionName)
  local trailingChars=$(echo $androidVersionName | sed -E 's/^.?\s*versionName \"//')
  local majorDigit=$(echo $trailingChars | cut -c-1)
  echo $majorDigit;
}

function getMinorVersion () {
  local androidVersionName=$(getAndroidVersionName)
  local trailingChars=$(echo $androidVersionName | sed -E 's/^.?\s*versionName \"[0-9]\.//')
  local minorDigit=$(echo $trailingChars | cut -c-1)
  echo $minorDigit;
}

function getMaintenanceVersion () {
  local androidVersionName=$(getAndroidVersionName)
  local trailingChars=$(echo $androidVersionName | sed -E 's/^.?\s*versionName \"[0-9]\.[0-9]\.//')
  local maintenanceDigit=$(echo $trailingChars | cut -c-1)
  echo $maintenanceDigit;
}

function getCurrentBuildVersion () {\
  local androidVersionCode=$(getAndroidVersionCode)
  echo $androidVersionCode | tr -dc '0-9'
}

function getReleaseVariant () {
  local androidVersionName=$(getAndroidVersionName)
  local isStaging=$(echo "${androidVersionName: -2:1}" | tr -cd [a-z])
  if [[ $isStaging = 's' ]]; then
    echo 's'
  else
    echo ''
  fi
}

function bumpAndroidVersion () {

  # https://developer.android.com/studio/publish/versioning
  # versionCode - INTERNAL version number, positive integer only (keep it to the maintenance version number)
  # versionName - user-visible, string (keep it like iOS, i.e.: 1.0.1s or 1.0.1)

  # You can set default values for different build variants (staging, release)
  # https://developer.android.com/studio/publish/versioning#versionvalues
  # May be able to set up schemes in Android Studio, then specify them on
  # the command line

  if [[ $versionChangeWillTakePlace -gt 1 ]]; then
    local oldVersionName="$majorDigit.$minorDigit.$maintenanceDigit$releaseVariant"
    local newVersionName="$nextMajorDigit.$nextMinorDigit.$nextMaintenanceDigit$nextReleaseVariant"

    printf "[ ] Bumping Android version from $oldVersionName to $newVersionName\r"
    androidVersionName=$(getAndroidVersionName)
    sed -i "" "s/$androidVersionName/versionName \"$newVersionName\"/g" $gradlePath

    # Ensure that the version has actually been updated
    local updatedAndroidVersionName=$(grep -oE "versionName \"$newVersionName\"" $gradlePath)
    if [ "$updatedAndroidVersionName" == "" ]; then
        printf "[x] Moving Android version from $oldVersionName to $newVersionName... FAILED\n"
        printf "Error verifying $gradlePath... UNMODIFIED\n"
        exit 3;
    else
      printf "[\xE2\x9C\x94] Bumping Android version from $oldVersionName to $newVersionName... SUCCESS\n"
    fi
  fi

  if [[ $versionChangeWillTakePlace -gt 0 ]]; then
    printf "[ ] Bumping Android build from $buildDigit to $nextBuildDigit\r"
    sed -i "" "s/versionCode $buildDigit/versionCode $nextBuildDigit/g" $gradlePath
    printf "[\xE2\x9C\x94] Bumping Android build from $buildDigit to $nextBuildDigit... SUCCESS\n"
  fi
  
  return 0;
}

function bumpIosVersion () {
  # https://developer.apple.com/library/archive/qa/qa1827/_index.html
  # https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html

  # Build number CFBundleVersion - not visible to users
  # XXXX.XX.XX
  # major.minor.maintenance
  # eg: 1.0.0 or 12.4.33staging
  # We can include a suffix (e.g. staging) -- While developing a new version of your app, you can
  # include a suffix after the number that is being updated; for example 3.1.3a1. The character
  # in the suffix represents the stage of development for the new version. For example, you can
  # represent development, alpha, beta, and final candidate, by d, a, b, and fc. The final number
  # in the suffix is the build version, which cannot be 0 and cannot exceed 255. When you release
  # the new version of your app, remove the suffix.
  # 

  # User-visible release version number - CFBundleShortVersionString
  # is "marketing version" or "mvers" -- this is what end users see
  # The version number, which is the number shown to your application’s users, identifies a
  # released version of your application. It is stored in your application’s Info.plist as
  # CFBundleShortVersionString (Bundle versions string, short).
  # XXXX.XX.XX
  # major.minor.maintenance
  # eg: 1.0.0 or 12.4.33


  # Is this installed only on mac os?
  # /usr/libexec/PlistBuddy -h
  # xcodebuild -target micdrp -configuration Release -showBuildSettings

  pushd packages/client/ios
    local oldVersionName="$majorDigit.$minorDigit.$maintenanceDigit"
    local newVersionName="$nextMajorDigit.$nextMinorDigit.$nextMaintenanceDigit"

    if [[ $versionChangeWillTakePlace -gt 1 ]]; then
      printf "[ ] Bumping iOS version from $oldVersionName to $newVersionName...\r"
      /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $newVersionName" ./micdrp/Info.plist
      /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $newVersionName" ./micdrpTests/Info.plist
      xcodebuild -scheme micdrp -target micdrp -configuration Release MARKETING_VERSION="$newVersionName"
      xcodebuild -scheme micdrp -target micdrpTests -configuration Release MARKETING_VERSION="$newVersionName"
      agvtool new-marketing-version "$newVersionName" &>2 /dev/null
      printf "[\xE2\x9C\x94] Bumping iOS version from $oldVersionName to $newVersionName... SUCCESS\n"
    fi
  
    if [[ $versionChangeWillTakePlace -gt 0 ]]; then
      printf "[ ] Bumping iOS build from $buildDigit$releaseVariant to $nextBuildDigit$nextReleaseVariant...\r"
      /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $nextBuildDigit$nextReleaseVariant" ./micdrp/Info.plist
      /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $nextBuildDigit$nextReleaseVariant" ./micdrpTests/Info.plist
      xcodebuild -scheme micdrp -target micdrp -configuration Release CURRENT_PROJECT_VERSION="$nextBuildDigit$nextReleaseVariant"
      xcodebuild -scheme micdrp -target micdrpTests -configuration Release CURRENT_PROJECT_VERSION="$nextBuildDigit$nextReleaseVariant"
      agvtool new-version -all "$nextBuildDigit$nextReleaseVariant" &>2 /dev/null
      printf "[\xE2\x9C\x94] Bumping iOS build from $buildDigit$releaseVariant to $nextBuildDigit$nextReleaseVariant... SUCCESS\n"
    fi
  popd
  
  return 0;
}

###
### We may need a keystore and to sign the bundle
### https://medium.com/androiddevelopers/building-your-first-app-bundle-bbcd228bf631
### Run ONCE for every computer that will build and upload bundles to Play Store:
### debug: keytool -genkey -v -keystore /Users/angusryer/dv/micdrp/packages/client/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
### release: keytool -genkey -v -keystore /Users/angusryer/dv/micdrp/packages/client/android/app/micdrp.keystore -alias androidReleasekey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Release,O=Android,C=US"
### 
### Run this as part of this script to sign the bundle:
### jarsigner -keystore $pathToKeystore app-release.aab $keyAlias

function buildAndroid () {
  printf "[ ] Checking for and removing conflicting bundles...\r"
  local lowerCaseEnv=$(echo "$env" | tr '[A-Z]' '[a-z]')
  cd packages/client
  rm android/app/build/outputs/aab/micdrp-$lowerCaseEnv-$nextBuild.aab 2> /dev/null
  printf "[\xE2\x9C\x94] Checking for and removing conflicting bundles... SUCCESS\n"
  # https://github.com/react-native-community/cli/blob/main/docs/commands.md#bundle
  npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/

  # Remove all drawable extension folder from packages/client/android/app/src/main/res
  pushd android/app/src/main/res
    rm -rf drawable-*
  popd

  pushd android
    ./gradlew bundleRelease
    if [ "$?" != "0" ]
      then
      echo "ERROR: Build failed!"
      exit 1;
    fi
  popd

  mv android/app/build/outputs/bundle/release/app-release.aab android/app/build/outputs/bundle/release/micdrp-$lowerCaseEnv-$nextBuild.aab
  printf "\n\n[\xE2\x9C\x94] Your new bundle is ready!\n\n"
  ls -lah `pwd`/android/app/build/outputs/bundle/release/micdrp-$lowerCaseEnv-$nextBuild.aab
  return 0;
}

function buildIos () {

  ## Here is one solution
  ## need to create an exportOptions_debug.plist & exportOptions_release.plist apparently

  ## Upload to app store
  ## https://help.apple.com/app-store-connect/#/devb1c185036
  pwd
  pushd packages/client/ios
    # https://stackoverflow.com/questions/2664885/xcode-build-and-archive-from-command-line
    # Clean
    xcodebuild clean -workspace micdrp.xcworkspace -scheme micdrp
    # Archive
    # need to make sure correct device is selected
    xcodebuild archive -workspace micdrp.xcworkspace -scheme "micdrp" -destination 'generic/platform=iOS' -configuration Release -archivePath build/outputs/archives/micdrp.xcarchive
    # Export
    xcodebuild -exportArchive -archivePath build/outputs/archives/micdrp.xcarchive -exportPath build/outputs/exports/micdrp.ipa -exportOptionsPlist micdrp/exportOptions.plist
    
    # FOR DEPLOYMENT:
    # Validate
    # xcrun altool --validate-app -f file -t platform -u username [-p password] [--output-format xml]
    # Upload archive
    # xcrun altool --upload-package -f file -t platform -u username [-p password] [—output-format xml]
  popd
  # # output location to console
  printf "Bulding iOS bundles not implemented yet..."
  return 0;
}

function computeVersions () {
  releaseVariant=$(getReleaseVariant)
  
  # Always bump the build number when building for staging or production
  buildDigit=$(getCurrentBuildVersion)
  nextBuildDigit=$((buildDigit+1))

  majorDigit=$(getMajorVersion)
  nextMajorDigit=$majorDigit
  minorDigit=$(getMinorVersion)
  nextMinorDigit=$minorDigit
  maintenanceDigit=$(getMaintenanceVersion)
  nextMaintenanceDigit=$maintenanceDigit

  ##
  ## WE ONLY ALLOW MAJOR, MINOR OR MAINTENANCE VERSION CHANGES
  ## WHEN MOVING FROM A GRADLE PRODUCTION TO THE NEXT STAGING BUILD
  ##

  # if we're building for staging and existing
  # build.gradle is prod, ++build number and allow the -Mm flags,
  # defaulting to bumping maintenance
  # in all other cases, ++build number only

  if ([ "$env" = 'dev' ] || [ "$keepVersion" -eq 1 ]); then
    return $versionChangeWillTakePlace;
  fi

  # Make sure we notify the next function that we'll be bumping the build number 
  versionChangeWillTakePlace=1

  # Set the new releaseVariant
  [[ "$env" = "Staging" ]] && nextReleaseVariant='s';
  [[ "$env" = "Production" ]] && nextReleaseVariant='';

  # Notify the next function that we'll be changing the build variant
  [[ $releaseVariant != $nextReleaseVariant ]] && versionChangeWillTakePlace=2;

  # Going from staging to production 
  if [[ "$env" = "Staging" ]] && [[ -z "$releaseVariant" ]]; then
    # Bump the maintenance number
    nextMaintenanceDigit=$((maintenanceDigit+1))
  
    if [ $bumpMinor -eq 1 ]; then
      nextMinorDigit=$((minorDigit+1))
      nextMaintenanceDigit=0
    fi

    if [ $bumpMajor -eq 1 ]; then
      nextMajorDigit=$((majorDigit+1))
      nextMinorDigit=0
      nextMaintenanceDigit=0
    fi

    # Notify the next function that we'll be modifying the version numbers
    versionChangeWillTakePlace=3
  fi

  return $versionChangeWillTakePlace;
}

function buildClient () {
  computeVersions
  case $? in
    0)
      printf "[\xE2\x9C\x94] No version changes necessary\n"
      ;;
    1|2|3)
      bumpAndroidVersion
      bumpIosVersion
      ;;
  esac
  if [[ $device = 'all' ]]; then
    printf "Building iOS and Android client bundles...\n"
    sleep 1
    buildAndroid
    buildIos
  elif [[ $device = 'ios' ]]; then
    printf "Building iOS client bundle...\n"
    sleep 1
    buildIos
  else
    printf "Building Android client bundle...\n"
    sleep 1
    buildAndroid
  fi
  printf "\n-----------------------------------------\n\n"
  return 0;
}

printf "\n-----------------------------------------\n\n"

while getopts ':kMme:h' option; do
  case $option in
    k) # don't change any version numbers, including build number
      keepVersion=1
    ;;
    
    m) # bump minor version
      bumpMinor=1
    ;;

    M) # bump major version
      bumpMajor=1
    ;;

    e)
      if [[ $OPTARG = "staging" ]] || [[ $OPTARG = "prod" ]]; then
        env=$OPTARG
      fi
      case "$env" in
        prod)
          printf "[\xE2\x9C\x94] Using Production environment variables\n"
          export ENVFILE=.production.env
          env="Production"
          buildClient
        ;;

        staging)
          printf "[\xE2\x9C\x94] Using Staging environment variables\n"
          export ENVFILE=.staging.env
          env="Staging"
          buildClient
        ;;

        dev)
          if [[ $OPTARG != "dev" ]]; then
            printf "You must specify dev, staging or prod with the -e option\n"
            exit 1
          fi

          printf "[\xE2\x9C\x94] Using Development environment variables\n"
          export ENVFILE=.development.env
          buildClient
        ;;

      esac
    ;;

    h) help;;
    *) help;;
    \?) # Invalid option
      printf "Error: Invalid option\n"
      help
      exit 1
    ;;

  esac
done
