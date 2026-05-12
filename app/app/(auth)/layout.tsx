import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      <header className="px-6 py-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-maroon">नादविद्या</span>
          <span className="font-display text-lg text-muted-warm">Naadvidya</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md bg-parchment border border-line rounded-lg p-8 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
