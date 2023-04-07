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
metroPort=8081

debug=0
switchingEnvs=0
startTask=

isFailing=0
failIos=
failAndroid=

if [ ! -d "$clientDir" ]
  then
  printf "Please run from the root 'micdrp' folder...\n"
  exit 0;
fi

function help () {
  printf "\nExample for starting an Android emulator with staging environment: ./run.sh -sa\n"
  printf "    -i run an iOS simulator\n"
  printf "    -a run an Android emulator\n"
  printf "    -s Run using staging environment\n"
  printf "    -p Run using production environment\n"
  printf "    -c Clean all caches before run\n"
  printf "    -d Show command output for debugging\n"
  printf "    -h This help screen\n\n"
  exit 0;
}

function showPostLaunchHelp() {
  printf "\nHaving issues with this launch?\n"
  printf "\t- App not updating when you make code changes? Make sure you're in development and run this command again with the -c switch to clear metro's cache\n"
  printf "\t- If the app appears to be unresponsive, close and re-open it. If that doesn't help, turn the device or emulator off and on again with the power button.\n"
  printf "\t- If you cannot find the emulator on your desktop, check if you have a physical device plugged in. It may be launched on that.\n"
  printf "\n"
}

function start() {
  startTask="$1"
  printf "[ ] $1...\r"
}

# arg1: int: 0 - do nothing/success, 1 - set isFailing, 2 - warn
# arg2: optional message to append to status
function stop() {
  local lastReturn=$?
  if [ "$lastReturn" -ne 0 ]; then # FAIL or WARN
    if [ ! -z "$1" ]; then # 0 (success), 1 (fail), 2 (non-critical fail)
      if [ "$1" -eq 1 ]; then # we set this to signal that this was a critical task failure and therefore skip future commands and fail gracefully
        isFailing=1
        if [ ! -z "$2" ]; then
          printf "[${red}\xE2\x9C\x96${nc}] $startTask... ${red}$2.${nc}\n"
        else
          printf "[${red}\xE2\x9C\x96${nc}] $startTask... ${red}FAIL.${nc}\n"
        fi
      elif [ "$1" -eq 2 ]; then
        if [ ! -z "$2" ]; then
          printf "[${yel}-${nc}] $startTask... ${yel}$2.${nc}\n"
        else 
          printf "[${yel}-${nc}] $startTask... ${yel}WARN.${nc}\n"
        fi
      fi
    fi
  else # SUCCESS
    printf "[${grn}\xE2\x9C\x94${nc}] $startTask... ${grn}Success.${nc}\n"
  fi
  return $lastReturn;
}

function die () {
  printf "${red}ERROR:${nc} %s \n" "$*"
  exit 1;
}

function doTask() {
  local _pid="$1"
  local delay=0.1
  local spinstr='◜◝◞◟'
  while kill -0 "$_pid" >/dev/null 2>&1; do
    local temp=${spinstr#?}
    printf '[%s] %s\r' "${temp:0:1}" "$startTask"
    spinstr=$temp${spinstr%"$temp"}
    sleep $delay
  done
  wait $_pid
  stop $2
}

function checkEnvironment() {
  if [ "$isProduction" -eq 1 ] && [ "$isStaging" -eq 1 ]; then die "Cannot specify both -p and -s"; fi
  if [ "$runAndroid" -eq 0 ] && [ "$runIos" -eq 0 ]; then die "Must specify one or both of -a or -i"; fi
}

metroPid=
function startMetro () {
  local pid=$(lsof -ti :$metroPort) > /dev/null
  [[ -n $pid ]] && sudo kill -9 $pid > /dev/null
  start "Starting metro if it is not running already"
    osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && yarn workspace client start\"" > /dev/null
  stop 0
  [ "$?" -eq 0 ] && printf "${blu}Metro is running on PID $! and on port $metroPort${nc}"
}

function startDevice() {
  local lowerCase=$(echo "$1" | awk '{print tolower($0)}')
  start "$1 | Starting up mobile client"
  if [ "$debug" -eq 1 ]; then 
    if [[ "$env" = 'dev' ]]; then
      yarn run $lowerCase &
      doTask $! 1;
    else
      yarn run $lowerCase:$env &
      doTask $! 1;
    fi
  else
    if [[ "$env" = 'dev' ]]; then
      yarn run $lowerCase > /dev/null 2>&1 &
      doTask $! 1;
    else
      yarn run $lowerCase:$env > /dev/null 2>&1 &
      doTask $! 1;
    fi
  fi
}

function displaySuccess() {
  printf "\n---------------------------"
  printf "\n\t${grn}SUCCESS!${nc}"
  printf "\n---------------------------\n"
}

function displayFailure() {
  printf "\n---------------------------"
  printf "\n\t   ${red}FAIL${nc}"
  printf "\n---------------------------\n"
  [ $debug -eq 0 ] && printf "\nRe-run this command with the -d flag to see debugging output\n"
}






#################################
#                               #
#         Run procedure         #
#                               #
#################################

# Colons before the first arg makes the script store the first option in the 'optionstring'
# into OPTARG. Subsequent colons make the script anticipate there being parameter strings 
# after the associated optionstring
while getopts ':psaeicdh' option; do
  case $option in
    p) isProduction=1
      env='production'
      ;;
    s) isStaging=1
      env='staging'
      ;;
    a) runAndroid=1;;
    e) switchingEnvs=1;;
    i) runIos=1;;
    c) shouldClean=1;;
    d) debug=1;;
    h) help;;
    \?) die 'Invalid option';;
  esac
