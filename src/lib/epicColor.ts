export type EpicColor = {
  /** Color de la barra en el cronograma. */
  bar: string
  /** Fondo suave para chips y filas. */
  soft: string
}

/**
 * Paleta de las epicas. Evita a proposito el rojo de la marca, que en esta app
 * siempre significa "algo esta mal".
 */
const PALETTE: EpicColor[] = [
  { bar: '#2563eb', soft: '#eff6ff' },
  { bar: '#059669', soft: '#ecfdf5' },
  { bar: '#ea580c', soft: '#fff7ed' },
  { bar: '#7c3aed', soft: '#f5f3ff' },
  { bar: '#0891b2', soft: '#ecfeff' },
  { bar: '#ca8a04', soft: '#fefce8' },
  { bar: '#db2777', soft: '#fdf2f8' },
  { bar: '#4f46e5', soft: '#eef2ff' },
  { bar: '#65a30d', soft: '#f7fee7' },
  { bar: '#c026d3', soft: '#fdf4ff' },
  { bar: '#0d9488', soft: '#f0fdfa' },
  { bar: '#d97706', soft: '#fffbeb' },
  { bar: '#0ea5e9', soft: '#f0f9ff' },
  { bar: '#16a34a', soft: '#f0fdf4' },
  { bar: '#9333ea', soft: '#faf5ff' },
  { bar: '#475569', soft: '#f8fafc' },
]

/**
 * Un color por epica, repartido sobre los ids ordenados alfabeticamente: asi el color
 * de una epica no cambia cuando se reordena el backlog, y dos epicas solo comparten
 * color cuando hay mas epicas que colores.
 */
export function epicColors(epics: { id: string }[]): Map<string, EpicColor> {
  const sorted = epics.map((epic) => epic.id).sort()
  return new Map(sorted.map((id, index) => [id, PALETTE[index % PALETTE.length]]))
}
