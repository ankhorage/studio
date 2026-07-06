function isWeb(): boolean {
  return typeof window !== 'undefined';
}

export function promptProjectName(defaultName: string): string | null {
  if (isWeb() && typeof window.prompt === 'function') {
    const input = window.prompt('Name your new project:', defaultName);
    return input ?? null;
  }

  return defaultName;
}

export function confirmDelete(name: string): boolean {
  if (isWeb() && typeof window.confirm === 'function') {
    return window.confirm(`Delete ${name}?`);
  }

  return false;
}

export function openProjectUrl(url: string): boolean {
  if (isWeb() && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}
