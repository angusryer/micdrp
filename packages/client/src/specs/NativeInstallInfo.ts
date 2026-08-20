/**
 * Codegen spec for what kind of install this is.
 *
 * One question: what does iOS call this app's App Store receipt. TestFlight
 * says `sandboxReceipt`, the App Store says `receipt`, and a build signed for
 * development says neither.
 *
 * This has to be native. `Bundle.main.appStoreReceiptURL` reports the receipt's
 * *name* whether or not the file has been written yet — and TestFlight often
 * has not written it by first launch. Two builds were spent checking for the
 * file on disk from JavaScript, which is a different question with a different
 * answer (INV-UPD-001).
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * The last path component of the App Store receipt URL, or an empty string
   * when the platform reports no receipt URL at all.
   */
  getReceiptName(): string;
}

/**
 * `get`, never `getEnforcing`. getEnforcing throws at module scope — before
 * any caller's try/catch exists — so a binary without the module takes down
 * everything that imports this, which is how build 8 lost its whole About
 * section. `NativeAudioEngine` in this directory says the same thing.
 */
export default TurboModuleRegistry.get<Spec>('NativeInstallInfo');
