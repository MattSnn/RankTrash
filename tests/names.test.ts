import { describe, expect, it } from 'vitest'
import { formatPersonName, looksLikeEmailName, nameSuggestions } from '../src/lib/names'

describe('formatPersonName', () => {
  it('usa primeiro e último nome com maiúsculas certas', () => {
    expect(formatPersonName('MATEUS SONNENBERG DA SILVA')).toBe('Mateus Silva')
    expect(formatPersonName('joão pedro de oliveira')).toBe('João Oliveira')
  })
  it('ignora partículas e sufixos entre parênteses', () => {
    expect(formatPersonName('Ana dos Santos (Aluno)')).toBe('Ana Santos')
  })
  it('mantém nome único e nomes compostos com hífen', () => {
    expect(formatPersonName('MARIA')).toBe('Maria')
    expect(formatPersonName('ana-clara souza')).toBe('Ana-Clara Souza')
  })
  it('vazio quando não há nome', () => {
    expect(formatPersonName('')).toBe('')
    expect(formatPersonName(undefined)).toBe('')
    expect(formatPersonName('234925')).toBe('')
  })
  it('limita a 40 caracteres', () => {
    expect(formatPersonName('A'.repeat(30) + ' ' + 'B'.repeat(30)).length).toBe(40)
  })
})

describe('looksLikeEmailName', () => {
  it('reconhece RA e parte do e-mail', () => {
    expect(looksLikeEmailName('234925', '234925@facens.br')).toBe(true)
    expect(looksLikeEmailName('mateus.sonnenberg', 'mateus.sonnenberg@facens.br')).toBe(true)
    expect(looksLikeEmailName('Mateus S.', '234925@facens.br')).toBe(false)
  })
})

describe('nameSuggestions', () => {
  it('sugere primeiro + cada sobrenome e o nome completo', () => {
    expect(nameSuggestions('MATEUS SONNENBERG AMARAL')).toEqual([
      'Mateus Amaral',
      'Mateus Sonnenberg',
      'Mateus Sonnenberg Amaral',
    ])
  })
  it('sem repetir e vazio sem nome', () => {
    expect(nameSuggestions('Maria Silva')).toEqual(['Maria Silva'])
    expect(nameSuggestions('')).toEqual([])
  })
})
