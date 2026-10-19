import { CUT, MIN } from '../insights/analyze'
import { ACC_GAIN, MIN_ROWS, SPEED_GAIN, WINDOW } from '../insights/focus'
import { BOOT } from '../insights/stats'
import '../insights/insights.css'

/** How the insights and focus blocks are computed, in plain words, with the thresholds that are actually in the code. */
export default function Method() {
  return (
    <div className="page method">
      <h1 className="display">How the insights work</h1>
      <p>
        Every drill logs each problem, decision or trial: what was shown, what you did, how long it took, whether it was right, and a few tags about the
        category it belongs to. The insights engine reads those logs and reports only what is both large and well supported. Nothing here is a feeling.
      </p>

      <h2>Slicing</h2>
      <p>
        Each logged event is placed in categories: the operation and the times table for arithmetic, the rule family for sequences, the denominator for
        fractions, the lean of the market for the dice and cards games, the topic for Fermi, and so on. Position in the run (first, middle, last third) is a
        category too.
      </p>

      <h2>Slow spots and error spots</h2>
      <ul>
        <li>
          A category is compared with everything outside it. For time, the statistic is the ratio of medians. The ratio is bootstrapped ({BOOT} resamples) and
          the category is called slow only if the {Math.round(CUT.catLevel * 100)} percent interval sits above 10 percent slower and the point estimate is at
          least 20 percent slower.
        </li>
        <li>
          For accuracy, the statistic is the difference in first-try rate, tested with a two-proportion z test. A gap of 8 points or more at z of {CUT.catZ} or
          beyond is reported. Category tests are many, so they use a stricter cutoff than the single tests below, which is the usual guard against finding
          something by looking in enough places.
        </li>
        <li>
          Minimum samples: {MIN.timeCell} events in the category and {MIN.timeCell} outside it for time, {MIN.accCell} and {MIN.accCell} for accuracy. Below
          that nothing is said, because a handful of problems cannot separate a weak spot from a bad minute.
        </li>
        <li>
          When you have three or more runs with the same settings and 120 or more events among them, comparisons use only those runs, so a wide-range run
          is not compared with a narrow-range one. Otherwise all runs are pooled.
        </li>
      </ul>

      <h2>Fade, rushing, method gaps</h2>
      <ul>
        <li>Fade: the last third of runs against the first third, same tests as above at z of {CUT.oneZ} and a {Math.round(CUT.oneLevel * 100)} percent interval, {MIN.fatigue} events per third at least.</li>
        <li>
          Rushing: events are split at your own median time. If the fast half is wrong noticeably more often than the slow half, the errors come from speed,
          not knowledge. The reverse pattern, slow and wrong, means there are problems you have no method for yet.
        </li>
        <li>Trend: with {MIN.trendRuns} or more runs on one setting, the median of the last three against the three before, with a least-squares slope as a check.</li>
      </ul>

      <h2>Leans and calibration</h2>
      <ul>
        <li>
          Markets and estimates: among decisions with a clear direction (mid above or below fair, guessed high or low, fired early or late), a sign test
          against one half, at least {MIN.bias} decisions, reported at z of 1.96 or beyond.
        </li>
        <li>
          Fermi intervals: the hit rate of your 90 percent ranges with a Wilson interval, at least {MIN.calibration} ranges. If the whole interval sits under
          90 percent you are overconfident; near-perfect hit rates with very wide ranges are underconfident.
        </li>
      </ul>

      <h2>Focus blocks</h2>
      <p>
        A slow spot or error spot can become a focus block. The block pins the settings that isolate that category (only the 7 times table, only the
        doubling-step family, only sevenths) and records a baseline. It clears when the last {WINDOW} runs under those settings, with at least {MIN_ROWS}{' '}
        problems between them, are {Math.round(SPEED_GAIN * 100)} percent faster than the baseline without losing accuracy, or {Math.round(ACC_GAIN * 100)}{' '}
        points more accurate. One good run does not clear it; a held improvement does. After clearing, the advice is mixed practice again, which is where the
        gain has to show.
      </p>

      <h2>Why it is built this way</h2>
      <ul>
        <li>
          <strong>Deliberate practice</strong> is practice aimed at a specific weakness with feedback, not repetition of what you already do well (Ericsson,
          Krampe and Tesch-Romer, 1993). Focus blocks are that, made mechanical.
        </li>
        <li>
          <strong>Difficulty around 85 percent success</strong> is where learning is fastest for a wide class of learners (Wilson, Shenhav, Straub and Cohen,
          2019). The level settings on each drill are there to let you sit near it.
        </li>
        <li>
          <strong>Interleaving</strong> mixed problem types beats blocked practice for retention and transfer (Rohrer and Taylor, 2007), which is why the
          default for every drill is mixed and a focus block is a short detour, not a home.
        </li>
        <li>
          <strong>Spacing</strong> several shorter sessions beat one long one (Cepeda, Pashler, Vul, Wixted and Rohrer, 2006). The fade finding exists to
          tell you when a run is longer than it is useful.
        </li>
        <li>
          <strong>Retrieval</strong> answering from memory strengthens memory more than re-reading (Roediger and Karpicke, 2006). The fraction and times-table
          drills are retrieval, not reference.
        </li>
        <li>
          <strong>Switch cost</strong> is the standard measure of how quickly you can change rule (Rogers and Monsell, 1995); it shrinks with practice and
          with a longer gap before the next stimulus.
        </li>
        <li>
          <strong>The balloon task</strong> is the Balloon Analogue Risk Task (Lejuez and others, 2002); pumps on banked balloons is the usual score, and
          the colours here add a learning component.
        </li>
      </ul>
      <p className="faint">Thresholds on this page are read from the code, so they are the ones in use.</p>
    </div>
  )
}
