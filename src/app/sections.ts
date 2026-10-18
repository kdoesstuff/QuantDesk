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
      { to: '/drill/eighty-in-eight', label: '80 in 8', status: 'soon' },
      { to: '/drill/sequences', label: 'Sequences', status: 'soon' },
      { to: '/drill/fractions', label: 'Fractions to decimals', status: 'soon' },
      { to: '/drill/percentages', label: 'Percentages', status: 'soon' },
    ],
  },
  {
    title: 'Markets',
    links: [
      { to: '/game/dice-market', label: 'Dice market', status: 'soon' },
      { to: '/game/cards', label: 'Cards market', status: 'soon' },
      { to: '/game/make-a-market', label: 'Make me a market', status: 'soon' },
      { to: '/game/betting-board', label: 'Betting board', status: 'soon' },
      { to: '/game/kelly', label: 'Kelly sizing', status: 'soon' },
      { to: '/game/etf-arb', label: 'ETF arbitrage', status: 'soon' },
      { to: '/game/event-contracts', label: 'Event contracts', status: 'soon' },
    ],
  },
  {
    title: 'Estimation',
    links: [
      { to: '/game/fermi', label: 'Fermi', status: 'soon' },
    ],
  },
  {
    title: 'Cognitive',
    links: [
      { to: '/game/memory-grid', label: 'Memory grid', status: 'soon' },
      { to: '/game/task-switch', label: 'Task switch', status: 'soon' },
      { to: '/game/intercept', label: 'Intercept', status: 'soon' },
      { to: '/game/balloon', label: 'Balloon', status: 'soon' },
    ],
  },
  {
    title: 'Problems',
    links: [
      { to: '/bank', label: 'Question bank', status: 'soon' },
      { to: '/mock', label: 'Timed mocks', status: 'soon' },
      { to: '/techniques', label: 'Techniques', status: 'soon' },
    ],
  },
]
