#!/bin/bash

# command line options:
# -p production
# -s staging
# development ENV is default
# 
# get production, staging or development options from command line
# store appropriate ENV file
# increment build and/or version numbers for both iOS and Android
# run build
# output locations

  # a)
    #   printf "Starting Android emulator...\n"
    #   androidVersionName=$(getAndroidVersionName)
    #   androidVersionCode=$(getAndroidVersionCode)
    #   currentAndroidVersionCode=$(echo $androidVersionCode | tr -dc '0-9')
    #   nextAndroidVersionCode=$((currentAndroidVersionCode+1))
    #   printf "[ ] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextAndroidVersionCode...\r"
    #   if [ "$env" == "development" ]
    #     then
    #     printf "You must specify a Production (-p) or Preview (-s) environment\n"
    #     exit 1;
    #   fi
    #   if [ "$androidVersionName" == "" ]
    #     then
    #       # couldn't find the vanilla number, assume there is an env in it...
    #       grep -oE "^.\s*versionName \"[0-9]+.+\"" packages/client/android/app/build.gradle | xargs sed -i "" "s/$androidVersionName/versionName \"$env $nextAndroidVersionCode.0\"/g"
    #     else 
    #       grep -oE "^.\s*versionName \"$env [0-9]+.+\"" packages/client/android/app/build.gradle | xargs sed -i "" "s/$androidVersionName/versionName \"$env $nextAndroidVersionCode.0\"/g"
    #   fi

    #   sleep 1
    #   printf "[\xE2\x9C\x94] Attempting to change Android build.gradle version from $currentAndroidVersionCode to $nextAndroidVersionCode...\r"

    #   # Sanity check
    #   updatedAndroidVersionName=$(grep -oE "^.\s*versionName \"$env $nextAndroidVersionCode.+\"" packages/client/android/app/build.gradle)
    #   if [ "$updatedAndroidVersionName" == "" ]
    #     then
    #       printf "Unable to change Version Name. Looking for '$env $currentAndroidVersionCode' Please double check android/app/build.gradle\n"
    #       printf "Quitting without modifying the build.gradle\n"
    #       exit 3;
    #   fi

    #   # Update the Version Code, if the Name was successful...
    #   grep -oErl "^.\s*versionCode [0-9]+" packages/client/android/app/build.gradle | xargs sed -i "" "s/$currentAndroidVersionCode/versionCode $nextAndroidVersionCode/g"
    #   newVersion=$nextAndroidVersionCode;;
    
    # i)
    #   printf "Running iOS simulator...\n";;
