import type { DrillId } from '../lib/types'

/**
 * How to play, one list per game, shown on the settings page before the
 * clock starts. Written for someone who has never seen the game.
 */
export const HOW_TO: Record<DrillId, string[]> = {
  'speed-arithmetic': [
    'A problem appears. Type the answer. The moment it is right it clears and the next one appears, so there is no Enter key to press.',
    'If what you typed is as long as the right answer and still wrong, it counts as a slip, the box clears, and you try again.',
    'Subtraction and division are built from the addition and multiplication ranges, so answers are always whole and positive.',
    'Score is the number right before the clock stops. Esc stops early.',
  ],
  'eighty-in-eight': [
    'Eighty questions, eight minutes, four options each. Press 1, 2, 3 or 4 to answer.',
    'Right is plus one, wrong is minus one, a skip is free. Press Enter to skip. Knowing when not to answer is half the test.',
    'Questions mix arithmetic, decimals, fractions, percentages, squares, roots and order of operations.',
    'The run ends at eighty questions or when the clock stops, whichever comes first.',
  ],
  sequences: [
    'Five terms of a sequence appear. Type the sixth. It clears itself when right.',
    'Every sequence follows one rule from the families you pick: constant step, constant ratio, growing step, two interleaved, and so on.',
    'Negative answers take a leading minus. Writing the differences between terms in your head usually shows the rule.',
    'Score is the number right before the clock stops.',
  ],
  fractions: [
    'A fraction appears. Type its decimal to the number of places you chose. Trailing zeros are optional, so 0.43 is fine for 0.430.',
    'Reciprocals work the same way: 1/17 to three places is 0.059.',
    'Decimal to fraction goes the other way: 0.4375 is 7/16. Type it as 7/16 in lowest terms.',
    'Answers are rounded, never truncated. Score is the number right before the clock stops.',
  ],
  percentages: [
    'Each problem is a percentage the way a desk uses them: percent of a number, percent change from one number to another, reversing a move, two moves compounded, basis points, margins.',
    'Type the number only. A percent change of 12.5 percent is 12.5, a move of 125 basis points is 125, a margin of 37.5 percent is 37.5.',
    'A fall is negative: from 50 to 40 is minus 20.',
    'Answers are built to be exact at one decimal place, so if yours has more digits, it is wrong.',
  ],
  'dice-market': [
    'Some dice are face up, some are hidden. The market is on the total of all of them. Fair value is what you can see plus three and a half for every hidden die.',
    'Take mode: a bid and an ask are shown. Press B to buy at the ask, S to sell at the bid, P to pass. The right call is the one with positive expected edge; pass when fair sits inside the quote.',
    'Make mode: type your bid, Tab, your ask, Enter. If fair sits outside your quote the house trades against you. If your quote is wider than the limit, no trade. Fair inside and the quote tight scores best.',
    'After each round the hidden dice are revealed and you see fair, the realised total and your points. Score is expected edge in points of the sum.',
  ],
  'cards-market': [
    'Cards from one 52-card deck, ace counting one and king thirteen. Some face up, some face down. The market is on the total.',
    'A hidden card is worth the average of what is left in the deck, not seven, so a high card showing makes the hidden ones a little cheaper.',
    'Take mode: B to buy at the ask, S to sell at the bid, P to pass. Make mode: bid, Tab, ask, Enter.',
    'Score is expected edge in points of the sum, shown after each round with the cards revealed.',
  ],
  'make-a-market': [
    'A number you half know appears, like seconds in a week or the height of Everest in metres. Type a bid, Tab, an ask, Enter.',
    'If the truth is inside your quote you score 100 minus a penalty for width. A quote three times as wide as it is low scores zero.',
    'If the truth is outside your quote you lose 50. So a wide quote that contains it beats a tight one that misses.',
    'After each quote you see the truth and a note on it. Over many quotes the result page shows whether you lean high or low.',
  ],
  'betting-board': [
    'A board of bets appears. Each one pays some amount to 1 if it wins, and each has an exact probability from coins, dice, cards or marbles.',
    'A payout of 3 to 1 is fair for a one in four event. Take a bet when the payout beats fair, leave it when it does not.',
    'Press the number keys to mark the bets you want, then Enter to place them. Or click.',
    'Score is the edge you took minus the edge you missed, per unit staked. Taking everything or nothing both score badly.',
  ],
  kelly: [
    'You are given a win probability and the odds. Type the Kelly stake as a percent of bankroll. It clears itself when right.',
    'Full Kelly is p minus q over b: win probability minus lose probability divided by the payout per unit. At 60 percent and 2 to 1 that is 60 minus 20, so 40.',
    'Half Kelly is half of that. Decimal odds of 3.0 mean 2 to 1. If the edge is zero or negative the answer is 0.',
    'Implied win rate goes the other way: given the Kelly stake and odds, what probability makes it right.',
  ],
  'etf-arb': [
    'An ETF is quoted bid at ask. Above it, the basket: each name with its weight and price. Fair value of the ETF is the weights times the prices, summed.',
    'If the ETF is offered below fair, press 1 to buy the ETF and sell the basket. If it is bid above fair, press 3 to sell the ETF and buy the basket. If fair sits inside the quote, press 2 for no trade.',
    'Right is plus one, wrong is minus one if the penalty is on, Enter skips for free.',
    'Score is points before the clock stops.',
  ],
  'event-contracts': [
    'A YES contract pays 100 cents if the event happens. Price it from the information given and press Enter.',
    'Test result: a base rate, how often the test catches true cases, how often it fires falsely, and the result. Price YES given the result.',
    'Likelihood ratio: a prior and how much more likely the evidence is if YES. Multiply the prior odds by the ratio, then turn odds back into a price.',
    'Both, at least one, conditional and two-stage are what they say. A cent either way is accepted by default; a wrong price clears the box and counts a slip.',
  ],
  fermi: [
    'A quantity to estimate appears with its unit. Type your best estimate, Enter, then a low and high you are 90 percent sure the truth sits between, Enter.',
    'Within 20 percent of the reference scores 100, a factor of two off scores about 75, a factor of ten off scores 0.',
    'After each answer you see the reference value and the chain of factors that gets there. That chain is the point of the game.',
    'Over many questions your intervals should catch the truth nine times in ten. Fewer means you are too sure of yourself, more means you are too cautious.',
  ],
  'memory-grid': [
    'Some cells light up for a moment, then go dark. Click the cells that were lit.',
    'Every pass adds one more cell. One wrong click ends the trial and costs a life. The run ends when the lives are gone.',
    'Score is the largest set of cells you rebuilt. Most people land between 8 and 12.',
    'Look at the whole pattern as a shape, not as a list of positions. It holds better.',
  ],
  'task-switch': [
    'One digit appears inside a coloured frame. A blue frame asks odd or even. A yellow frame asks under or over five.',
    'Press F for odd or under five, J for even or over five. Answer as fast as you can without guessing.',
    'The rule changes without warning. Trials where it changed are the switch trials, the rest are repeats.',
    'Score is the switch cost: how much slower your switch trials were than your repeats, in milliseconds. Lower is better, and it falls with practice.',
  ],
  intercept: [
    'A target crosses the top of the field. Your cannon is at the bottom. Press Space or click to fire.',
    'The shot takes a fixed time to climb, so you have to fire before the target is above you, by exactly that much. The setting says how long the shot takes.',
    'One shot per target. A miss is a miss, and a target that crosses without a shot is a miss too.',
    'Score is hits. The result page shows whether you tend to fire early or late, which is the thing to fix.',
  ],
  balloon: [
    'Press Space to pump the balloon. Each pump adds points to the pot. Press Enter to collect the pot into your bank.',
    'Pump too far and it pops, and the pot is gone. Blue, yellow and red balloons pop at different rates, and you are not told which is which. You learn by playing.',
    'The sweet spot for each colour is about half of how far it can go. Under that you leave points, over it you pop too often.',
    'Score is points banked over all the balloons.',
  ],
  race: [
    'Two runners, A and B, move one step at a time toward the finish. A contract pays 100 cents if A gets there first.',
    'The market quotes the contract live: a bid and an ask in cents. The fair price is the exact probability that A wins from where the race stands, and the market is sometimes slow to get there, sometimes jumps past it.',
    'Press B to buy YES at the ask when the market is too cheap, S to sell YES at the bid when it is too dear. One position a round, held to the finish. Doing nothing is fine when the market is right.',
    'Score is expected edge at the moment you traded, in cents, with the realised result shown too. After each round you see the true probability drawn against the market.',
  ],
  evidence: [
    'A coin was picked at random: fair, or biased toward heads. Flips arrive one at a time. A contract pays 100 cents if the coin is the biased one.',
    'Every flip is evidence. Heads make the biased coin more likely, tails less. The fair price is the Bayesian posterior and the market tracks it badly: too slowly, or overreacting to a run.',
    'Press B to buy YES at the ask or S to sell YES at the bid when you think the market is off. One position a round, held until the coin is revealed.',
    'Score is expected edge at entry, in cents. After each round you see how the true posterior moved against the market.',
  ],
  'event-maker': [
    'You are the market maker on a YES contract that pays 100 cents. You see the prior. Type a bid, Tab, an ask, Enter.',
    'A trader arrives. Some share of traders already know the answer and trade the right way against you. The rest have a private value: they buy only if your ask is low enough for them, sell only if your bid is high enough. Wide quotes trade less.',
    'After each trade, quote again. A buy means YES is more likely than you thought; move both prices up. A sell means the reverse. No trade tells you nothing.',
    'Score is the expected profit of each quote given what the tape had shown, in cents, summed. After every round you see the outcome and what you realised.',
  ],
  'dutch-book': [
    'A small board of event contracts, each priced in cents for a contract paying 100. They are related: A, B, A and B, A or B, not A.',
    'Prices must obey probability. A and B cannot cost more than A alone. A or B must equal A plus B minus A and B. A plus not A must be 100.',
    'One price breaks a rule, or none does. Pick the trade that locks in a profit whatever happens, or No arbitrage. Keys 1 to 4.',
    'Right is plus one, wrong is minus one if the penalty is on. Enter skips for free.',
  ],
}
