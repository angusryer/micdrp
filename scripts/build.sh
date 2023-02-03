#!/bin/bash

# TODOs remaining
# deploy to apple store via command switch
# deploy to google play via command switch

# keep ios version numbers in sync in xcode
# https://www.theswift.dev/posts/easily-keep-build-numbers-and-marketing-versions-in-sync
# and then remove the edits to the plist files below
# to avoid needing plistbuddy on macos. But then
# you can only build on macos, so... 

# Make sure the local development environment is configured
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/emulator
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home

red='\033[0;31m'
nc='\033[0m' # No Color
grn='\033[0;32m'

clientDir=packages/client
gradlePath=packages/client/android/app/build.gradle
env="dev"
deploy=0
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

finalIosArchivePath=
finalAndroidBuildPath=
deploy=0

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
  printf '%s\n' "$*" > /dev/null
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
        printf "[x] Moving Android version from $oldVersionName to $newVersionName... ${red}FAILED${nc}\n"
        printf "Error verifying $gradlePath... UNMODIFIED\n"
        exit 3;
    else
      printf "[\xE2\x9C\x94] Bumping Android version from $oldVersionName to $newVersionName... ${grn}SUCCESS${nc}\n"
    fi
  fi

  if [[ $versionChangeWillTakePlace -gt 0 ]]; then
    printf "[ ] Bumping Android build from $buildDigit to $nextBuildDigit\r"
    sed -i "" "s/versionCode $buildDigit/versionCode $nextBuildDigit/g" $gradlePath
    printf "[\xE2\x9C\x94] Bumping Android build from $buildDigit to $nextBuildDigit... ${grn}SUCCESS${nc}\n"
  fi
  
  return 0;
}

function bumpIosVersion () {
  # https://developer.apple.com/library/archive/qa/qa1827/_index.html
  # https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html

  # /usr/libexec/PlistBuddy -h  <-- ONLY MACOS
  # xcodebuild -target micdrp -configuration Release -showBuildSettings

  
  pushd packages/client/ios > /dev/null
    local oldVersionName="$majorDigit.$minorDigit.$maintenanceDigit"
    local newVersionName="$nextMajorDigit.$nextMinorDigit.$nextMaintenanceDigit"

    if [[ $versionChangeWillTakePlace -gt 1 ]]; then
      printf "[ ] Bumping iOS version from $oldVersionName to $newVersionName...\r"
      /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $newVersionName" ./micdrp/Info.plist
      /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $newVersionName" ./micdrpTests/Info.plist
      xcodebuild -scheme micdrp -target micdrp -configuration Release MARKETING_VERSION="$newVersionName"
      xcodebuild -scheme micdrp -target micdrpTests -configuration Release MARKETING_VERSION="$newVersionName"
      agvtool new-marketing-version "$newVersionName" > /dev/null
      printf "[\xE2\x9C\x94] Bumping iOS version from $oldVersionName to $newVersionName... ${grn}SUCCESS${nc}\n"
    fi
  
    if [[ $versionChangeWillTakePlace -gt 0 ]]; then
      printf "[ ] Bumping iOS build from $buildDigit$releaseVariant to $nextBuildDigit$nextReleaseVariant...\r"
      /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $nextBuildDigit$nextReleaseVariant" ./micdrp/Info.plist
      /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $nextBuildDigit$nextReleaseVariant" ./micdrpTests/Info.plist
      xcodebuild -scheme micdrp -target micdrp -configuration Release CURRENT_PROJECT_VERSION="$nextBuildDigit$nextReleaseVariant"
      xcodebuild -scheme micdrp -target micdrpTests -configuration Release CURRENT_PROJECT_VERSION="$nextBuildDigit$nextReleaseVariant"
      agvtool new-version -all "$nextBuildDigit$nextReleaseVariant" > /dev/null
      printf "[\xE2\x9C\x94] Bumping iOS build from $buildDigit$releaseVariant to $nextBuildDigit$nextReleaseVariant... ${grn}SUCCESS${nc}\n"
    fi
  popd
  
  
  return 0;
}

###
### We will need a keystore and to sign the bundle for RELEASE
### https://medium.com/androiddevelopers/building-your-first-app-bundle-bbcd228bf631
### Run ONCE for every computer that will build and upload bundles to Play Store:
### debug: keytool -genkey -v -keystore /Users/angusryer/dv/micdrp/packages/client/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
### release: keytool -genkey -v -keystore /Users/angusryer/dv/micdrp/packages/client/android/app/micdrp.keystore -alias androidReleasekey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Release,O=Android,C=US"
### 
### Run this as part of this script to sign the bundle: ???????
### jarsigner -keystore $pathToKeystore app-release.aab $keyAlias

