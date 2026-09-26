import Link from "next/link";
import { LandingDemoGrid } from "@/components/landing/LandingDemoGrid";

const steps = [
  { number: "01", title: "SET THE WINDOW", copy: "Choose 7, 30, or 90 days. Give the plan a real start date." },
  { number: "02", title: "DEFINE THE WORK", copy: "Turn the outcome into daily activities you can mark clearly." },
  { number: "03", title: "SHOW UP DAILY", copy: "Track each day, see your streak, and keep the whole plan in view." },
];

export default function HomePage() {
  return (
    <main className="landing-page">
      <div aria-hidden="true" className="landing-drafting-lines" />
      <div className="landing-frame">
        <header className="landing-header">
          <Link aria-label="TRACK home" className="landing-brand" href="/">
            <span aria-hidden="true" className="landing-brand-mark">◇</span>
            <span>TRACK</span>
          </Link>
          <nav aria-label="Account" className="landing-nav">
            <Link href="/login">LOG IN</Link>
            <Link className="landing-nav-create" href="/signup">CREATE ACCOUNT <span aria-hidden="true">↗</span></Link>
          </nav>
        </header>

        <section aria-labelledby="landing-title" className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><span /> PERSONAL TRACKING SYSTEM <span className="landing-kicker-code">FIELD / 001</span></p>
            <div className="landing-product-id"><span aria-hidden="true" /> TRACK <small>IDENT / 01</small></div>
            <h1 aria-label="Make it visible." id="landing-title"><span>MAKE</span><span>IT</span><span className="landing-visible">VISIBLE.<i aria-hidden="true" /></span></h1>
            <div aria-hidden="true" className="landing-title-annotation"><span>INTENTION</span><i /><span>DAILY ACTION</span><b>01 — 30 — 90</b></div>
            <p className="landing-hero-description">A daily instrument for the things you said you would do.</p>
            <div className="landing-actions">
              <Link className="landing-primary-action" href="/signup">START TRACKING <span aria-hidden="true">↗</span></Link>
              <Link className="landing-secondary-action" href="/login">LOG IN <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div aria-label="30 day plan instrument preview" className="landing-instrument">
            <div className="instrument-top"><span><i /> SYSTEM READY</span><span>TRACK / 30</span></div>
            <div className="instrument-title">CONSISTENCY / DAILY</div>
            <LandingDemoGrid />
            <div className="instrument-bottom"><span>DAY 19 / 30</span><span><b /> IN PROGRESS</span></div>
            <div aria-hidden="true" className="instrument-scale"><span>01</span><i /><i /><i /><i /><i /><span>30</span></div>
          </div>
          <span aria-hidden="true" className="landing-hero-index">T—01</span>
        </section>

        <section aria-labelledby="why-track-title" className="landing-why landing-section">
          <div className="landing-section-index"><span>01</span><i /> PURPOSE</div>
          <div className="landing-why-copy">
            <h2 id="why-track-title">WHY TRACK?</h2>
            <p className="landing-why-lead">MOST PLANS DON’T FAIL<br />BECAUSE THEY’RE BAD.</p>
            <p className="landing-why-friction">THEY FAIL BECAUSE<br />YOU STOP SEEING THEM.</p>
            <p className="landing-why-close">TRACK turns what you want to do into something you can actually see.<br /><strong>DAY BY DAY.</strong></p>
          </div>
          <div aria-hidden="true" className="landing-why-mark"><span>∅</span><i>PLAN / ACTION / DAY</i></div>
        </section>

        <section aria-labelledby="why-built-title" className="landing-built landing-section">
          <div className="landing-section-index"><span>02</span><i /> ORIGIN</div>
          <div className="landing-built-copy">
            <p className="landing-eyebrow">WHY DID I BUILD THIS?</p>
            <h2>BECAUSE INTENTION<br />IS HARD TO MEASURE.</h2>
            <p>TRACK makes the everyday part visible: one plan, one day, one mark at a time. Less guessing about whether you are moving forward. More evidence that you showed up.</p>
          </div>
          <div className="landing-coordinate"><span>PLAN DURATIONS / DAYS</span><strong>07 — 30 — 90</strong><i>CONTROL / HUMAN</i></div>
        </section>

        <section aria-labelledby="how-title" className="landing-how landing-section">
          <div className="landing-section-index"><span>03</span><i /> OPERATION</div>
          <div className="landing-how-content">
            <div className="landing-how-heading"><p className="landing-eyebrow">HOW IT WORKS</p><h2 id="how-title">A SIMPLE SYSTEM.<br />REPEATED WITH INTENT.</h2></div>
            <div className="landing-steps">
              {steps.map((step) => <article className="landing-step" key={step.number}>
                <span className="landing-step-number">{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.copy}</p></div>
                <span aria-hidden="true" className="landing-step-arrow">↗</span>
              </article>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="final-cta-title" className="landing-final">
          <div aria-hidden="true" className="landing-final-rule"><i /><i /><i /><i /><i /></div>
          <p className="landing-eyebrow">SYSTEM / READY WHEN YOU ARE</p>
          <h2 id="final-cta-title">START WITH<br /><span>ONE DAY.</span></h2>
          <Link className="landing-primary-action" href="/signup">START TRACKING <span aria-hidden="true">↗</span></Link>
          <p className="landing-final-login">ALREADY HAVE A SYSTEM? <Link href="/login">LOG IN</Link></p>
        </section>

        <footer className="landing-footer"><Link href="/" className="landing-footer-brand">TRACK</Link><span>PERSONAL SYSTEM / DAY BY DAY</span><span>EST. 2026 <b>·</b> OPERATOR CONTROLLED</span></footer>
      </div>
    </main>
  );
}
