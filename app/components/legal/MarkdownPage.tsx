import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  slug: 'refunds' | 'student-charter' | 'teacher-terms' | 'scheduling' | 'portal-teacher' | 'privacy';
}

export function loadLegalMarkdown(slug: Props['slug']): string {
  const filePath = path.join(process.cwd(), 'lib', 'legal', 'md', `${slug}.md`);
  return fs.readFileSync(filePath, 'utf8');
}

export function MarkdownPage({ slug }: Props) {
  const source = loadLegalMarkdown(slug);

  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <div className="prose-naad">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="font-display text-4xl md:text-5xl font-semibold text-maroon mb-2 leading-tight">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-maroon mt-12 mb-4">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="font-display text-xl text-maroon-mid mt-8 mb-3">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="font-display text-lg text-maroon-mid mt-6 mb-2">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="text-ink leading-relaxed my-4">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-6 my-4 space-y-2 text-ink">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-6 my-4 space-y-2 text-ink">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-maroon">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-muted-warm">{children}</em>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gold bg-parchment-2/40 pl-4 py-2 my-6 italic text-muted-warm">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-maroon-mid underline hover:text-maroon"
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            ),
            hr: () => <hr className="my-10 border-line" />,
            code: ({ children }) => (
              <code className="bg-parchment-2 px-1.5 py-0.5 rounded text-sm font-mono text-maroon">
                {children}
              </code>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-6">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-parchment-2">{children}</thead>,
            th: ({ children }) => (
              <th className="border border-line px-3 py-2 text-left font-display text-maroon">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-line px-3 py-2 align-top text-ink">{children}</td>
            ),
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
    </article>
  );
}
