import { Link } from 'react-router-dom';
import { ArrowRight } from '@/components/ui/icons';

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center">
      <p className="font-display text-7xl font-semibold leading-none text-accent sm:text-8xl">404</p>
      <h1 className="ds-h1 mt-5">Page not found</h1>
      <p className="mt-4 text-body text-ink-muted">
        The page you requested does not exist or its address has changed.
      </p>
      <Link to="/" className="btn-primary mt-8 inline-flex items-center gap-2">
        Back to home <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
