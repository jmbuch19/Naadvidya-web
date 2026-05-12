import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b border-line bg-parchment/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-maroon">नादविद्या</span>
          <span className="font-display text-lg text-muted-warm tracking-wide">Naadvidya</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/teachers" className="text-ink hover:text-maroon-mid">Teachers</Link>
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
