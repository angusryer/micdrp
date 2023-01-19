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
nextVersion=0
iosVersionNumber=0
metroPort=9000
keepVersion=0

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

function getAndroidVersionCode () {
  local androidVersionCode="$(grep -oE "^.\s*versionCode [0-9]+" $gradlePath)"
  echo $androidVersionCode;
}

function getAndroidVersionName () {
  local androidVersionName="$(grep -oE "^.\s*versionName \".*[0-9]+.+\"" $gradlePath)"
  echo $androidVersionName;
}

function incrementAndroidVersion () {

  # https://developer.android.com/studio/publish/versioning
  # versionCode - INTERNAL version number, positive integer only
  # versionName - user-visible, string

  # You can set default values for different build variants (staging, release)
  # https://developer.android.com/studio/publish/versioning#versionvalues
  # May be able to set up schemes in Android Studio, then specify them on
  # the command line 
  
  androidVersionName=$(getAndroidVersionName)
  androidVersionCode=$(getAndroidVersionCode)
  local currentAndroidVersionCode=$(echo $androidVersionCode | tr -dc '0-9')
  nextVersion=$((currentAndroidVersionCode+1))

  # We only want to increment the build number when we're building for Staging
  # but the existing build is for Production

  local versionNameString=$(echo $androidVersionName | sed 's/versionName //')

  if [[ $env = "Staging" ]] && [[ $versionNameString = "\"Staging $currentAndroidVersionCode.0\"" ]]; then
    printf "[\xE2\x9C\x94] Checking for correct build version... SUCCESS\n"
    nextVersion=$currentAndroidVersionCode
    return -1;
  fi

  if [[ $env = "Production" ]] && [[ $versionNameString = "\"Staging $currentAndroidVersionCode.0\"" ]]; then
    printf "[\xE2\x9C\x94] Checking for correct build version... SUCCESS\n"
    nextVersion=$currentAndroidVersionCode
    return -1;
  fi

  if [[ $env = "Production" ]] && [[ $versionNameString = "\"Production $currentAndroidVersionCode.0\"" ]]; then
    printf "[\xE2\x9C\x94] Checking for correct build version... SUCCESS\n"
    nextVersion=$currentAndroidVersionCode
    return -1;
  fi
  
  printf "[ ] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextVersion...\r"

  sed -i "" "s/$androidVersionName/versionName \"$env $nextVersion.0\"/g" $gradlePath

  # Ensure that the version has actually been updated
  local updatedAndroidVersionName=$(grep -oE "versionName \"$env $nextVersion.+\"" $gradlePath)
  if [ "$updatedAndroidVersionName" == "" ]; then
      printf "[x] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextVersion... FAILED\n"
      printf "Error verifying $gradlePath... UNMODIFIED\n"
      exit 3;
  fi

  # Update versionCode if versionName change was successful
  sed -i "" "s/versionCode $currentAndroidVersionCode/versionCode $nextVersion/g" $gradlePath
  printf "[\xE2\x9C\x94] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextVersion... SUCCESS\n"
  return 0;
}

