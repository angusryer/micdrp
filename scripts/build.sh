#!/bin/bash

# IOS
# https://developer.apple.com/library/archive/qa/qa1827/_index.html
# https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html
# /usr/libexec/PlistBuddy -h  <-- ONLY MACOS
# xcodebuild -target micdrp -configuration Release -showBuildSettings

# Android
# https://developer.android.com/studio/publish/versioning
# versionCode - INTERNAL version number, positive integer only (keep it to the maintenance version number)
# versionName - user-visible, string (keep it like iOS, i.e.: 1.0.1s or 1.0.1)
# You can set default values for different build variants (staging, release)
# https://developer.android.com/studio/publish/versioning#versionvalues
# May be able to set up schemes in Android Studio, then specify them on
# the command line
### We will need a keystore and to sign the bundle for RELEASE
### https://medium.com/androiddevelopers/building-your-first-app-bundle-bbcd228bf631
### Run ONCE for every computer that will build and upload bundles to Play Store:
### debug: keytool -genkey -v -keystore /Users/angusryer/dv/micdrp/packages/client/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
### release: keytool -genkey -v -keystore /Users/angusryer/dv/micdrp/packages/client/android/app/micdrp.keystore -alias androidReleasekey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Release,O=Android,C=US"
### 
### Run this as part of this script to sign the bundle: ???????
### jarsigner -keystore $pathToKeystore app-release.aab $keyAlias

#########################################
#                                       #
#   Function and variable definitions   #
#                                       #
#########################################

export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/emulator
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home

red='\033[0;31m'
grn='\033[0;32m'
yel='\033[0;93m'
blu='\033[0;94m'
nc='\033[0m' # No Color

# 0: no change, 1: build number only, 2: version and build numbers
shouldUploadBinaries=0

clientDir="packages/client"
env='development';

isStaging=0
isProduction=0
buildAndroid=0
buildIos=0
checkOnly=0
shouldClean=0

androidRelease=0
iOSRelease=0

keepVersion=0
shouldBumpMinor=0
shouldBumpMajor=0
shouldBumpPatch=0

majorDigit=
nextMajorDigit=

minorDigit=
nextMinorDigit=

patchDigit=
nextPatchDigit=

lastReleaseVariant=
nextReleaseVariant=

buildNumber=
nextBuildNumber=

releasesCsv="./releases.csv"
iosArchivePath=
androidFilePath=

function help () {
  printf "\n"
  printf "** If you do not specify an environment (ie. you are using the dev environment) or you provide the -k option,\n"
  printf "** no version or build numbers will be changed. If you specify staging while the previous variant is also staging,\n"
  printf "** only the build number will be incremented. In all other cases, the build number and the patch number will be incremented.\n"
  printf "** If you provide one of the M or m flags (M will take priority), then the Major or minor numbers will be bumped,\n"
  printf "** which will reset the lesser digits to zero.\n"
  printf "\n\n"
  printf "Usage: ./build.sh -ps -ai [-kMm] -c -C\n"
  printf "Example: create an upload-ready production Android build, bumping the minor version number: ./build.sh -apm\n"
  printf "  -a  Create an upload-ready Android AAB\n"
  printf "  -i  Create an upload-ready iOS archive\n"
  printf "  -p  Point to production (use .env.production)\n"
  printf "  -s  Point to staging (use .env.staging)\n"
  printf "  -c  Print the current version and resultant version given arguments given\n"
  printf "  -k  Keep/don't modify the version\n"
  printf "  -M  Bump the Major version number digit\n"
  printf "  -m  Bump the minor version number digit\n"
  printf "  -C  Clean all caches before building\n"
  printf "  -h  This help screen\n"
  printf "\n\n"
  printf "Example to check the next version number given that the latest version is production 1.0.0 (1), and you\n"
  printf "want to build a staging binary. Note that you must _end_ the command flags with 'c' for this to work.\n"
  printf "\n\n"
  printf "./build.sh -sc\n"
  printf "\n\n"
  printf "Output:\n"
  printf "  > Latest version: 1.0.0 (1), production, Date: 2022-01-10 @10:43:23\n"
  printf "  > Next version: 1.0.0 (2), staging\n\n"
  exit 0;
}

function die () {
  printf "\n${red}ERROR:${nc} %s\n\n" "$*"
  exit 1;
}

