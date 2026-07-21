function isWeb(): boolean {
  return typeof window !== 'undefined';
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
