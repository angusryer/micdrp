//
//  HapticsModule.h
//  micdrp
//
//  A tick against the fingertip, for the moment a gesture takes hold.
//
//  A TurboModule: the interface is declared once in src/specs/NativeHaptics.ts
//  and this implements it.
//

#ifndef HapticsModule_h
#define HapticsModule_h

#import <AppSpecs/AppSpecs.h>

@interface HapticsModule : NativeHapticsSpecBase <NativeHapticsSpec>

@end

#endif /* HapticsModule_h */
