#!/bin/bash

# TODOs
# deploy android and iOS bundles to their respective stores

function deployIosToAppStore () {
  # Upload to app store
  # https://help.apple.com/app-store-connect/#/devb1c185036
  # https://stackoverflow.com/questions/2664885/xcode-build-and-archive-from-command-line

  # Check for an archive that matches the latest version

  pushd packages/client/ios
    # Export
    xcodebuild -exportArchive -archivePath build/outputs/archives/micdrp.xcarchive -exportPath build/outputs/exports/micdrp.ipa -exportOptionsPlist micdrp/exportOptions.plist
    
    # WE MAY NEED THIS FOR DEPLOYMENT:
    # Validate
    # xcrun altool --validate-app -f file -t platform -u username [-p password] [--output-format xml]
    # Upload archive
    # xcrun altool --upload-package -f file -t platform -u username [-p password] [—output-format xml]
  popd
  return 0;
}