function checkEnvironment() {
  if [ "$isProduction" -eq 1 ] && [ "$isStaging" -eq 1 ]; then die "Cannot specify both -p and -s"; fi
  if [ "$isProduction" -eq 0 ] && [ "$isStaging" -eq 0 ]; then die "Must specify one of -p or -s"; fi
  if [ "$runAndroid" -eq 0 ] && [ "$runIos" -eq 0 ]; then die "Must specify one or both of -a or -i"; fi
}

function loadVersionFromCsv() {
  if [ ! -f "$releasesCsv" ]; then
    # The file does not exist, so create it with headers
    echo "Version,Build,Variant,AndroidRelease,iOSRelease,OtaAndroid,OtaIos,Date,Time" > "$releasesCsv"
  fi
  local latestRow=$(awk -F ',' -v env="$env" '$3 == env {latest=$0}END{print latest}' "$releasesCsv")
  oldVersion=$(echo "$latestRow" | awk -F',' '{print $1}')
  IFS='.' read -r majorDigit minorDigit patchDigit <<< "$oldVersion"
  buildNumber=$(echo "$latestRow" | awk -F',' '{print $2}')
  lastReleaseVariant=$(echo "$latestRow" | awk -F',' '{print $3}')
  androidRelease=$(echo "$latestRow" | awk -F',' '{print $4}')
  iOSRelease=$(echo "$latestRow" | awk -F',' '{print $5}')
  dateStamp=$(echo "$latestRow" | awk -F',' '{print $8}')
  timeStamp=$(echo "$latestRow" | awk -F',' '{print $9}')
}

function bumpVersionNumbers() {
  # Bump the patch number by default
  nextPatchDigit=$((patchDigit+1))

  # Bump minor or major numbers if m or M flags are passed, M being considered priority
  if [ $shouldBumpMinor -eq 1 ]; then
    nextMinorDigit=$((minorDigit+1))
    nextPatchDigit=0
  fi

  if [ $shouldBumpMajor -eq 1 ]; then
    nextMajorDigit=$((majorDigit+1))
    nextMinorDigit=0
    nextPatchDigit=0
  fi
}

function computeNextVersion () {
  ## Only allow Major, minor and patch version number changes
  ## when moving from production to the next staging build.
  ## In all cases (except for when we are building a 'dev' binary
  ## or the -k flag is passed) we will increment the build number.
  
  # Set up a default starting point for each number
  nextBuildNumber=$((buildNumber+1))
  nextMajorDigit=$majorDigit
  nextMinorDigit=$minorDigit
  nextPatchDigit=$patchDigit

  [[ "$env" = 'development' ]] && nextReleaseVariant='development';
  [[ "$env" = 'staging' ]] && nextReleaseVariant='staging';
  [[ "$env" = 'production' ]] && nextReleaseVariant='production';

  if ([[ "$env" = 'development' ]] || [ "$keepVersion" -eq 1 ]); then
    nextBuildNumber=$buildNumber # Don't bump the build if it's dev or -k is specified
    return 0;
  fi

  # If we're moving from production to production, we must warn the user since this is not usually intended.
  if [[ "$lastReleaseVariant" = 'production' ]] && [[ "$nextReleaseVariant" = 'production' ]]; then

    printf "\nYou have not produced any staging binaries since the last production binary.\n"

    if [ "$checkOnly" -ne 1 ]; then
      printf "Are you sure you want to increment the patch version and produce two production binaries in a row?\n\n"
      read -rsn1 -p 'Continue? (y/n) (default is no): ' shouldContinue
      case $shouldContinue in
        y|Y)
          printf "\nContinuing...\n"
          bumpVersionNumbers
          ;;
        n|N|"") printf "${yel}Aborting${nc}\n"; exit 0;;
      esac
    else
      bumpVersionNumbers
    fi
  fi

  # Going from production to staging OR production to production
  if ([[ "$lastReleaseVariant" = 'production' ]] && [[ "$nextReleaseVariant" = 'staging' ]]); then
    bumpVersionNumbers
  fi

  return 0;
}

function getNextVersionString() {
  echo "$nextMajorDigit.$nextMinorDigit.$nextPatchDigit"
}

function getCurrentVersionString() {
  echo "$majorDigit.$minorDigit.$patchDigit"
}

# Stores the version, build and variant information to our CSV file
function saveVersionToFile() {
  assembledVersionNumber=$(getNextVersionString)
  echo "$assembledVersionNumber,$nextBuildNumber,$nextReleaseVariant,$androidRelease,$iOSRelease,,,$(date +%Y-%m-%d),$(date +%H:%M:%S)" >> "$releasesCsv"
}

