import './Sticker.css'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { Sticker as StickerType } from '../data/stickers'
import type { StickerPosition } from '../utils/stickerPlacement'

interface StickerProps {
  sticker: StickerType
  position: StickerPosition
  onPeelStart?: () => void
  onPeelComplete?: () => void
  onCollect?: (stickerId: string) => void
}

type StickerState = 'attached' | 'peeling' | 'flying-to-center' | 'centered' | 'collecting' | 'collected'

function Sticker({
  sticker,
  position,
  onPeelStart,
  onPeelComplete,
  onCollect,
}: StickerProps) {
  const [state, setState] = useState<StickerState>('attached')
  const [bookIconRef, setBookIconRef] = useState<DOMRect | null>(null)
  const [cardRect, setCardRect] = useState<DOMRect | null>(null)
  const internalRef = useRef<HTMLDivElement>(null)

  // Get card and sticker book icon positions
  useEffect(() => {
    if (state === 'centered' || state === 'flying-to-center') {
      const card = internalRef.current?.parentElement as HTMLElement
      if (card) {
        setCardRect(card.getBoundingClientRect())
      }
      
      if (state === 'centered') {
        const bookIcon = document.querySelector('.sticker-book-icon')
        if (bookIcon) {
          setBookIconRef(bookIcon.getBoundingClientRect())
        }
      }
    }
  }, [state])

  const handleFirstTap = useCallback(() => {
    if (state !== 'attached') return

    setState('peeling')
    onPeelStart?.()

    setTimeout(() => {
      setState('flying-to-center')
      onPeelComplete?.()
    }, 300) // peel animation duration
  }, [state, onPeelStart, onPeelComplete])

  const handleSecondTap = useCallback(() => {
    if (state !== 'centered') return

    setState('collecting')

    setTimeout(() => {
      setState('collected')
      onCollect?.(sticker.id)
    }, 500) // flight-to-book animation duration
  }, [state, sticker.id, onCollect])

  useEffect(() => {
    if (state === 'flying-to-center') {
      const timer = setTimeout(() => {
        setState('centered')
      }, 600) // flight animation duration

      return () => clearTimeout(timer)
    }
  }, [state])

  const stateClass = `sticker-${state}`
  
  let style: React.CSSProperties = {}
  if (state === 'attached') {
    style = {
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: `rotate(${position.rotation}deg)`,
    }
  } else if (state === 'flying-to-center') {
    // Calculate center position relative to card
    const centerX = cardRect ? cardRect.width / 2 - 30 : 50
    const centerY = cardRect ? cardRect.height / 2 - 30 : 50
    style = {
      left: `${centerX}px`,
      top: `${centerY}px`,
      transform: 'rotate(0deg)',
      transition: 'all 0.6s ease-out',
    }
  } else if (state === 'centered') {
    // Center relative to card
    const centerX = cardRect ? cardRect.width / 2 - 30 : 50
    const centerY = cardRect ? cardRect.height / 2 - 30 : 50
    style = {
      left: `${centerX}px`,
      top: `${centerY}px`,
      transform: 'rotate(0deg)',
    }
  } else if (state === 'collecting' && bookIconRef && cardRect) {
    // Calculate position relative to card
    const offsetX = bookIconRef.left + bookIconRef.width / 2 - 30 - cardRect.left
    const offsetY = bookIconRef.top + bookIconRef.height / 2 - 30 - cardRect.top
    style = {
      left: `${offsetX}px`,
      top: `${offsetY}px`,
      transform: 'rotate(0deg) scale(0.3)',
      transition: 'all 0.5s ease-in',
    }
  }

  useEffect(() => {
    const handleNativeClick = (event: MouseEvent) => {
      event.stopImmediatePropagation()
      if (state === 'attached') handleFirstTap()
      else if (state === 'centered') handleSecondTap()
    }

    if (internalRef.current && (state === 'attached' || state === 'centered')) {
      internalRef.current.addEventListener('click', handleNativeClick, true)
      return () => {
        internalRef.current?.removeEventListener('click', handleNativeClick, true)
      }
    }
  }, [state, handleFirstTap, handleSecondTap])

  return (
    <div
      ref={internalRef}
      className={`sticker ${stateClass}`}
      style={style}
      role="button"
      tabIndex={state === 'attached' || state === 'centered' ? 0 : -1}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (state === 'attached') handleFirstTap()
          else if (state === 'centered') handleSecondTap()
        }
      }}
    >
      <img
        src={new URL(sticker.imageSrc, document.baseURI).href}
        alt={sticker.name}
        className="sticker-image"
        draggable={false}
      />
    </div>
  )
}

export default Sticker
