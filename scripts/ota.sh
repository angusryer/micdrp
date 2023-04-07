#!/bin/bash

# NOTES:
# I'm not sure what the `clear` command does since the release history is immutable.
# Clear release history: appcenter codepush deployment clear -a ILiv/<appName> <deploymentName> ($env)
# 
# ROLLING BACK:
# NOTE: We cannot roll back to a different app version number (ie. 1.1.7 to 1.1.6). In this case, we would
# have to revert our local git changes to a working status, and release that as a new OTA update.
#
# Rolling back to the previous release:
# appcenter codepush rollback -a ILiv/iOS production
#
# Rolling back to a target release version. The version name must match one of the previous releases _exactly_
# appcenter codepush rollback -a ILiv/Android staging --target-release v2
#
# PROMOTING:
# Because OTA updates consist entirely of JS code (and static assets) that do not contain static references to
# deployment keys, we are able to promote OTA releases from staging to production since the devices that have
# these build variants installed will have the target deployment key built into the native code. This means
# they'll receive the promoted OTA updates immediately.
#
# appcenter codepush promote -a <ownerName>/<appName> -s <sourceDeploymentName> -d <destDeploymentName> -t <targetBinaryVersion> --description <description>

# TODO Implement command switches to identify which rollback strategy to employ,
# + to make rollbacks and promotions create an entry in the releases.csv file.

#########################################
#                                       #
#   Function and variable definitions   #
#                                       #
#########################################

target='' # semver compliant string, e.g. 1.0.0
build= # integer
env='' # staging, production
envFile=''
isProduction=0
isStaging=0
shouldUpdateAndroid=0
androidAppName='micdrp/android'
iosAppName='micdrp/ios'
shouldUpdateIos=0
mandatory=0 # "" or "-m"
build=0
updateLocation=''
checkOnly=0

version=
buildNumber=
releaseVariant=
androidRelease=0
iOSRelease=0

storedAndroidOtaStr=''
nextAndroidOtaStr=''

storedIosOtaStr=''
nextIosOtaStr=''

history=
storedOtaStr=''
storedOtaNum=0
nextOtaStr=''
nextOtaNum=0

releasesCsv="./releases.csv"

red='\033[0;31m'
grn='\033[0;32m'
yel='\033[0;93m'
blu='\033[0;94m'
nc='\033[0m' # No Color

startDir="clients/react-native"

