import './CardProgress.css'

interface CardProgressProps {
  cardCount: number
  currentIndex: number
}

function CardProgress({ cardCount, currentIndex }: CardProgressProps) {
  return (
    <div className="card-progress" role="status" aria-label={`Card ${currentIndex + 1} of ${cardCount}`}>
      {Array.from({ length: cardCount }, (_, i) => (
        <div
          key={i}
          className="card-progress-dot"
          data-active={i === currentIndex}
          aria-current={i === currentIndex ? 'true' : undefined}
        />
      ))}
    </div>
  )
}

export default CardProgress
