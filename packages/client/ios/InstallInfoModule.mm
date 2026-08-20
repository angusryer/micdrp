//
//  InstallInfoModule.mm
//  micdrp
//
//  Reports the App Store receipt's NAME, not whether its file exists.
//
//  This distinction is the whole reason the module exists. On TestFlight,
//  -[NSBundle appStoreReceiptURL] returns a URL ending in "sandboxReceipt"
//  from the first launch, but StoreKit does not necessarily write that file
//  until it refreshes the receipt. Checking the filesystem therefore answers
//  "has the receipt been written", which is not the question the updates
//  domain asks — it asks "what kind of install is this" (INV-UPD-001).
//
//  Builds 6 and 7 both shipped a JavaScript filesystem check and both
//  reported `unknown`, disabling over-the-air updates entirely.
//

#import "InstallInfoModule.h"

@implementation InstallInfoModule

RCT_EXPORT_MODULE()

- (NSString *)getReceiptName
{
  NSURL *receiptURL = NSBundle.mainBundle.appStoreReceiptURL;
  // An empty string rather than nil: the contract is a string, and "no
  // receipt URL at all" is a real answer the caller resolves to unknown.
  return receiptURL.lastPathComponent ?: @"";
}

- (std::shared_ptr<facebook::react::TurboModule>)
    getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeInstallInfoSpecJSI>(params);
}

@end
