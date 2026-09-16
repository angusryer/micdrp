//
//  AppleSignInModule.mm
//  micdrp
//
//  Shows the Apple sheet and hands back the identity token with the nonce it
//  was issued against. The backend, not this file, decides whether to believe
//  it (INV-ACCOUNT-024): nothing here is trusted beyond carrying the token.
//

#import "AppleSignInModule.h"

#import <AuthenticationServices/AuthenticationServices.h>
#import <CommonCrypto/CommonDigest.h>
#import <Security/SecRandom.h>

@interface AppleSignInModule () <ASAuthorizationControllerDelegate,
                                 ASAuthorizationControllerPresentationContextProviding>
@property (nonatomic, strong) ASAuthorizationController *controller;
@property (nonatomic, copy) NSString *nonce;
@property (nonatomic, copy) RCTPromiseResolveBlock resolve;
@property (nonatomic, copy) RCTPromiseRejectBlock reject;
@end

static NSString *HexString(const unsigned char *bytes, size_t length)
{
  NSMutableString *out = [NSMutableString stringWithCapacity:length * 2];
  for (size_t i = 0; i < length; i++) {
    [out appendFormat:@"%02x", bytes[i]];
  }
  return out;
}

static NSString *RandomNonce(void)
{
  unsigned char bytes[32];
  if (SecRandomCopyBytes(kSecRandomDefault, sizeof(bytes), bytes) != errSecSuccess) {
    return nil;
  }
  return HexString(bytes, sizeof(bytes));
}

static NSString *Sha256(NSString *text)
{
  NSData *data = [text dataUsingEncoding:NSUTF8StringEncoding];
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
  return HexString(digest, CC_SHA256_DIGEST_LENGTH);
}

@implementation AppleSignInModule

RCT_EXPORT_MODULE(NativeAppleSignIn)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSNumber *)isAvailable
{
  return @YES;
}

- (void)signIn:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.controller != nil) {
      reject(@"failed", @"A sign-in is already showing.", nil);
      return;
    }
    NSString *nonce = RandomNonce();
    if (nonce == nil) {
      reject(@"failed", @"Could not make a nonce.", nil);
      return;
    }
    ASAuthorizationAppleIDRequest *request = [[ASAuthorizationAppleIDProvider new] createRequest];
    request.requestedScopes = @[ ASAuthorizationScopeFullName, ASAuthorizationScopeEmail ];
    request.nonce = Sha256(nonce);

    self.nonce = nonce;
    self.resolve = resolve;
    self.reject = reject;
    self.controller = [[ASAuthorizationController alloc] initWithAuthorizationRequests:@[ request ]];
    self.controller.delegate = self;
    self.controller.presentationContextProvider = self;
    [self.controller performRequests];
  });
}

- (void)finish
{
  self.controller = nil;
  self.nonce = nil;
  self.resolve = nil;
  self.reject = nil;
}

- (void)authorizationController:(ASAuthorizationController *)controller
    didCompleteWithAuthorization:(ASAuthorization *)authorization
{
  ASAuthorizationAppleIDCredential *credential = (ASAuthorizationAppleIDCredential *)authorization.credential;
  NSData *tokenData = [credential isKindOfClass:ASAuthorizationAppleIDCredential.class] ? credential.identityToken : nil;
  NSString *token = tokenData ? [[NSString alloc] initWithData:tokenData encoding:NSUTF8StringEncoding] : nil;
  if (token == nil) {
    self.reject(@"failed", @"Apple returned no identity token.", nil);
  } else {
    self.resolve(@{
      @"identityToken" : token,
      @"nonce" : self.nonce,
      @"givenName" : credential.fullName.givenName ?: @"",
      @"familyName" : credential.fullName.familyName ?: @"",
    });
  }
  [self finish];
}

- (void)authorizationController:(ASAuthorizationController *)controller
           didCompleteWithError:(NSError *)error
{
  BOOL cancelled = error.code == ASAuthorizationErrorCanceled;
  self.reject(cancelled ? @"cancelled" : @"failed", error.localizedDescription, error);
  [self finish];
}

- (ASPresentationAnchor)presentationAnchorForAuthorizationController:(ASAuthorizationController *)controller
{
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:UIWindowScene.class]) continue;
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      if (window.isKeyWindow) return window;
    }
  }
  return UIApplication.sharedApplication.delegate.window;
}

- (std::shared_ptr<facebook::react::TurboModule>)
    getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAppleSignInSpecJSI>(params);
}

@end
