#!/bin/bash

###
### https://devhints.io/bash
###

clientDir=packages/client
env="dev"
androidVersionCode=0
androidVersionName=""
iosVersionNumber=0
metroPort=9000

if [ ! -d "$clientDir" ]
  then
  printf "Please run from the root 'micdrp' folder...\n"
  exit 0;
fi

function help () {
  printf "Example for starting an Android emulator with Staging environment: ./dev.sh -s android\n"
  printf "    ios, android, all -[required] Start an Android and/or iOS virtual device(s)\n"
  printf "    -e [dev|staging|prod] -[optional] Use a Production, Staging or Development environment. Development is default.\n"
  printf "    -h This help screen\n"
  exit 0;
}

function die () {
  printf '\n%s\n\n' "$*" >&2
  exit 1
}

metroPid=
function startMetro () {
  local pid=$(lsof -ti :$metroPort)
  [[ -n $pid ]] && kill -9 $pid
  yarn workspace client start &
  printf "\n\nMetro is running on PID $! and on port $metroPort\n\n"
  exit 0;
}

if [ $# -gt 3 ]; then
  printf "Too many arguments specified\n"
  exit 1;
fi

device=
for var in "$@"; do
  [[ $var = 'ios' ]] && device="ios"
  [[ $var = 'android' ]] && device="android"
  [[ $var = 'all' ]] && device="all"
done

if [[ -z $device ]]; then
  die "You must specify either ios, android or all"
fi

# Colons before the first arg makes the script store the first option in the 'optionstring'
# into OPTARG. Subsequent colons make the script anticipate there being parameter strings 
# after the associated optionstring
while getopts ':e:h' option; do
  case $option in
    e) # specify an environment; default is "development"

      if [[ $OPTARG = "staging" ]] || [[ $OPTARG = "prod" ]]; then
        env=$OPTARG
      fi

      case $env in
        prod)
          printf "[\xE2\x9C\x94] Using Production environment variables\n"
          export ENVFILE=.env.production

          printf "Starting Metro...\n"
          startMetro &

          if [[ $device = 'all' ]]; then
            printf "Starting up ios and android clients..."
            yarn workspace client android &
            yarn workspace client ios &
          else 
            printf "Starting up an $device client..."
            yarn workspace client $device &
          fi

        ;;
        staging)
          printf "[\xE2\x9C\x94] Using Staging environment variables\n"
          export ENVFILE=.env.staging

          printf "Starting Metro...\n"
          startMetro &

          if [[ $device = 'all' ]]; then
            printf "Starting up ios and android clients..."
            yarn workspace client android &
            yarn workspace client ios &
          else 
            printf "Starting up an $device client..."
            yarn workspace client $device &
          fi
        
        ;;
        dev)
          if [[ $OPTARG != "dev" ]]; then
            printf "You must specify dev, staging or prod with the -e option\n"
            exit 1
          fi

          printf "[\xE2\x9C\x94] Using Development environment variables\n"
          export ENVFILE=.env

          printf "Starting up backend services..."
          yarn workspace server start &

          printf "Starting Metro...\n"
          startMetro &

          if [[ $device = 'all' ]]; then
            printf "Starting up ios and android clients..."
            yarn workspace client android &
            yarn workspace client ios &
          else 
            printf "Starting up an $device client..."
            yarn workspace client $device &
          fi
        
        ;;
      esac;;
    h) # print this command's help
      help;;
    
    \?) # Invalid option
      printf "\nError: Invalid option\n\n"
      help
      exit 1;;
  esac
done
