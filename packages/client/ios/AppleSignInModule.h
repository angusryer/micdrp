//
//  AppleSignInModule.h
//  micdrp
//
//  Sign in with Apple for the account domain. The interface is declared once
//  in src/specs/NativeAppleSignIn.ts; codegen derives NativeAppleSignInSpec.
//

#ifndef AppleSignInModule_h
#define AppleSignInModule_h

#import <AppSpecs/AppSpecs.h>

@interface AppleSignInModule : NativeAppleSignInSpecBase <NativeAppleSignInSpec>

@end

#endif /* AppleSignInModule_h */
