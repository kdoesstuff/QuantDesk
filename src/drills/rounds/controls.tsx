import { useEffect, useRef, useState } from 'react'

/** A row of big buttons with single-key shortcuts. */
export function Choices<T extends string>({
  options,
  onPick,
  disabled,
}: {
  options: { value: T; label: string; key: string; tone?: 'buy' | 'sell' | 'quiet' }[]
  onPick: (v: T) => void
  disabled: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      const t = e.target as HTMLElement | null
      if (t instanceof HTMLInputElement) return
      const hit = options.find((o) => o.key.toLowerCase() === e.key.toLowerCase())
      if (hit) {
        e.preventDefault()
        onPick(hit.value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, onPick, disabled])
  return (
    <div className="choices choices--row">
      {options.map((o) => (
        <button
          key={o.value}
          className={'choice' + (o.tone ? ` choice--${o.tone}` : '')}
          onClick={() => onPick(o.value)}
          disabled={disabled}
        >
          <span className="choice__key">{o.key.toUpperCase()}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Bid and ask, Tab between them, Enter submits. */
export function QuoteInput({
  onSubmit,
  disabled,
  step = 1,
  placeholderBid = 'bid',
  placeholderAsk = 'ask',
}: {
  onSubmit: (bid: number, ask: number) => void
  disabled: boolean
  step?: number
  placeholderBid?: string
  placeholderAsk?: string
}) {
  const [bid, setBid] = useState('')
  const [ask, setAsk] = useState('')
  const bidRef = useRef<HTMLInputElement>(null)
  const askRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!disabled) {
      setBid('')
      setAsk('')
      bidRef.current?.focus()
    }
  }, [disabled])
  const submit = () => {
    const b = Number(bid)
    const a = Number(ask)
    if (bid === '' || ask === '' || !Number.isFinite(b) || !Number.isFinite(a)) return
    onSubmit(b, a)
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, which: 'bid' | 'ask') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (which === 'bid' && ask === '') askRef.current?.focus()
      else submit()
    }
  }
  return (
    <div className="quote">
      <label className="quote__side">
        <span className="quote__label">Bid</span>
        <input
          ref={bidRef}
          className="run__input run__input--small tnum"
          inputMode="decimal"
          step={step}
          placeholder={placeholderBid}
          value={bid}
          disabled={disabled}
          onChange={(e) => setBid(e.target.value.replace(/[^\d.-]/g, ''))}
          onKeyDown={(e) => onKey(e, 'bid')}
          aria-label="Bid"
        />
      </label>
      <span className="quote__at">at</span>
      <label className="quote__side">
        <span className="quote__label">Ask</span>
        <input
          ref={askRef}
          className="run__input run__input--small tnum"
          inputMode="decimal"
          step={step}
          placeholder={placeholderAsk}
          value={ask}
          disabled={disabled}
          onChange={(e) => setAsk(e.target.value.replace(/[^\d.-]/g, ''))}
          onKeyDown={(e) => onKey(e, 'ask')}
          aria-label="Ask"
        />
      </label>
    </div>
  )
}

/** One number, Enter submits. */
export function NumberInput({
  onSubmit,
  disabled,
  label,
  suffix,
  allow = /[^\d.-]/g,
}: {
  onSubmit: (v: number) => void
  disabled: boolean
  label?: string
  suffix?: string
  allow?: RegExp
}) {
  const [v, setV] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!disabled) {
      setV('')
      ref.current?.focus()
    }
  }, [disabled])
  return (
    <div className="run__answer">
      {label ? <span className="run__eq run__eq--text">{label}</span> : <span className="run__eq">=</span>}
      <input
        ref={ref}
        className="run__input tnum"
        inputMode="decimal"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value.replace(allow, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v !== '' && Number.isFinite(Number(v))) {
            e.preventDefault()
            onSubmit(Number(v))
          }
        }}
        aria-label={label ?? 'Answer'}
      />
      {suffix ? <span className="run__eq run__eq--text">{suffix}</span> : null}
    </div>
  )
}