done

clear
checkEnvironment
export ENVFILE=".env.$env"
source "$clientDir/.env.$env"

if [ "$shouldClean" -eq 1 ]; then
  pushd packages/client > /dev/null
    npx react-native clean --include metro,yarn,watchman,android
  popd > /dev/null
fi

start "Using $env environment"; stop 0;

if [[ "$env" = 'development' ]]; then
  start "Starting backend services"
    osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && yarn workspace server start\"" > /dev/null # long-running process
  stop 0
fi

if [ "$runAndroid" -eq 1 ]; then
  if [ "$switchingEnvs" -eq 1 ]; then
    start "Removing previously installed Android apps"
    if [ "$debug" -eq 1 ]; then
      adb uninstall com.micdrp
      stop 0
    else
      adb uninstall com.micdrp > /dev/null 2>&1
      stop 0
    fi
  else
    printf "${blu}*** Android-only: If you are switching environments, please cancel this command and re-run with the -e flag ***${nc}\n"
  fi
  start "Starting up Android client"
  if [ "$debug" -eq 1 ]; then
    yarn workspace client android:$env &
    doTask $! 1;
  else
    yarn workspace client android:$env > /dev/null 2>&1
    doTask $! 1;
  fi
  [ "$?" -ne 0 ] && failAndroid='Launching Android failed. If you are switching environments, use the -e flag. If that does not work, run with -d for debug output.'
fi

# A bug where Android will launch a properly connected metro instance that iOS
# can connect to, but when we only launch iOS, the metro console that is launched
# doesn't receive the HMR functionality. We have to start it ourselves within the
# same context that we're running the app.
# if [ "$runAndroid" -eq 0 ]; then
#   start "Starting metro if not started already"
#     startMetro
#   stop 0
# fi

if [ "$runIos" -eq 1 ]; then
  bootedDevices=$(xcrun simctl list | grep 'Booted')
  if [ -z "$bootedDevices" ]; then
    start "Stopping existing iOS simulators"
    if [ "$debug" -eq 1 ]; then
      xcrun simctl shutdown all # shut down any possibly running simulators
      stop 0
    else
      xcrun simctl shutdown all > /dev/null 2>&1 # shut down any possibly running simulators
      stop 0
    fi
  fi
  start "Starting up iOS client"
    if [ "$debug" -eq 1 ]; then
      yarn workspace client ios:$env &
      doTask $! 1;
    else
      yarn workspace client ios:$env > /dev/null 2>&1 &
      doTask $! 1;
    fi
  [ "$?" -ne 0 ] && failIos='Launching iOS failed. Run with -d for debug output.'
fi

if [ "$isFailing" -eq 1 ]; then
  displayFailure
  [[ ! -z "$failIos" ]] && printf "$failIos\n"
  [[ ! -z "$failAndroid" ]] && printf "$failAndroid\n"
  exit 1;
else
  displaySuccess
  showPostLaunchHelp
fi