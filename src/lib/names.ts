// Nome de exibição a partir do nome da conta Microsoft (ex.: "MATEUS SONNENBERG DA SILVA" -> "Mateus Silva").

const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von'])
const MAX = 40

function capitalize(word: string): string {
  return word
    .split(/([-'])/)
    .map((part) => (part.length > 1 || /\p{L}/u.test(part) ? part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1) : part))
    .join('')
}

/** Nomes (sem partículas), em minúsculas. */
function nameWords(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // "Nome (Aluno)"
    .split(/[\s,]+/)
    .map((w) => w.trim().toLocaleLowerCase('pt-BR'))
    .filter((w) => w && /\p{L}/u.test(w) && !PARTICLES.has(w))
}

function join(words: string[]): string {
  return words.map(capitalize).join(' ').slice(0, MAX)
}

/** Primeiro + último nome, com maiúsculas certas. Vazio se não houver nome. */
export function formatPersonName(raw: string | null | undefined): string {
  const names = nameWords(raw)
  if (names.length === 0) return ''
  return join(names.length === 1 ? [names[0]] : [names[0], names[names.length - 1]])
}

/** Opções de nome de exibição a partir do nome completo (ex.: "Mateus Amaral", "Mateus Sonnenberg"...). */
export function nameSuggestions(raw: string | null | undefined): string[] {
  const names = nameWords(raw)
  if (names.length === 0) return []
  const [first, ...rest] = names
  const options = [join([first, names[names.length - 1]]), ...rest.slice(0, -1).map((w) => join([first, w])), join(names)]
  return [...new Set(options.filter((o) => o.length > 0))]
}

/** O nome atual parece gerado do e-mail (RA ou "nome.sobrenome") e não escolhido pelo aluno? */
export function looksLikeEmailName(displayName: string, email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  const name = displayName.trim().toLowerCase()
  return name === '' || /^\d+$/.test(name) || name === local
}
