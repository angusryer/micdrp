#!/bin/bash

# options: -ai (android or ios)
# start server in new terminal window
# start metro in new terminal window
# start android or ios in new terminal window

DIR=packages/client

if [ ! -d "$DIR" ]
  then
  echo "Please run from the root 'micdrp' folder..."
  exit 0;
fi

help () {
   echo "Usage: ./dev.sh -ai"
   echo "Example for starting an Android emulator: ./deb.sh -a"
   echo "  -h  This help screen"
   echo "  -a  Start an Android emulator"
   echo "  -i  Start an iOS simulator"
   exit 0;
}

echo "";
echo "-------------------";

while getopts ":hai:" option; do
   case $option in
    h) # print this command's help
      help;;
    a) # run an Android emulator
      echo "Running an Android emulator..."
      TMP=`grep -oG "versionCode [0-9][0-9]" packages/client/android/app/build.gradle`
      VN=`grep -oG "versionName \"[0-9][0-9].0\"" packages/client/android/app/build.gradle`
      if [ "$?" != "0" ]
        then
        VN=`grep -oG "versionName \"$ENV [0-9][0-9].0\"" packages/client/android/app/build.gradle`
      fi
      echo "Android version code: '$TMP'"
      echo "Android version name: '$VN'"
      exit 0;;
    \?) # Invalid option
      echo "Error: Invalid option"
      exit;;
   esac
done

# ./scripts/server.sh