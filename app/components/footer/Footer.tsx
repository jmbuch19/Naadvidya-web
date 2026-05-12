import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-line bg-parchment mt-20">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-display text-2xl text-maroon mb-2">नादविद्या</div>
          <p className="text-muted-warm leading-relaxed">
            India&rsquo;s premier online academy for Indian Classical music. Curated by{' '}
            Mrs. Amee Buch, Sangeet Visharad.
          </p>
        </div>

        <div>
          <h4 className="font-display text-base mb-3">Platform</h4>
          <ul className="space-y-2 text-muted-warm">
            <li><Link href="/teachers" className="hover:text-maroon-mid">Browse Teachers</Link></li>
            <li><Link href="/register" className="hover:text-maroon-mid">Become a Student</Link></li>
            <li><Link href="/register?role=teacher" className="hover:text-maroon-mid">Teach with Us</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-base mb-3">Legal</h4>
          <ul className="space-y-2 text-muted-warm">
            <li><Link href="/legal/student-charter" className="hover:text-maroon-mid">Student Charter</Link></li>
            <li><Link href="/legal/teacher-terms" className="hover:text-maroon-mid">Teacher Terms</Link></li>
            <li><Link href="/legal/refunds" className="hover:text-maroon-mid">Cancellation &amp; Refunds</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-maroon-mid">Privacy Policy</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-base mb-3">Contact</h4>
          <ul className="space-y-2 text-muted-warm">
            <li><a href="mailto:support@naadvidya.in" className="hover:text-maroon-mid">support@naadvidya.in</a></li>
            <li><a href="mailto:teachers@naadvidya.in" className="hover:text-maroon-mid">teachers@naadvidya.in</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted-warm text-center">
          © {new Date().getFullYear()} Naadvidya — Hosted by Mrs. Amee Buch, Sangeet Visharad.
        </div>
      </div>
    </footer>
  );
}
