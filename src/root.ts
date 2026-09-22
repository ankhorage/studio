/***
 * Package root entrypoint. Intentionally contains exports only; implementation belongs to app, domain, adapter, and UI owner modules.
 */
export {
  CreateCategoriesScreen,
  CreateCategoryTemplatesScreen,
  CreateProjectFromTemplateScreen,
  ProjectDetailScreen,
  ProjectsOverviewScreen,
  StudioApp,
} from './app/index.js';
export { useStudio } from './core/StudioContext.js';
export { StudioProvider } from './core/StudioProvider.js';
export { StudioAdminAccessGate } from './features/administration/adapters/inbound/StudioAdminAccessGate.js';
export { useStudioAdminWorkspace } from './features/administration/adapters/inbound/useStudioAdminWorkspace.js';
export * from './index.js';
export * from './projectAuthHealth.js';
export * from './projectSecretUsage.js';
export * from './secretResponseGuard.js';
export { AnkhAdminPage } from './ui/admin/AnkhAdminPage.js';
export { AnkhStudio } from './ui/AnkhStudio.js';
export { useStudioAppBarAugmentation } from './ui/useStudioAppBarAugmentation.js';
