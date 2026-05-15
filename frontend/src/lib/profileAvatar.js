export function getProfileAvatarSrc(user) {
  const avatarUrl = String(user?.avatar_url || '').trim();
  if (avatarUrl) {
    return avatarUrl;
  }

  const seed = encodeURIComponent(String(user?.name || 'Pengguna'));
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

