import { Globe, Share2 } from 'lucide-react';
import type { SocialLinkItem } from '../../shared/types';

function NetworkIcon({ network }: { network: string }) {
  const lower = network.toLowerCase();
  if (lower.includes('facebook')) {
    return (
      <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    );
  }
  if (lower.includes('instagram')) {
    return (
      <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (lower === 'x') {
    return (
      <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4l16 16M20 4L4 20" />
      </svg>
    );
  }
  if (lower.includes('tiktok')) {
    return (
      <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
      </svg>
    );
  }
  if (lower.includes('threads')) {
    return <Share2 aria-hidden="true" className="w-4 h-4 shrink-0" />;
  }
  return <Globe aria-hidden="true" className="w-4 h-4 shrink-0" />;
}

export function SocialLinksBar({ links }: { links: SocialLinkItem[] }) {
  const active = links.filter((item) => item.enabled && item.url.trim().length > 0);
  if (active.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No hay enlaces a redes sociales habilitados actualmente.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-label="Redes sociales oficiales">
      {active.map((item) => (
        <li key={item.id}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 py-1.5 text-sm font-medium text-[var(--text-ink)] hover:text-[var(--brand-green)] transition-colors whitespace-nowrap underline-offset-4 hover:underline"
            aria-label={`${item.network}: ${item.label} (abre en una nueva pestaña)`}
          >
            <NetworkIcon network={item.network} />
            <span>{item.network}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
