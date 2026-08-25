//
//  ScreenWakeModule.h
//  micdrp
//
//  Holding the screen awake while a take is being sung (INV-NOTES-138).
//
//  A TurboModule: the interface is declared once in
//  src/specs/NativeScreenWake.ts and this implements it.
//

#ifndef ScreenWakeModule_h
#define ScreenWakeModule_h

#import <AppSpecs/AppSpecs.h>

@interface ScreenWakeModule : NativeScreenWakeSpecBase <NativeScreenWakeSpec>

@end

#endif /* ScreenWakeModule_h */
