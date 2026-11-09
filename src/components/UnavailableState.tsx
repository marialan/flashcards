interface UnavailableStateProps {
  onRetry: () => void
}

function UnavailableState({ onRetry }: UnavailableStateProps) {
  return (
    <section className="load-error" role="alert">
      <span className="unavailable-icon" aria-hidden="true">!</span>
      <p>Content is unavailable for this launch.</p>
      <button type="button" onClick={onRetry}>Retry</button>
    </section>
  )
}

export default UnavailableState
