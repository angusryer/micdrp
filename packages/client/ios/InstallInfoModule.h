//
//  InstallInfoModule.h
//  micdrp
//
//  What kind of install this is, for the updates domain.
//
//  A TurboModule: the interface is declared once in
//  src/specs/NativeInstallInfo.ts, codegen derives NativeInstallInfoSpec from
//  it, and this class implements that protocol.
//

#ifndef InstallInfoModule_h
#define InstallInfoModule_h

#import <AppSpecs/AppSpecs.h>

@interface InstallInfoModule : NativeInstallInfoSpecBase <NativeInstallInfoSpec>

@end

#endif /* InstallInfoModule_h */