# Keeps all the .env files aligned with the same version and build numbers
function updateEnvFiles() {
  local nextVersionNumber=$(getNextVersionString)

  local vLineNum="$(grep -m 1 -n "VERSION_NUMBER" .env.development | cut -d: -f1)"
  sed -i '' "${vLineNum}s/VERSION_NUMBER=.*/VERSION_NUMBER=${nextVersionNumber}/g" .env.development
  local bLineNum="$(grep -m 1 -n "BUILD_NUMBER" .env.development | cut -d: -f1)"
  sed -i '' "${bLineNum}s/BUILD_NUMBER=.*/BUILD_NUMBER=${nextBuildNumber}/g" .env.development

  local vLineNum="$(grep -m 1 -n "VERSION_NUMBER" .env.staging | cut -d: -f1)"
  sed -i '' "${vLineNum}s/VERSION_NUMBER=.*/VERSION_NUMBER=${nextVersionNumber}/g" .env.staging
  local bLineNum="$(grep -m 1 -n "BUILD_NUMBER" .env.staging | cut -d: -f1)"
  sed -i '' "${bLineNum}s/BUILD_NUMBER=.*/BUILD_NUMBER=${nextBuildNumber}/g" .env.staging

  local vLineNum="$(grep -m 1 -n "VERSION_NUMBER" .env.production | cut -d: -f1)"
  sed -i '' "${vLineNum}s/VERSION_NUMBER=.*/VERSION_NUMBER=${nextVersionNumber}/g" .env.production
  local bLineNum="$(grep -m 1 -n "BUILD_NUMBER" .env.production | cut -d: -f1)"
  sed -i '' "${bLineNum}s/BUILD_NUMBER=.*/BUILD_NUMBER=${nextBuildNumber}/g" .env.production

  [ "$?" -ne 0 ] && return 1;
  return 0;
}

function displayCurrentVersion() {
  local vers=$(getCurrentVersionString)
  printf "Latest version: $vers ($buildNumber), $lastReleaseVariant, Date: $dateStamp @$timeStamp\n"
}

function displayNextVersion() {
  local vers=$(getNextVersionString)
  if [ "$1" = "true" ]; then
    printf "$vers ($nextBuildNumber), $nextReleaseVariant\n"
  else
    printf "Next version: $vers ($nextBuildNumber), $nextReleaseVariant\n"
  fi
}

function buildAndroidBinary() {
  printf "Building Android AAB...\n"
  androidFilePath="app/build/outputs/bundle/release/$finalFileName.aab"
  rm android/$androidFilePath > /dev/null

  if [[ "$env" = 'development' ]]; then
    npx react-native bundle --platform android --dev true --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
  else 
    npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
  fi

  [ $? -ne 0 ] && return 1;
  
  pushd android/app/src/main/res > /dev/null
    rm -rf drawable-*
  popd > /dev/null

  pushd android > /dev/null
    ./gradlew bundleRelease
    [ $? -ne 0 ] && return 1;
  popd > /dev/null

  mv android/app/build/outputs/bundle/release/app-release.aab android/$androidFilePath
}

function buildIosBinary() {
  printf "Building iOS archive...\n"
  iosArchivePath="build/outputs/archives/$finalFileName.xcarchive"


  pushd ios > /dev/null
    local infoPlistPath="$(pwd)/micdrp/Info.plist"
    if [[ ! "$env" = 'production' ]]; then
      xcodebuild -workspace micdrp.xcworkspace -scheme micdrp-$nextReleaseVariant -configuration Release clean archive -archivePath $iosArchivePath
    else
      # remove localhost from NSExceptionDomains in Info.plist before building
      /usr/libexec/PlistBuddy -c "Delete NSAppTransportSecurity:NSExceptionDomains:localhost" "$infoPlistPath"
      [ $? -ne 0 ] && return 1;
      xcodebuild -workspace micdrp.xcworkspace -scheme micdrp -configuration Release clean archive -archivePath $iosArchivePath
      [ $? -ne 0 ] && return 1;
      /usr/libexec/PlistBuddy -c "Add NSAppTransportSecurity:NSExceptionDomains:localhost dict" "$infoPlistPath"
      /usr/libexec/PlistBuddy -c "Add NSAppTransportSecurity:NSExceptionDomains:localhost:NSExceptionAllowsInsecureHTTPLoads bool true" "$infoPlistPath"
    fi
      [ $? -ne 0 ] && return 1;

    xcodebuild -exportArchive -archivePath $iosArchivePath -exportPath build/outputs/ipa/$finalFileName.ipa -exportOptionsPlist micdrp/ExportOptions.plist
    [ $? -ne 0 ] && return 1;
  popd > /dev/null

  # Look for a folder in the iOS archives area that has today's date. If not, create it and move the archive there.
  local date=$(date +%Y-%m-%d)
  if [ ! -d ~/Library/Developer/Xcode/Archives/$date ]; then
    mkdir -p ~/Library/Developer/Xcode/Archives/$date
  fi

  cp -r "./ios/$iosArchivePath" ~/Library/Developer/Xcode/Archives/$date/$finalFileName.xcarchive
}

