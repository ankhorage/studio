import { escapeStringLiteral } from '../utils/escapeStringLiteral';

export function getIndexRedirectRouteTsx(href: string): string {
  return `/**
 * The root layout owns auth bootstrap and canonicalizes / to '${escapeStringLiteral(href)}'.
 * This route only keeps / matchable without creating synthetic navigation history.
 */
export default function IndexRoute() {
  return null;
}
`;
}
