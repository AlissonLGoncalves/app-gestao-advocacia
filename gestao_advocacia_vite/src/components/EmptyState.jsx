import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  filtered,
  onClearFilters,
}) {
  if (filtered) {
    return (
      <div className="text-center py-4">
        <MagnifyingGlassIcon
          style={{
            width: 36,
            height: 36,
            color: '#d1d5db',
            display: 'block',
            margin: '0 auto 10px',
          }}
        />
        <p className="text-muted small mb-2">Nenhum resultado para os filtros aplicados.</p>
        {onClearFilters && (
          <button className="btn btn-sm btn-outline-secondary" onClick={onClearFilters}>
            Limpar filtros
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="text-center py-5 px-4">
      {Icon && (
        <Icon
          style={{
            width: 52,
            height: 52,
            color: '#e5e7eb',
            display: 'block',
            margin: '0 auto 16px',
          }}
        />
      )}
      <p className="fw-semibold mb-1 text-dark" style={{ fontSize: '0.95rem' }}>
        {title}
      </p>
      {description && (
        <p className="text-muted mb-3" style={{ fontSize: '0.85rem' }}>
          {description}
        </p>
      )}
      {onAction && actionLabel && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>
          <PlusIcon style={{ width: 14, height: 14 }} className="me-1" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
