const DEVICES_STORAGE_KEY = 'mindfase_devices';

function detectBrowser(userAgent) {
  if (/edg/i.test(userAgent)) return 'Edge';
  if (/chrome|crios/i.test(userAgent)) return 'Chrome';
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) return 'Safari';
  return 'Browser';
}

function getCurrentDevice() {
  const userAgent = navigator.userAgent || 'Unknown Agent';
  const platform = navigator.platform || 'Unknown Platform';
  const browser = detectBrowser(userAgent);
  const id = `${platform}-${browser}`;

  return {
    id,
    name: `${browser} di ${platform}`,
    platform,
    browser,
    isCurrent: true,
    lastActive: new Date().toISOString(),
  };
}

function mergeCurrentDevice(devices) {
  const current = getCurrentDevice();
  const now = new Date().toISOString();

  const existing = Array.isArray(devices) ? devices : [];
  const others = existing.filter((device) => device.id !== current.id).map((device) => ({
    ...device,
    isCurrent: false,
  }));

  return [{ ...current, lastActive: now }, ...others].slice(0, 8);
}

export function readDevices() {
  try {
    const raw = localStorage.getItem(DEVICES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return mergeCurrentDevice(parsed);
  } catch {
    return mergeCurrentDevice([]);
  }
}

export function saveDevices(devices) {
  localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
}
