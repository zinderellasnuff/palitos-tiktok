// Traduce eventos de tiktok-live-connector al formato de handle() del juego.
// La librería entrega dos formas según la versión (cruda v3: displayId/avatarThumb/gift;
// "legacy": uniqueId/profilePictureUrl/giftDetails), así que se aceptan las dos.
// shortcut: nombres de campos sacados de los tipos de la librería, sin probar en un live real; verificar en la primera prueba.

export function userOf(d) {
  const u = d?.user ?? {};
  const user = String(u.uniqueId || u.displayId || u.nickname || '').trim();
  const avatar = u.profilePictureUrl || u.profilePicture?.urls?.[0] || u.avatarThumb?.urlList?.[0] || u.avatarMedium?.urlList?.[0] || '';
  return { user, avatar };
}

// Regalos en racha (tipo 1) llegan muchas veces: se cuentan una sola vez, al terminar, con el total.
export function giftEvent(d) {
  const g = d?.giftDetails ?? d?.gift ?? {};
  const type = Number(g.giftType ?? g.type ?? d?.giftType);
  if (type === 1 && !Number(d?.repeatEnd)) return null;
  const diamonds = (Number(g.diamondCount ?? d?.diamondCount) || 0) * (Number(d?.repeatCount) || 1);
  return diamonds > 0 ? { type: 'gift', ...userOf(d), diamonds } : null;
}

// El proxy de fotos solo baja imágenes del CDN de TikTok (para que no sea un proxy abierto).
export function avatarAllowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)(tiktokcdn(-[a-z]+)?\.com|ibyteimg\.com|byteimg\.com)$/.test(u.hostname);
  } catch { return false; }
}