function buildAndroid () {
  printf "[ ] Checking for and removing conflicting Android bundles...\r"
  [[ "$env" == 'dev' ]] && releaseVariant='d'
  local newVersionName="$nextMajorDigit.$nextMinorDigit.$nextMaintenanceDigit"
  local filePath="android/app/build/outputs/bundle/release/micdrp-$releaseVariant-$newVersionName-$nextBuildDigit.aab"
  rm $filePath > /dev/null
  printf "[\xE2\x9C\x94] Checking for and removing conflicting Android bundles... ${grn}SUCCESS${nc}\n"
  # https://github.com/react-native-community/cli/blob/main/docs/commands.md#bundle
  npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/ > /dev/null

  # Remove all drawable extension folder from packages/client/android/app/src/main/res
  pushd android/app/src/main/res > /dev/null
    rm -rf drawable-*
  popd

  pushd android > /dev/null
    ./gradlew bundleRelease
    if [ "$?" != "0" ]; then
      printf "${red}ERROR: Build failed!${nc}"
      exit 1;
    fi
  popd

  mv android/app/build/outputs/bundle/release/app-release.aab $filePath
  
  printf "\n--------------------------------------------------------------\n"
  printf "\n\n[${grn}\xE2\x9C\x94${nc}] ${grn}Your new Android bundle is ready!${nc}\n\n"
  printf "`pwd`/$filePath\n\n"
  ls -lhu `pwd`/$filePath
  finalAndroidBuildPath="`pwd`/$filePath"
  printf "\n--------------------------------------------------------------\n"
  printf "\n\n\n"

  if [ "$deploy" -gt 0 ] then;
    deployAndroid
  fi

  return 0;
}

function deployAndroid () {
  # https://medium.com/android-news/google-playstore-and-automated-deployment-beeef278d345
  # https://medium.com/swlh/google-playstore-and-automated-deployment-with-aab-a35eddabf128
  printf "Deploying Android to Google Play\n"
}

function buildIos () {
  pushd ios > /dev/null
    printf "[ ] Checking for and removing conflicting iOS bundles...\r"
    local newVersionName="$nextMajorDigit.$nextMinorDigit.$nextMaintenanceDigit"
    [[ "$env" == 'dev' ]] && releaseVariant='d'
    local filePath="build/outputs/archives/micdrp-$releaseVariant-$newVersionName-$nextBuildDigit.xcarchive"
    rm -rdf $filePath > /dev/null
    printf "[\xE2\x9C\x94] Checking for and removing conflicting iOS bundles... ${grn}SUCCESS${nc}\n"
    # Clean
    xcodebuild -workspace micdrp.xcworkspace -scheme micdrp clean > /dev/null
    # # Archive
    xcodebuild -workspace micdrp.xcworkspace -scheme micdrp -sdk iphoneos -configuration Release archive -archivePath $filePath > /dev/null
  popd
  
  if [[ -d "`pwd`/ios/$filePath" ]]; then # the filesystem treats .xcarchive like a directory, so use -d
    printf "\n--------------------------------------------------------------\n"
    printf "\n\n[${grn}\xE2\x9C\x94${nc}] ${grn}Your new iOS archive is ready!${nc}\n\n"
    printf "`pwd`/ios/$filePath\n\n"
    ls -lhu `pwd`/ios/$filePath/..
    finalIosArchivePath="`pwd`/ios/$filePath"
    printf "\n--------------------------------------------------------------\n"
    printf "\n\n\n"
  else
    printf "${red}ERROR: Archive failed!${nc}\n"
    exit 1;
  fi

  if [ "$deploy" -gt 0 ]; then
    deployIos
  fi

  return 0;
}

function deployIos () {
  printf "Deploying iOS to App Store Connect\n"
   # Upload to app store
  # https://help.apple.com/app-store-connect/#/devb1c185036
  # https://stackoverflow.com/questions/2664885/xcode-build-and-archive-from-command-line

  # Check for an archive that matches the latest version

  pushd packages/client/ios
    # Export
    # xcodebuild -exportArchive -archivePath build/outputs/archives/micdrp.xcarchive -exportPath build/outputs/exports/micdrp.ipa -exportOptionsPlist micdrp/exportOptions.plist
    
    # WE MAY NEED THIS FOR DEPLOYMENT:
    # Validate
    # xcrun altool --validate-app -f file -t platform -u username [-p password] [--output-format xml]
    # Upload archive
    # xcrun altool --upload-package -f file -t platform -u username [-p password] [—output-format xml]
  popd
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
    nextBuildDigit=$buildDigit # Don't bump the build if it's dev or -k is specified
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
  cd packages/client > /dev/null
  if [[ $device = 'all' ]]; then
    printf "Building iOS and Android client bundles...\n"
    buildAndroid
    buildIos
    # if -d was passed and the version or build numbers are changed, then deploy.
    # finalIosArchivePath and finalAndroidBuildPath
    if [ $deploy -eq 1 ]; then
      if [[ $env != 'dev' ]] && [[ $keepVersion -eq 0 ]]; then
        # 
      fi
    fi
  elif [[ $device = 'ios' ]]; then
    printf "Building iOS client bundle...\n"
    buildIos
    # if -d was passed and the version or build numbers are changed, then deploy.
    # finalIosArchivePath
  else
    printf "Building Android client bundle...\n"
    buildAndroid
    # if -d was passed and the version or build numbers are changed, then deploy.
    # finalAndroidBuildPath
  fi
  return 0;
}

while getopts ':dkMme:h' option; do
  case $option in
    d)
      deploy=1
    ;;

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
