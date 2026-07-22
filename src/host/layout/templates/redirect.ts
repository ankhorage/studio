import { escapeStringLiteral } from '../utils/escapeStringLiteral';

export function getIndexRedirectRouteTsx(href: string): string {
  return `import { Redirect } from 'expo-router';

export default function IndexRoute() {
  return <Redirect href={'${escapeStringLiteral(href)}'} />;
}
`;
}
