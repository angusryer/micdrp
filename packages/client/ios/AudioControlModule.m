//
//  AudioControlModule.m
//  micdrp
//
//  Created by Angus Ryer on 2023-02-26.
//

#import <Foundation/Foundation.h>
#import <React/RCTLog.h>
#import "AudioControlModule.h"

@implementation AudioControlModule

RCT_EXPORT_MODULE(AudioControlModule);

RCT_EXPORT_METHOD(testLog: (NSString *)message
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  RCTLogInfo(@"@%-@SUCCESS from iOS!", message);
  if (message) {
    NSString* testString;
    testString = [NSString stringWithFormat:@"%@%@", message , @"--SUCCESS from iOS!"];
    resolve(testString);
  } else {
    reject(@"test_failure", @"no message returned", nil);
  }
}

@end
