/**
 * The site map. Sections that are not built yet still appear in the rail,
 * greyed, so the shape of the whole site is visible from day one.
 */
export interface SectionLink {
  to: string
  label: string
  status: 'live' | 'soon'
}

export interface SectionGroup {
  title: string
  links: SectionLink[]
}

export const sections: SectionGroup[] = [
  {
    title: 'Speed',
    links: [
      { to: '/drill/speed-arithmetic', label: 'Speed arithmetic', status: 'live' },
      { to: '/drill/eighty-in-eight', label: '80 in 8', status: 'live' },
      { to: '/drill/sequences', label: 'Sequences', status: 'live' },
      { to: '/drill/fractions', label: 'Fractions to decimals', status: 'live' },
      { to: '/drill/percentages', label: 'Percentages', status: 'live' },
    ],
  },
  {
    title: 'Markets',
    links: [
      { to: '/drill/dice-market', label: 'Dice market', status: 'live' },
      { to: '/drill/cards-market', label: 'Cards market', status: 'live' },
      { to: '/drill/make-a-market', label: 'Make me a market', status: 'live' },
      { to: '/drill/betting-board', label: 'Betting board', status: 'live' },
      { to: '/drill/kelly', label: 'Kelly sizing', status: 'live' },
      { to: '/drill/etf-arb', label: 'ETF arbitrage', status: 'live' },
      { to: '/drill/event-contracts', label: 'Event contracts', status: 'live' },
    ],
  },
  {
    title: 'Prediction',
    links: [
      { to: '/drill/race', label: 'The race', status: 'live' },
      { to: '/drill/evidence', label: 'Evidence stream', status: 'live' },
      { to: '/drill/event-maker', label: 'Event market maker', status: 'live' },
      { to: '/drill/dutch-book', label: 'Dutch book', status: 'live' },
    ],
  },
  {
    title: 'Estimation',
    links: [
      { to: '/drill/fermi', label: 'Fermi', status: 'live' },
    ],
  },
  {
    title: 'Cognitive',
    links: [
      { to: '/drill/memory-grid', label: 'Memory grid', status: 'live' },
      { to: '/drill/task-switch', label: 'Task switch', status: 'live' },
      { to: '/drill/intercept', label: 'Intercept', status: 'live' },
      { to: '/drill/balloon', label: 'Balloon', status: 'live' },
    ],
  },
]
