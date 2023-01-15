#!/bin/bash
watchman watch-del '/Users/angusryer/dv/micdrp' ; watchman watch-project '/Users/angusryer/dv/micdrp'
echo "Run react-native client tests"
cp -R packages/cms-service-api-constants/lib clients/react-native/node_modules/cms-service-api-constants
cp -R packages/crm-service-api-constants/lib clients/react-native/node_modules/crm-service-api-constants
cp -R packages/machine-service-api-constants/lib clients/react-native/node_modules/machine-service-api-constants
cp -R packages/shared-base/lib clients/react-native/node_modules/shared-base
yarn workspace @micdrp/client test
exit $?