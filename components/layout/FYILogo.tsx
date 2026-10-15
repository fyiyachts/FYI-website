// Self-hosted. This used to point at the `fyiyachts` GCS bucket, which stopped
// serving in Aug 2026 when the owning Google Cloud project's billing account
// went absent — every object answers 403 UserProjectAccountProblem, so the
// header logo rendered as a broken image site-wide. The bucket is a single
// point of failure we do not control the billing for; the mark itself is 16 KB
// and belongs in the repo. Byte-identical to the GCS original: the favicons in
// public/ regenerate from this file pixel-for-pixel (see scripts/make-favicons.py).
const LOGO_URL = '/brand/fyi-logo-2024.png';

export default function FYILogo({ className = '' }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="FYI Yachts"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