function showBinaryLocations() {
  [ "$buildIos" -eq 1 ] && printf "${blu}iOS archive is located at: ./$clientDir/ios/$iosArchivePath${nc}\n"
  [ "$buildAndroid" -eq 1 ] && printf "${blu}Android AAB file is located at: ./$clientDir/android/$androidFilePath${nc}\n"
}

function uploadBinaries() {
  [ "$buildIos" -eq 1 ] && "./uploadBinaries.sh $(pwd)/ios/$iosArchivePath"
  [ "$buildAndroid" -eq 1 ] && "./uploadBinaries.sh $(pwd)/android/$androidFilePath"
}






#################################
#                               #
#    Bundle build procedure     #
#                               #
#################################

if [ ! -d "$clientDir" ]; then
  printf "Please run from the root 'micdrp' folder...\n"
  exit 0;
fi

cd "$clientDir"

while getopts ":cpsaimMkuhC" option; do
   case $option in
      p)
        isProduction=1
        env='production'
        ;;
      s)
        isStaging=1
        env='staging'
        ;;
      c) # Show the user the current version and what the next version would look like given the args passed
        checkOnly=1
        checkEnvironment
        loadVersionFromCsv # load version numbers from releases.csv file
        computeNextVersion
        displayCurrentVersion
        displayNextVersion
        exit 0;;
      a) buildAndroid=1;;
      i) buildIos=1;;
      m) shouldBumpMinor=1;;
      M) shouldBumpMajor=1;;
      k) keepVersion=1;;
      u) shouldUploadBinaries=1;;
      h) help;;
      C) shouldClean=1;;
     \?) die "Error: Invalid option"; help;;
   esac
done

checkEnvironment
loadVersionFromCsv
computeNextVersion

if [ "$shouldClean" -eq 1 ]; then
  npx react-native clean --include metro,yarn,watchman,android
fi

if [ $? -eq 0 ]; then
  if [ "$buildAndroid" -eq 0 ] && [ "$buildIos" -eq 0 ]; then
    printf "${red}ERROR: ${nc}You must specify the -i (iOS) or -a (Android) command switches\n"
    exit 0;
  fi

  if [[ ! "$env" = 'development' ]]; then
    displayNextVersion true
    printf "[ ] Updating environment with new version numbers...\r"
    updateEnvFiles
    printf "[\xE2\x9C\x94] Updating environment with new version numbers...\n"
  fi

  assembledVersionNumber=$(getNextVersionString)
  finalFileName="micdrp-$env-$assembledVersionNumber-$nextBuildNumber"

  export ENVFILE=".env.$env" # export the env file so that react-native-config can use it internally
  source "$ENVFILE" # source the env file so its values can be used directly within this script

  if [ "$buildAndroid" -eq 1 ]; then
    buildAndroidBinary
    [ $? -ne 0 ] && die "Android build failed. Check the output above."
  fi

  if [ "$buildIos" -eq 1 ]; then
    buildIosBinary
    [ $? -ne 0 ] && die "iOS build failed. Check the output above."
  fi
fi

if [[ ! "$env" = 'development' ]]; then
  [ "$buildAndroid" -eq 1 ] && androidRelease=1
  [ "$buildIos" -eq 1 ] && iOSRelease=1
  saveVersionToFile
fi

printf "\n---------------------------"
printf "\n\t${grn}SUCCESS!${nc}"
printf "\n---------------------------\n"
showBinaryLocations

if [ "$shouldUploadBinaries" -eq 1 ]; then
  printf "\nUploading binaries to stores...\n"
  uploadBinaries 
fi
