/**
 * Which over-the-air bundle produced the behaviour being complained about.
 *
 * Without it a remark cannot be tied to the JavaScript that caused it: the
 * binary stays the same while the bundle under it changes several times a day.
 *
 * The answer belongs to the updates domain, which owns what a bundle is, so
 * this defers rather than asking hot-updater a second time.
 */
export { runningBundle as runningBundleId } from '../updates/bundle';
