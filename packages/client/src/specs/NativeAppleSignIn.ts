/**
 * Codegen spec for Sign in with Apple (INV-ACCOUNT-024, 027).
 *
 * Native because the Apple sheet is AuthenticationServices and nothing else.
 * The nonce is made and hashed natively too: the JavaScript runtime has no
 * secure random source and no SHA-256, and the backend checks that the token
 * carries the hash of the nonce the app hands it beside the token.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type AppleCredential = {
  /** Apple's signed identity token (a JWT). */
  identityToken: string;
  /** The nonce whose SHA-256 the token carries. */
  nonce: string;
  /** Shared only on the first sign-in with this app; empty otherwise. */
  givenName: string;
  familyName: string;
};

export interface Spec extends TurboModule {
  /** Whether this device can show the Apple sheet. */
  isAvailable(): boolean;
  /**
   * Show the Apple sheet. Rejects with code `cancelled` when the person
   * dismisses it, and with `failed` for anything else.
   */
  signIn(): Promise<AppleCredential>;
}

/** `get`, never `getEnforcing`: an older binary has no such module (INV-ACCOUNT-027). */
export default TurboModuleRegistry.get<Spec>('NativeAppleSignIn');
