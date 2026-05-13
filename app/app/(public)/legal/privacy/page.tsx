import { MarkdownPage } from '@/components/legal/MarkdownPage';

export const metadata = {
  title: 'Privacy Policy — Naadvidya',
  description: 'How Naadvidya collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return <MarkdownPage slug="privacy" />;
}
