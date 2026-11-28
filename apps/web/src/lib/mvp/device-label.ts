export function detectDeviceNameFromUserAgent(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Browser';
}

export function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  return detectDeviceNameFromUserAgent(navigator.userAgent);
}

export function getSavedDeviceName(deviceId: string): string {
  if (typeof window === 'undefined') return 'Browser';
  try {
    const saved = window.localStorage.getItem(`lyga_dev_name_${deviceId}`)?.trim();
    if (saved) return saved;
  } catch {
    // ignore storage restriction
  }
  return detectDeviceName();
}

export function saveDeviceName(deviceId: string, name: string): string {
  const clean = name.trim().slice(0, 32) || detectDeviceName();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`lyga_dev_name_${deviceId}`, clean);
    } catch {
      // ignore storage restriction
    }
  }
  return clean;
}
