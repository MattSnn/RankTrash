// Motivos de revisão (gravados pelo servidor em disposals.reason) em linguagem para o aluno.

const TEXTS: [RegExp, string][] = [
  [/parecida com a de outro/i, 'Sua foto ficou muito parecida com a de outro aluno.'],
  [/confian/i, 'A IA não teve certeza de qual é o item.'],
]

export function reviewReasonText(reason: string): string {
  const hit = TEXTS.find(([re]) => re.test(reason))
  return hit ? hit[1] : reason
}

/** Vários motivos (lista ou texto separado por "; ") em frases para o aluno. */
export function reviewReasons(reasons: string[] | string | null | undefined): string[] {
  const list = Array.isArray(reasons) ? reasons : (reasons ?? '').split(';')
  return list.map((r) => r.trim()).filter(Boolean).map(reviewReasonText)
}
