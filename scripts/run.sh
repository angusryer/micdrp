#!/bin/bash

###
### https://devhints.io/bash
###

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

clientDir=packages/client
env='development'
isProduction=0
isStaging=0
runAndroid=0
runIos=0
shouldClean=0
metroPort=9000

if [ ! -d "$clientDir" ]
  then
  printf "Please run from the root 'micdrp' folder...\n"
  exit 0;
fi

function help () {
  printf "\nExample for starting an Android emulator with staging environment: ./run.sh -sa\n"
  printf "    -i run an iOS simulator\n"
  printf "    -a run an Android emulator\n"
  printf "    -s Run using staging environment settings\n"
  printf "    -p Run using production environment settings\n"
  printf "    -c Clean all caches before run\n"
  printf "    -h This help screen\n\n"
  exit 0;
}

function die () {
  printf "\n${red}ERROR:${nc} %s\n\n" "$*"
  exit 1;
}

function checkEnvironment() {
  if [ "$isProduction" -eq 1 ] && [ "$isStaging" -eq 1 ]; then die "Cannot specify both -p and -s"; fi
  if [ "$runAndroid" -eq 0 ] && [ "$runIos" -eq 0 ]; then die "Must specify one or both of -a or -i"; fi
}

metroPid=
function startMetro () {
  local pid=$(lsof -ti :$metroPort) > /dev/null
  [[ -n $pid ]] && sudo kill -9 $pid > /dev/null
  yarn workspace client start &
  printf "\n\n${blu}Metro is running on PID $! and on port $metroPort${nc}\n\n"
}

# Colons before the first arg makes the script store the first option in the 'optionstring'
# into OPTARG. Subsequent colons make the script anticipate there being parameter strings 
# after the associated optionstring
while getopts ':psaic' option; do
  case $option in
    p) isProduction=1
      env="production"
      ;;
    s) isStaging=1
      env="staging"
      ;;
    a) runAndroid=1;;
    i) runIos=1;;
    c) shouldClean=1;;
    h) help;;
    \?) die "Invalid option";;
  esac
done






#################################
#                               #
#         Run procedure         #
#                               #
#################################

if [ "$shouldClean" -eq 1 ]; then
  pushd packages/client > /dev/null
    eval "$cleanCommand,android"
  popd > /dev/null
fi

checkEnvironment
export ENVFILE=".env.$env"
source "$clientDir/.env.$env"

cleanCommand="npx react-native clean --include metro,yarn,watchman"
startMetro

printf "\n[\xE2\x9C\x94] Using $env environment...\n\n"

if [[ "$env" = 'development' ]]; then
  printf "Starting up backend services...\n"
  yarn workspace server start &
fi

if [ "$runIos" -eq 1 ]; then
  printf "Starting up iOS client...\n"
  yarn workspace client ios:$env &
fi

if [ "$runAndroid" -eq 1 ]; then
  printf "Starting up Android client...\n"
  adb uninstall com.micdrp
  yarn workspace client android:$env &
fi
