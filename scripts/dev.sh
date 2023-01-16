#!/bin/bash

# options: -ai (android or ios)
# start server in new terminal window
# start metro in new terminal window
# start android or ios in new terminal window

clientDir=packages/client
env="Development"
androidVersionCode=0
androidVersionName=""
iosVersionNumber=0

if [ ! -d "$clientDir" ]
  then
  printf "Please run from the root 'micdrp' folder...\n"
  exit 0;
fi

if [ ! -z ]
  then
    printf "You must supply at least one argument"
    exit 1;
fi

function help () {
  printf "Usage: ./dev.sh -ai\n"
  printf "Example for starting an Android emulator: ./deb.sh -pa\n"
  printf "  -[ai] (required) Start an Android or iOS virtual device\n"
  printf "  -p|s use a Production or Staging environment\n"
  printf "  -h  This help screen\n"
  exit 0;
}

function getAndroidVersionCode () {
  local androidVersionCode="$(grep -oE "^.\s*versionCode [0-9]+" packages/client/android/app/build.gradle)"
  echo $androidVersionCode;
}

function getAndroidVersionName () {
  local androidVersionName="$(grep -oE "^.\s*versionName \"[0-9]+.+\"" packages/client/android/app/build.gradle)"
  if [ "$?" != "0" ]
    then
    local androidVersionName="$(grep -oE "^.\s*versionName \"$env [0-9]+.+\"" packages/client/android/app/build.gradle)"
  fi
  echo $androidVersionName;
}

echo "";
echo "-------------------";

while getopts ":psaih:" option; do
   case $option in
    h) # print this command's help
      help;;
    p)
      if [ -z == "s" ]
        then
          printf "You must specify only one environment\n"
          exit 0; 
      fi
      printf "[\xE2\x9C\x94] Using Production environment variables\n"
      env="Production"
      export ENVFILE=.prod.env;;
    s)
      printf "[\xE2\x9C\x94] Using Staging environment variables\n"
      env="Production"
      export ENVFILE=.prod.env;;
    a)
      printf "Building Android bundle...\n"
      androidVersionName=$(getAndroidVersionName)
      androidVersionCode=$(getAndroidVersionCode)
      currentAndroidVersionCode=$(echo $androidVersionCode | tr -dc '0-9')
      nextAndroidVersionCode=$((currentAndroidVersionCode+1))
      printf "[ ] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextAndroidVersionCode...\r"
      if [ "$env" == "development" ]
        then
        printf "You must specify a production (-p) or staging (-s) environment\n"
        exit 1;
      fi
      if [ "$androidVersionName" == "" ]
        then
          # couldn't find the vanilla number, assume there is an env in it...
          grep -oE "^.\s*versionName \"[0-9]+.+\"" packages/client/android/app/build.gradle | xargs sed -i "" "s/$androidVersionName/versionName \"$env $nextAndroidVersionCode.0\"/g"
        else 
          grep -oE "^.\s*versionName \"$env [0-9]+.+\"" packages/client/android/app/build.gradle | xargs sed -i "" "s/$androidVersionName/versionName \"$env $nextAndroidVersionCode.0\"/g"
      fi

      sleep 1;
      printf "[\xE2\x9C\x94] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextAndroidVersionCode...\r"

      # Sanity check
      updatedAndroidVersionName=$(grep -oE "^.\s*versionName \"$env $nextAndroidVersionCode.+\"" packages/client/android/app/build.gradle)
      if [ "$updatedAndroidVersionName" == "" ]
        then
          printf "Unable to change Version Name. Looking for '$env $currentAndroidVersionCode' Please double check android/app/build.gradle\n";
          printf "Quitting without modifying the build.gradle\n"
          exit 3;
      fi

      # Update the Version Code, if the Name was successful...
      grep -oErl "^.\s*versionCode [0-9]+" packages/client/android/app/build.gradle | xargs sed -i "" "s/$currentAndroidVersionCode/versionCode $nextAndroidVersionCode/g"

      newVersion=$nextAndroidVersionCode;;
    \?) # Invalid option
      printf "Error: Invalid option"
      exit;;
   esac
done

# ./scripts/server.sh