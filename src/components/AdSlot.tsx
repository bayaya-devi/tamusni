export function AdSlot({ placement, className = "" }: { placement: string; className?: string }) {
  return <aside className={`ad-slot ${className}`} aria-label="Publicité" data-ad-placement={placement}><span>Publicité</span><small>Emplacement réservé</small></aside>;
}
