// Nome de exibição a partir do nome da conta Microsoft (ex.: "MATEUS SONNENBERG DA SILVA" -> "Mateus Silva").

const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von'])
const MAX = 40

function capitalize(word: string): string {
  return word
    .split(/([-'])/)
    .map((part) => (part.length > 1 || /\p{L}/u.test(part) ? part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1) : part))
    .join('')
}

/** Primeiro + último nome, com maiúsculas certas. Vazio se não houver nome. */
export function formatPersonName(raw: string | null | undefined): string {
  const words = (raw ?? '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // "Nome (Aluno)"
    .split(/[\s,]+/)
    .map((w) => w.trim().toLocaleLowerCase('pt-BR'))
    .filter((w) => w && /\p{L}/u.test(w))
  const names = words.filter((w) => !PARTICLES.has(w))
  if (names.length === 0) return ''
  const picked = names.length === 1 ? [names[0]] : [names[0], names[names.length - 1]]
  return picked.map(capitalize).join(' ').slice(0, MAX)
}

/** O nome atual parece gerado do e-mail (RA ou "nome.sobrenome") e não escolhido pelo aluno? */
export function looksLikeEmailName(displayName: string, email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  const name = displayName.trim().toLowerCase()
  return name === '' || /^\d+$/.test(name) || name === local
}
