/*** Public headless APM owner extension for the exact installed Studio artifact.
 *
 * Inspect and plan are read-only. Generated package policy uses the same pure transformation as
 * initial authoring; only reviewed Studio-owned JSON fields are materialized, in order. Missing
 * package state is unknown and cannot produce a successful empty plan. Node consumers do not
 * import Studio UI, React, Expo or native peer code through this entrypoint.
 *
 * Supported stored-state history is explicitly declared in apm/update.json. Older unreviewed
 * versions are unsupported, not automatically treated as migration-free. APM updates project
 * sources; deployment, OTA eligibility, native builds and stores are separate follow-up work.
 *
 * Producers run test:apm and the Devtools packed-release gate after Changesets versioning; the
 * exact validated archive is published. The cold packed-host acceptance also imports and verifies
 * this owner under native Node with UI/native imports prohibited.
 * @readme
 */
export { studioUpdateExtension as default } from './features/project-updates/adapters/inbound/studioUpdateExtension.js';
