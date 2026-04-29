import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { useAuth } from "../../lib/supabase/AuthContext"

interface ArticleProps {
    id: number | string
    image_url?: string | null
    wine_label: string
    sku: string
    description?: string | null
    allocated_case: number
    allocated_bottles: number
    available: boolean
}


const Article: React.FC<ArticleProps> = (row: ArticleProps) => {
    const { t } = useTranslation('wineryInventory')
    const { role } = useAuth()
    const detailHref = role === 'buyer'
        ? `/dashboard/buyer/inventory/${row.id}`
        : `/dashboard/winery/inventory/${row.id}`
    return ( 
        <article key={row.id} className="overflow-hidden rounded-2xl border border-border bg-surface-alt">
        {row.image_url ? (
            <img src={row.image_url} alt={row.wine_label} className="h-40 w-full object-cover" />
        ) : (
            <div className="flex h-40 items-center justify-center bg-surface-elevated text-sm text-muted">
            {t('cards.noImage')}
            </div>
        )}
        <div className="space-y-3 p-4">
            <div>
            <p className="text-base font-semibold text-primary">{row.wine_label}</p>
            <p className="text-xs uppercase tracking-wide text-secondary">{row.sku}</p>
            {row.description && (
                <p className="mt-2 line-clamp-2 text-sm text-secondary">{row.description}</p>
            )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface px-2 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">{t('cards.allocated_case')}</p>
                <p className="text-sm font-semibold text-primary">{row.allocated_case}</p>
            </div>
            <div className="rounded-xl bg-surface px-2 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">{t('cards.allocated_bottles')}</p>
                <p className="text-sm font-semibold text-primary">{row.allocated_bottles}</p>
            </div>
            <div className="rounded-xl bg-surface px-2 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">{t('cards.available')}</p>
                <p className={`text-sm font-semibold ${row.available ? 'text-success-text' : 'text-error-text'}`}>
                    {row.available ? (
                        <span className="inline-flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <polyline points="9 11 12 14 22 4" />
                            </svg>
                        </span>
                    ) : (
                        <span className="inline-flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            </svg>
                        </span>
                    )}
                </p>
            </div>
            </div>
            <Link
            to={detailHref}
            className="inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-elevated"
            >
            {t('cards.openDetail')}
            </Link>
        </div>
        </article>
    )
}

export default Article