function help () {
   printf "Usage: ./ota.sh -ps -ai [-b] [-m] [-t <version>]\n"
   printf "Example: push a mandatory OTA update to the latest production version of Android: ./ota.sh -pam\n"
   printf "  -b  Run \`yarn build\` prior to building the client bundle\n"
   printf "  -c  Display the latest version to target\n"
   printf "  -p  Point to production (use .env.prod)\n"
   printf "  -s  Point to staging (use .env.staging)\n"
   printf "  -a  Push update to Android devices\n"
   printf "  -i  Push update to iOS devices\n"
   printf "  -m  Set whether this is a mandatory update\n"
   printf "  -t  Version number of devices to push update to/target (defaults to latest version from releases.csv)\n"
   printf "  -h  This help screen\n"
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

function displayTargetInfo() {
  local platformString=''
  [ "$shouldUpdateAndroid" -eq 1 ] && platformString+='Android '
  [ "$shouldUpdateIos" -eq 1 ] && platformString+='iOS '
  printf "\nPlatform: $platformString\n"
  printf "Environment: "$env"\n"
  printf "Targeting devices running version: "$target"\n\n"
}

function loadVersionFromCsv() {
  if [ ! -f "$releasesCsv" ]; then
    # The file does not exist, so create it with headers
    echo "Version,Build,Variant,AndroidRelease,iOSRelease,OtaAndroid,OtaIos,Date,Time" > "$releasesCsv"
  fi
  local latestRow=$(awk -F ',' -v env="$env" '$3 == env {latest=$0}END{print latest}' "$releasesCsv")
  version=$(echo "$latestRow" | awk -F',' '{print $1}')
  buildNumber=$(echo "$latestRow" | awk -F',' '{print $2}')
  releaseVariant=$(echo "$latestRow" | awk -F',' '{print $3}')
  androidRelease=$(echo "$latestRow" | awk -F',' '{print $4}')
  iOSRelease=$(echo "$latestRow" | awk -F',' '{print $5}')
  storedAndroidOtaStr=$(echo "$latestRow" | awk -F',' '{print $6}')
  storedIosOtaStr=$(echo "$latestRow" | awk -F',' '{print $7}')
  dateStamp=$(echo "$latestRow" | awk -F',' '{print $8}')
  timeStamp=$(echo "$latestRow" | awk -F',' '{print $9}')
}

# Stores the version, build, variant and OTA version information to our CSV file
function saveVersionsToFile() {
  echo "$version,$buildNumber,$env,$androidRelease,$iOSRelease,$nextAndroidOtaStr,$nextIosOtaStr,$(date +%Y-%m-%d),$(date +%H:%M:%S)" >> "$releasesCsv"
}

function displayHistoryAndVerifyOtaVersion() {
  # Ready initial variables for possible user modification
  if [[ "$1" = "Android" ]]; then
    storedOtaStr="$storedAndroidOtaStr"
    storedOtaNum=$(echo "$storedAndroidOtaStr" | tr -d 'v') # remove the 'v'
  fi

  if [[ "$1" = "iOS" ]]; then
    storedOtaStr="$storedIosOtaStr"
    storedOtaNum=$(echo "$storedIosOtaStr" | tr -d 'v') # remove the 'v'
  fi

  if [[ "$storedOtaStr" = '' ]]; then
    storedOtaStr='n/a'
    storedOtaNum=0 # if blank, replace with 0
  fi
  
  nextOtaNum=$(($storedOtaNum+1)) # create initial nextOtaNum
  nextOtaStr="v$nextOtaNum" # create initial nextOtaStr

  # Display the table that App Center sends back to us and ask the user to double check
  printf "\n\n${blu}$1 OTA history:${nc}\n"
  echo "$history"
  printf "\n\n${blu}Double check that the HIGHEST version (v##) listed at the bottom of the list above is the same as the one suggested below${nc}.\n"
  printf "${blu}Suggested latest OTA version: $storedOtaStr${nc}.\n\n"
  
  read -p "Hit 'enter' to accept $storedOtaStr, or type in the latest: " input

  [[ "$input" = '' ]] && input="$storedOtaNum" # User hit ENTER, so use the initial value set above
  [[ ! "$input" = '' ]] && input="${input//[^[:digit:]]/}" # User typed something in, so remove letters and use their number
  
  if [[ "$1" = 'Android' ]]; then
    nextAndroidOtaStr="v$((input))"
  elif [[ "$1" = 'iOS' ]]; then
    nextIosOtaStr="v$((input))"
  fi
}

function computeNextAndroidVersion() {
  history=$(appcenter codepush deployment history -a "$androidAppName" "$env")
  displayHistoryAndVerifyOtaVersion 'Android'
}

function computeNextIosVersion() {
  history=$(appcenter codepush deployment history -a "$iosAppName" "$env")
  displayHistoryAndVerifyOtaVersion 'iOS'
}

function displayCurrentVersion() {
  local otaAndroidString="$storedAndroidOtaStr"
  local otaIosString="$storedIosOtaStr"
  [[ "$storedAndroidOtaStr" = "" ]] && otaAndroidString='No Android OTA updates'
  [[ "$storedIosOtaStr" = "" ]] && otaIosString='No iOS OTA updates'
  printf "Latest version: $version ($buildNumber), $releaseVariant, Android: $otaAndroidString, iOS: $otaIosString\n"
}

function buildProject() {
  pushd ../../ > /dev/null
    yarn build
  popd > /dev/null
}

function prepareIos() {
  updateLocation="$(pwd)/ios/ota"
  eval "$cleanCommand"
  mkdir "$updateLocation" > /dev/null
  ENVFILE=$envFile npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output "$updateLocation/main.jsbundle" --assets-dest "$updateLocation"
  [ $? -ne 0 ] && die "iOS update preparation failed"
}

function prepareAndroid() {
  updateLocation="$(pwd)/android/ota"
  mkdir -p "$updateLocation/assets" > /dev/null
  eval "$cleanCommand,android"
  cd android
    ./gradlew clean
  cd ..
  ENVFILE=$envFile npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output "$updateLocation/index.android.bundle" --assets-dest "$updateLocation"
  [ $? -ne 0 ] &&  die "Failed to prepare Android bundle"
}

function releaseAndroidUpdate() {
  if [ "$shouldUpdateAndroid" -eq 1 ]; then
    local commandString="appcenter codepush release -a "$androidAppName" -t "$target" -d "$env" -c "$updateLocation""
    if [ "$mandatory" -eq 1 ]; then
      eval "$commandString -m"
    else
      eval "$commandString"
    fi
    [ $? -ne 0 ] && die "Android upload failed" 
    printf "${grn}SUCCESS updating Android!${nc}\n"
  fi
}

function releaseIosUpdate() {
  if [ "$shouldUpdateIos" -eq 1 ]; then
    local commandString="appcenter codepush release -a "$iosAppName" -t "$target" -d "$env" -c "$updateLocation""
    if [ "$mandatory" -eq 1 ]; then
      eval "$commandString -m"
    else
      eval "$commandString"
    fi
    [ $? -ne 0 ] && die "iOS upload failed"
    printf "${grn}SUCCESS updating iOS!${nc}\n"
  fi
}





#################################
#                               #
#      OTA Update procedure     #
#                               #
#################################

if [ ! -d "$startDir" ]; then
  printf "Please run from the root 'Best_Life' folder.\n"
  exit 0;
fi

cd "$startDir"

while getopts ':cpsaimbt:h' option; do
  case $option in
    p)
      isProduction=1
      env='production'
      ;;
    s)
      isStaging=1
      env='staging'
      ;;
    a) shouldUpdateAndroid=1;;
    i) shouldUpdateIos=1;;
    c) checkOnly=1;;
    m) mandatory=1;;
    b) build=1;;
    t) target=$OPTARG;;
    h) help;;
    \?) die "Invalid option(s) passed"
  esac
