#import "AppDelegate.h"

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

/// Where the JS comes from: Metro while debugging, the bundled file otherwise.
- (NSURL *)bundleURL
{
#if DEBUG
  return [RCTBundleURLProvider.sharedSettings jsBundleURLForBundleRoot:@"index"];
#else
  return [NSBundle.mainBundle URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
