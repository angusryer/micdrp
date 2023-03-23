//
//  AudioControlModule.h
//  micdrp
//
//  Created by Angus Ryer on 2023-02-26.
//

// preprocessor directives to avoid the compiler from including this file twice
// https://stackoverflow.com/questions/3246803/why-use-ifndef-class-h-and-define-class-h-in-h-file-but-not-in-cpp/3247093#3247093
#ifndef AudioControlModule_h
#define AudioControlModule_h

#import <React/RCTBridgeModule.h>

@interface AudioControlModule : NSObject <RCTBridgeModule>

@end


#endif /* AudioControlModule_h */