done

checkEnvironment
export ENVFILE=".env.$env"
source "$ENVFILE"
loadVersionFromCsv

if [ "$build" -eq 1 ] && [ "$checkOnly" -ne 1 ]; then buildProject; fi
cleanCommand="npx react-native clean --include metro,yarn,watchman"

if [ "$shouldUpdateAndroid" -eq 0 ] && [ "$shouldUpdateIos" -eq 0 ]; then
  die "No platform was specified"
fi

[[ "$target" = "" ]] && target="$version"
displayCurrentVersion
displayTargetInfo

if [ "$shouldUpdateAndroid" -eq 1 ]; then
  if [ "$checkOnly" -ne 1 ]; then
    prepareAndroid
    releaseAndroidUpdate
    rm -rdf $updateLocation > /dev/null
  fi
fi

if [ "$shouldUpdateIos" -eq 1 ]; then
  if [ "$checkOnly" -ne 1 ]; then
    prepareIos 
    releaseIosUpdate
    rm -rdf $updateLocation > /dev/null
  fi
fi

# Update the releases.csv file with the latest OTA versions
if [ "$shouldUpdateAndroid" -eq 1 ]; then
  computeNextAndroidVersion
fi
if [ "$shouldUpdateIos" -eq 1 ]; then
  computeNextIosVersion
fi
if [ "$checkOnly" -ne 1 ]; then saveVersionsToFile; fi
[ $? -ne 0 ] && die "Failed to process the releases file."

printf "\n---------------------------"
printf "\n\t${grn}SUCCESS!${nc}"
printf "\n---------------------------\n"

exit 0;
