export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow non-browser requests (no origin header)
  if (origin === undefined) return true;

  try {
    const url = new URL(origin);

    // Only allow HTTP and HTTPS origins
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Allow localhost and default IPv4/IPv6 loopback hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return true;
    }

    // Check IPv6 addresses: url.hostname includes brackets, e.g. "[fd00::1]"
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      const addr = hostname.slice(1, -1);

      // Allow IPv6 Unique Local Addresses (ULA): fd00::/8
      if (addr.startsWith('fd')) return true;

      // Allow IPv6 link-local addresses: fe80::/10 (covers fe8x, fe9x, feax, febx)
      if (
        addr.startsWith('fe8') ||
        addr.startsWith('fe9') ||
        addr.startsWith('fea') ||
        addr.startsWith('feb')
      ) {
        return true;
      }

      return false;
    }

    // Validate IPv4: must be exactly 4 numeric parts, each in 0-255
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const octets = parts.map((p) => parseInt(p, 10));
      if (octets.every((o) => o >= 0 && o <= 255)) {
        const [o1 = -1, o2 = -1] = octets;

        // 10.0.0.0/8
        if (o1 === 10) return true;

        // 192.168.0.0/16
        if (o1 === 192 && o2 === 168) return true;

        // 172.16.0.0/12 -> 172.16.x.x - 172.31.x.x
        if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
      }
    }

    return false;
  } catch {
    // If origin is not a valid URL, block it for safety
    return false;
  }
}
