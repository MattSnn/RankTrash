// Materiais reconhecidos pela IA e regras de pontuação/descarte.
// Cores da coleta seletiva seguem a Resolução CONAMA 275/2001.

export const MATERIALS = [
  'aluminio',
  'plastico',
  'vidro',
  'papel',
  'metal',
  'organico',
  'eletronico',
  'nao_reciclavel',
] as const

export type Material = (typeof MATERIALS)[number]

export interface MaterialInfo {
  label: string
  basePoints: number
  binColor: string
  binLabel: string
  /** peso médio estimado de 1 item, em kg (para o "impacto" no perfil) */
  kgPerItem: number
  note?: string
}

export const MATERIAL_INFO: Record<Material, MaterialInfo> = {
  aluminio: { label: 'Alumínio', basePoints: 10, binColor: '#f5c518', binLabel: 'AMARELA (metal)', kgPerItem: 0.0145 },
  plastico: { label: 'Plástico', basePoints: 8, binColor: '#e23b3b', binLabel: 'VERMELHA (plástico)', kgPerItem: 0.025 },
  vidro: { label: 'Vidro', basePoints: 8, binColor: '#2fae5b', binLabel: 'VERDE (vidro)', kgPerItem: 0.2 },
  papel: { label: 'Papel/Papelão', basePoints: 5, binColor: '#2f6fe2', binLabel: 'AZUL (papel)', kgPerItem: 0.01 },
  metal: { label: 'Metal', basePoints: 8, binColor: '#f5c518', binLabel: 'AMARELA (metal)', kgPerItem: 0.03 },
  organico: { label: 'Orgânico', basePoints: 3, binColor: '#8a5a2b', binLabel: 'MARROM (orgânico)', kgPerItem: 0.1 },
  eletronico: {
    label: 'Eletrônico/Pilha',
    basePoints: 15,
    binColor: '#f08a24',
    binLabel: 'LARANJA (resíduo perigoso)',
    kgPerItem: 0.05,
    note: 'Pilhas e eletrônicos vão para o ponto de coleta especial.',
  },
  nao_reciclavel: { label: 'Não reciclável', basePoints: 2, binColor: '#8c8c8c', binLabel: 'CINZA (rejeito)', kgPerItem: 0.02 },
}

export function isMaterial(value: unknown): value is Material {
  return typeof value === 'string' && (MATERIALS as readonly string[]).includes(value)
}
