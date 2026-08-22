//
//  AudioRouteModule.h
//  micdrp
//
//  What the audio is currently coming out of.
//
//  A TurboModule: the interface is declared once in
//  src/specs/NativeAudioRoute.ts and this implements it.
//

#ifndef AudioRouteModule_h
#define AudioRouteModule_h

#import <AppSpecs/AppSpecs.h>

@interface AudioRouteModule : NativeAudioRouteSpecBase <NativeAudioRouteSpec>

@end

#endif /* AudioRouteModule_h */
