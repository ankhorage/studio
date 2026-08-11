import { expoLocalizationAdminViewContribution } from '@ankhorage/orchestrator-module-expo-localization/admin-view';
import type { ComponentType } from 'react';

type StudioModuleAdminViewExecutor = (operation: string, input?: unknown) => Promise<unknown>;

interface StudioModuleAdminViewProps {
  readonly execute: StudioModuleAdminViewExecutor;
  readonly onProjectChange?: () => Promise<void> | void;
}

export interface StudioModuleAdminViewContribution {
  readonly id: string;
  readonly View: ComponentType<StudioModuleAdminViewProps>;
}

const STUDIO_MODULE_ADMIN_VIEWS = [
  expoLocalizationAdminViewContribution,
] satisfies readonly StudioModuleAdminViewContribution[];

const STUDIO_MODULE_ADMIN_VIEW_REGISTRY = new Map<string, StudioModuleAdminViewContribution>(
  STUDIO_MODULE_ADMIN_VIEWS.map((contribution): [string, StudioModuleAdminViewContribution] => [
    contribution.id,
    contribution,
  ]),
);

export function getStudioModuleAdminView(
  moduleId: string,
): StudioModuleAdminViewContribution | null {
  return STUDIO_MODULE_ADMIN_VIEW_REGISTRY.get(moduleId) ?? null;
}
