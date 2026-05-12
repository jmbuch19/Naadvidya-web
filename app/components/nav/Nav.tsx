import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b border-line bg-parchment/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/naad-vidya-mark.png" alt="" aria-hidden className="w-8 h-8 rounded-full shrink-0" />
          <span className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-maroon">नादविद्या</span>
            <span className="font-display text-lg text-muted-warm tracking-wide hidden sm:inline">Naadvidya</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/teachers" className="text-ink hover:text-maroon-mid">Teachers</Link>
          <Link href="/practice" className="text-ink hover:text-maroon-mid">Practice</Link>
          <Link href="/#about" className="text-ink hover:text-maroon-mid">About</Link>
          <Link href="/#how" className="text-ink hover:text-maroon-mid">How it works</Link>
          <Link href="/login" className="text-ink hover:text-maroon-mid">Login</Link>
          <Link href="/register" className="btn-primary !py-2 !px-4 text-sm">Start Learning</Link>
        </nav>

        <Link href="/register" className="md:hidden btn-primary !py-2 !px-4 text-sm">
          Start
        </Link>
      </div>
    </header>
  );
}
