// Letras latinas que no se separan de su marca con NFD ("ĐOÀN" debe quedar como "DOAN").
const LATIN_BASE: Record<string, string> = { Đ: 'D', Ð: 'D', Ø: 'O', Ł: 'L', Æ: 'AE', Œ: 'OE', Þ: 'TH', Ħ: 'H' };

// Mayúsculas, sin tildes y sin puntuación: "José Pérez, S.A." y "JOSE PEREZ SA" quedan iguales.
// Se conservan letras de cualquier alfabeto (cirílico, árabe...) porque hay nombres así en las listas.
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[ĐÐØŁÆŒÞĦ]/g, c => LATIN_BASE[c])
    .replace(/\./g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Algunos nombres llegan de la fuente con doble codificación ("å®®å´" en lugar de "宮崎").
// Si el texto, leído como bytes Latin-1, es UTF-8 válido, se usa la versión reparada.
const utf8 = new TextDecoder('utf-8', { fatal: true });
const looksMojibake = (s: string) => /[Â-ô][\u0080-¿]/.test(s) && !/[^\u0000-ÿ]/.test(s);
export const fixMojibake = (s: string) => {
  if (!looksMojibake(s)) return s;
  try {
    return utf8.decode(Buffer.from(s, 'latin1'));
  } catch {
    return s;
  }
};

// Clave de orden de las listas: primero los nombres que empiezan con letra A-Z, luego otros
// alfabetos (cirílico, árabe...), luego números y al final símbolos ("#1 MARKETING").
// Un nombre con doble codificación que no se pudo reparar (la fuente perdió bytes) va con
// los otros alfabetos: "å®®å´" no es un nombre que empiece con A.
// Dentro de cada grupo, orden alfabético del nombre normalizado.
export const sortKey = (name: string, nameNorm = normalize(name)) => {
  const first = name.trim().charAt(0);
  const group =
    /\p{N}/u.test(first) ? '2'
    : !/\p{L}/u.test(first) ? '3'
    : looksMojibake(name) ? '1'
    : /^[A-Z]/.test(nameNorm) ? '0'
    : '1';
  return group + nameNorm;
};
