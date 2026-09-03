import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandle, cn } from './ui'

/**
 * Lista vertical reordenable. El orden del array es la prioridad, asi que
 * `onReorder` devuelve los indices y quien la usa reescribe el array.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
}: {
  items: T[]
  onReorder: (from: number, to: number) => void
  children: (item: T, index: number) => ReactNode
}) {
  const sensors = useSensors(
    // Un umbral chico evita que un click en la manija dispare un drag fantasma.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = items.findIndex((item) => item.id === active.id)
    const to = items.findIndex((item) => item.id === over.id)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => children(item, index))}
      </SortableContext>
    </DndContext>
  )
}

/** Fila arrastrable: el drag se activa solo desde la manija. */
export function SortableRow({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-1', isDragging && 'relative z-10 opacity-90', className)}
    >
      <div className="pt-2">
        <DragHandle {...attributes} {...listeners} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