function incrementIosVersion () {
  # https://developer.apple.com/library/archive/qa/qa1827/_index.html
  # https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html

  # Build number
  # We can include a suffix (e.g. staging) -- While developing a new version of your app, you can
  # include a suffix after the number that is being updated; for example 3.1.3a1. The character
  # in the suffix represents the stage of development for the new version. For example, you can
  # represent development, alpha, beta, and final candidate, by d, a, b, and fc. The final number
  # in the suffix is the build version, which cannot be 0 and cannot exceed 255. When you release
  # the new version of your app, remove the suffix.
  # 

  # User-visible release version number
  # CFBundleShortVersionString is "marketing version" or "mvers" -- this is what end users see
  # The version number, which is the number shown to your application’s users, identifies a
  # released version of your application. It is stored in your application’s Info.plist as
  # CFBundleShortVersionString (Bundle versions string, short).
  # XXXX.XX.XX
  # major.minor.maintenance
  # eg: 1.0.0 or 12.4.33

  cd packages/client/ios

  local versionNameString=$(echo agvtool vers -terse | sed 's/iOS version number: //')

  printf "Version: $versionNameString\n"

  if [[ $env = "Staging" ]] && [[ $versionNameString = "\"Staging $currentAndroidVersionCode.0\"" ]]; then
    printf "[\xE2\x9C\x94] Checking for correct build version... SUCCESS\n"
    nextVersion=$currentAndroidVersionCode
    return -1;
  fi

  if [[ $env = "Production" ]] && [[ $versionNameString = "\"Staging $currentAndroidVersionCode.0\"" ]]; then
    printf "[\xE2\x9C\x94] Checking for correct build version... SUCCESS\n"
    nextVersion=$currentAndroidVersionCode
    return -1;
  fi

  if [[ $env = "Production" ]] && [[ $versionNameString = "\"Production $currentAndroidVersionCode.0\"" ]]; then
    printf "[\xE2\x9C\x94] Checking for correct build version... SUCCESS\n"
    nextVersion=$currentAndroidVersionCode
    return -1;
  fi

  local lowerCaseEnv=$(echo "$env" | tr '[A-Z]' '[a-z]')
  # agvtool bump -all
  
  printf "iOS version number: $fullversion\n"
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
  rm android/app/build/outputs/aab/micdrp-$lowerCaseEnv-$nextVersion.aab 2> /dev/null
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

  mv android/app/build/outputs/bundle/release/app-release.aab android/app/build/outputs/bundle/release/micdrp-$lowerCaseEnv-$nextVersion.aab
  printf "\n\n[\xE2\x9C\x94] Your new bundle is ready!\n\n"
  ls -lah `pwd`/android/app/build/outputs/bundle/release/micdrp-$lowerCaseEnv-$nextVersion.aab
  return 0;
}

function buildIos () {

  ## Here is one solution
  ## need to create an exportOptions_debug.plist & exportOptions_release.plist apparently

  # https://stackoverflow.com/questions/2664885/xcode-build-and-archive-from-command-line
  # Clean
  xcodebuild clean -workspace work-space-name.xcworkspace -scheme scheme-name
  # Archive
  xcodebuild archive -workspace work-space-name.xcworkspace -scheme "scheme-name" -configuration Release -archivePath IPA-name.xcarchive
  # Export
  xcodebuild -exportArchive -archivePath IPA-name.xcarchive -exportPath IPA-name.ipa -exportOptionsPlist exportOptions.plist


 ## Another solution found:
 ## Do this from ios dir?

  appname='AppName'
  config='Ad Hoc Distribution' # Does this need to change to accommodate submitting thru App Store Connect?
  sdk='iphoneos3.1.3'
  project_dir=$(pwd)

  xcodebuild -activetarget -configuration "$config" -sdk $sdk build || die "build failed"

  echo making ipa...
  # packaging
  cd build/"$config"-iphoneos || die "no such directory"
  # remove old package?
  rm -rf Payload
  rm -f "$appname".*.ipa
  # make new package
  mkdir Payload
  cp -Rp "$appname.app" Payload/
  if [ -f "$project_dir"/iTunesArtwork ] ; then
      cp -f "$project_dir"/iTunesArtwork Payload/iTunesArtwork
  fi

  # final bundle
  ipaname="$appname.$fullversion.$(date -u +%Y%m%d%H%M%S).ipa"
  zip -r $ipaname Payload

  # output location to console
  printf "Bulding iOS bundles not implemented yet..."
  return 0;
}

function buildClient () {
  if [[ $device = 'all' ]]; then
    printf "Building iOS and Android client bundles...\n"
    [ $keepVersion -eq 0 ] && incrementAndroidVersion
    [ $keepVersion -eq 0 ] && incrementIosVersion
    buildAndroid
    buildIos
  elif [[ $device = 'ios' ]]; then
    printf "Building iOS client bundle...\n"
    [ $keepVersion -eq 0 ] && incrementIosVersion
    buildIos
  else
    printf "Building Android client bundle...\n"
    [ $keepVersion -eq 0 ] && incrementAndroidVersion
    buildAndroid
  fi
  printf "\n-----------------------------------------\n\n"
  return 0;
}

printf "\n-----------------------------------------\n\n"

while getopts ':ve:h' option; do
  case $option in
    v)
      keepVersion=1
    ;;
    e)
      if [[ $OPTARG = "staging" ]] || [[ $OPTARG = "prod" ]]; then
        env=$OPTARG
      fi
      case $env in
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

          if [[ $device = 'all' ]]; then
            printf "Building iOS and Android client bundles...\n"
            buildAndroid
            buildIos
          elif [[ $device = 'ios' ]]; then
            printf "Building iOS client bundle...\n"
            buildIos
          else
            printf "Building Android client bundle...\n"
            buildAndroid
          fi
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
