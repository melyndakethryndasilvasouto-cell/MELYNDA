export const BAD_WORDS = [
  'puta', 'merda', 'caralho', 'porra', 'buceta', 'piroca', 'pica', 'cu', 'bosta',
  'desgraça', 'fuder', 'fod', 'cuz', 'corno', 'vadia', 'arrombado', 'viado', 'gay',
  'lesbica', 'puto', 'pqp', 'vsf', 'tnc', 'fdp', 'krl', 'xoxota', 'rola', 'cacete'
];

export function isSafeName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[\W_]+/g, '');
  for (const word of BAD_WORDS) {
    if (normalized.includes(word)) return false;
  }
  return true;
}
