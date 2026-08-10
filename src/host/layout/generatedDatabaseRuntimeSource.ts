import type { GeneratedDatabaseRuntimeSelection } from '../generatedDatabaseRuntime';
import { escapeStringLiteral } from './utils/escapeStringLiteral';

export const GENERATED_DATABASE_ADAPTERS_EXPRESSION = 'GENERATED_DATABASE_ADAPTERS';

export function getGeneratedDatabaseRuntimeImports(
  selection: GeneratedDatabaseRuntimeSelection | null,
): readonly string[] {
  return selection?.provider === 'supabase'
    ? ["import { createSupabaseDbAdapter } from '@ankhorage/supabase-db';"]
    : [];
}

export function getGeneratedDatabaseRuntimeModuleDeclarations(
  selection: GeneratedDatabaseRuntimeSelection | null,
): string {
  if (selection?.provider !== 'supabase') return '';

  const adapterEntries = selection.adapterIds
    .map((id) => `      '${escapeStringLiteral(id)}': generatedSupabaseDbAdapter,`)
    .join('\n');

  return `const generatedSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const generatedSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const generatedSupabaseDbAdapter =
  generatedSupabaseUrl.length > 0 && generatedSupabaseAnonKey.length > 0
    ? createSupabaseDbAdapter({ url: generatedSupabaseUrl, anonKey: generatedSupabaseAnonKey })
    : null;
const GENERATED_DATABASE_ADAPTERS =
  generatedSupabaseDbAdapter === null
    ? {}
    : {
${adapterEntries}
      };`;
}
