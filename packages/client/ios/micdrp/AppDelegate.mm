#import "AppDelegate.h"

#import <HotUpdater/HotUpdater.h>
#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"micdrp";
  self.initialProps = @{};

  // Under the New Architecture the autolinked module list is generated at pod
  // install time and handed to the factory through this provider. Without it
  // no third-party native module registers.
  self.dependencyProvider = [RCTAppDependencyProvider new];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

/// Where the JS comes from: Metro while debugging, otherwise whichever bundle
/// the updater considers current.
///
/// `+[HotUpdater bundleURL]` falls back to the `main.jsbundle` compiled into
/// the app whenever no over-the-air bundle has been applied, or when the last
/// one failed to boot and was rolled back — so this is the same answer as
/// before on a fresh install, and the only place the swap can happen. See the
/// `updates` domain spec; INV-UPD-005 depends on nothing else here changing.
- (NSURL *)bundleURL
{
#if DEBUG
  return [RCTBundleURLProvider.sharedSettings jsBundleURLForBundleRoot:@"index"];
#else
  return [HotUpdater bundleURL];
#endif
}

@end
