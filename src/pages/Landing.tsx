import { Link } from "react-router-dom";
import { type ReactNode, type ComponentType } from "react";
import {
  ArrowRight,
  Sparkles,
  Play,
  Music2,
  Zap,
  Camera,
  Flame,
  HelpCircle,
  MoreHorizontal,
  MessageCircleQuestion,
  ShieldCheck,
  Lock,
  PhoneOff,
  KeyRound,
  Mic,
  Video,
  PhoneOff as Hangup,
  Twitter,
  Instagram,
  Mail,
} from "lucide-react";

/**
 * Marketing landing — a faithful port of date-room-escape.lovable.app.
 * Structure/copy mirror the Lovable source; styling uses lp-prefixed helpers
 * (.lp-display / .lp-eyebrow / .lp-btn / .lp-link / .lp-glow / .lp-vignette in
 * index.css) and the warm `lp*` palette (tailwind.config). Action CTAs route
 * to /auth; in-page links use section anchors.
 */

const START = "/auth"; // sign-in funnels every room/purchase action

function Wordmark({ size = "text-xl" }: { size?: string }) {
  return (
    <a href="#top" className="group flex items-center gap-2.5">
      <img src="/dateroom-logo.png" alt="DateRoom" width={32} height={32} className="h-8 w-8 rounded-md object-contain" />
      <span className={`lp-serif italic ${size} tracking-tight text-lpcream`}>DateRoom</span>
    </a>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>;
}

export default function Landing() {
  return (
    <div id="top" className="lp min-h-screen bg-lpbg text-lpcream">
      {/* Banner */}
      <a href="#couples" className="block w-full border-b border-lpborder/40 bg-[oklch(0.13_0.01_40)]">
        <div className="mx-auto max-w-7xl px-6 py-2.5 text-center text-[13px] text-lpmuted">
          Already have your people? Meet the room that stays open{" "}
          <ArrowRight className="ml-1 -mt-0.5 inline h-3.5 w-3.5 text-lppeach" />
        </div>
      </a>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-lpborder/40 bg-lpbg/75 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
          <Wordmark />
          <ul className="hidden items-center gap-8 text-sm text-lpmuted md:flex">
            <li><a href="#how" className="transition hover:text-lpcream">How it works</a></li>
            <li><a href="#inside" className="transition hover:text-lpcream">Inside the room</a></li>
            <li><a href="#couples" className="transition hover:text-lpcream">For couples</a></li>
            <li><a href="#friends" className="transition hover:text-lpcream">For friends</a></li>
            <li><a href="#pricing" className="transition hover:text-lpcream">Pricing</a></li>
          </ul>
          <Link to={START} className="lp-btn !px-5 !py-2.5 text-sm">Create a room</Link>
        </nav>
      </header>

      {/* Section 1 — Hero */}
      <section className="lp-vignette relative overflow-hidden">
        <img src="/lov/hero-candlelit.jpg" alt="Candlelit dinner table with a tablet showing a video date" width={1920} height={1280} className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-32 pt-28 md:pb-48 md:pt-40">
          <div className="max-w-2xl">
            <Eyebrow>Before the phone number</Eyebrow>
            <h1 className="lp-display mt-6 text-5xl text-lpcream md:text-7xl lg:text-8xl">
              Date them before<br />you date them.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-lpcream/85 md:text-xl">
              A private room you share with a six-digit code. No phone numbers. No awkward exchange. Just enough to know if it's worth meeting in real life.
            </p>
            <p className="lp-serif mt-5 text-xl italic text-lppeachsoft md:text-2xl">Not a video call. A date.</p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link to={START} className="lp-btn">Create your room</Link>
              <a href="#how" className="lp-link">See how it works</a>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Why this exists */}
      <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-28 md:grid-cols-2 md:py-40">
        <div>
          <Eyebrow>Why this exists</Eyebrow>
          <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">
            Dating got expensive.<br />In every sense.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-lpmuted">
            First dates now cost a hundred bucks before the second drink. And the price of being wrong is higher: a number you can't take back, texts that won't stop, a stranger who knows where to find you.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-lpmuted">
            There should be a step between matching and meeting. A safer one. There wasn't. Now there is.
          </p>
        </div>
        <div className="relative">
          <img src="/lov/why-laptop.jpg" alt="A laptop glowing beside a single candle on dark wood" width={1280} height={1280} loading="lazy" className="lp-glow aspect-square w-full rounded-2xl object-cover" />
        </div>
      </section>

      {/* Section 3 — How it works */}
      <section id="how" className="border-t border-lpborder/40 bg-[oklch(0.14_0.012_40)]">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">Three steps. Nothing to download.</h2>
          </div>

          {/* Room mockup */}
          <div className="lp-glow mx-auto mt-16 max-w-4xl rounded-3xl border border-lpborder bg-[oklch(0.12_0.01_40)] p-5 md:p-7">
            <div className="flex items-center justify-between text-xs text-lpmuted">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.55_0.18_25)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.14_75)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.70_0.14_140)]" />
              </div>
              <div className="font-mono tracking-[0.3em] text-lpcream/80">ROOM · 668 890</div>
              <div className="text-[11px] uppercase tracking-widest text-lppeach">live</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              {["She", "He"].map((label, i) => (
                <div key={label} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-lpborder bg-gradient-to-br from-[oklch(0.22_0.02_40)] to-[oklch(0.10_0.01_40)]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="h-24 w-24 rounded-full opacity-70"
                      style={{
                        background:
                          i === 0
                            ? "radial-gradient(circle at 35% 30%, oklch(0.85 0.08 55), oklch(0.45 0.05 40))"
                            : "radial-gradient(circle at 60% 35%, oklch(0.75 0.06 50), oklch(0.30 0.04 40))",
                      }}
                    />
                  </div>
                  <div className="lp-serif absolute bottom-3 left-3 text-xs italic text-lpcream/80">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center gap-4">
              {[Mic, Video, Hangup].map((Icon, i) => (
                <button
                  key={i}
                  type="button"
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${i === 2 ? "bg-[oklch(0.55_0.18_25)] text-lpcream" : "bg-lppeach text-lpbg"}`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-20 grid gap-10 md:grid-cols-3">
            {[
              { n: "01", t: "Create the room.", d: "A six-digit code lands in your hand. Add an optional PIN if you want extra cover." },
              { n: "02", t: "Share the code.", d: "Drop it in any DM. The other side opens it on the app or in any browser." },
              { n: "03", t: "Open the door.", d: "Twenty minutes, an hour, whatever you booked. The room dissolves when you're done." },
            ].map((s) => (
              <div key={s.n}>
                <div className="lp-serif text-3xl italic text-lppeach">{s.n}</div>
                <h3 className="lp-display mt-3 text-2xl text-lpcream">{s.t}</h3>
                <p className="mt-3 leading-relaxed text-lpmuted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Inside the room */}
      <section id="inside" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
        <div className="max-w-3xl">
          <Eyebrow>Why this beats FaceTime</Eyebrow>
          <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">
            Built for the part of dating that's actually hard: the first hour.
          </h2>
          <p className="mt-6 text-lg text-lpmuted">Awkward silences kill chemistry. The room comes with things to do.</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: MessageCircleQuestion, t: "The Deck", d: "Real questions, not small talk. Two hundred and fifty prompts that get past the weather." },
            { Icon: Play, t: "Watch Together", d: "A YouTube clip, a stand-up set, a trailer. Synced down to the second." },
            { Icon: Music2, t: "Synced DJ", d: "Play her the song. Play him the song back. Watch each other react." },
            { Icon: Zap, t: "This or That", d: "Rapid-fire choices. The fastest way to find out you both hate camping." },
            { Icon: Camera, t: "Capture", d: "A photo of the two of you, taken at the same moment from two cities. The only thing you keep." },
            { Icon: Flame, t: "Truth or Dare", d: "Couple-safe by default. Tiered, so you choose how brave the room gets." },
            { Icon: HelpCircle, t: "Two Truths and a Lie", d: "The classic. Now with a partner who can't quite read your face through the candlelight." },
            { Icon: MoreHorizontal, t: "More coming", d: "Karaoke, the 36 Questions, Couple's Trivia, Draw and Guess. The next wave." },
          ].map(({ Icon, t, d }) => (
            <article key={t} className="group relative overflow-hidden rounded-2xl border border-lpborder bg-lpcard p-6 transition hover:border-lppeach/40">
              <div
                className="absolute inset-0 opacity-25 transition group-hover:opacity-40"
                style={{ background: "radial-gradient(circle at 80% 0%, oklch(0.62 0.14 50 / 0.55), transparent 60%)" }}
              />
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-lppeach/30 bg-lppeach/15">
                  <Icon className="h-5 w-5 text-lppeach" />
                </div>
                <h3 className="lp-display mt-8 text-2xl text-lpcream">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-lpmuted">{d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Section 5 — One room. Every app. */}
      <section className="lp-vignette relative overflow-hidden border-y border-lpborder/40">
        <img src="/lov/phone-code.jpg" alt="A phone showing a 6-digit code by candlelight" width={1280} height={1280} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:py-40">
          <div className="max-w-2xl">
            <Eyebrow>Why this works</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">One room. Every app.</h2>
            <p className="mt-8 text-lg leading-relaxed text-lpcream/85">
              Most daters keep three or four apps open at once. Tinder, Bumble, Hinge, all running at the same time. None of them will ever build a room that works across the others. DateRoom does.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-lpcream/85">
              The room is yours. Drop the code in whichever DM matters tonight. The next match opens the same room. You bring the room. Matches come to it.
            </p>
            <div className="mt-10 flex gap-3 text-xs uppercase tracking-[0.25em] text-lpmuted">
              <span className="rounded-full border border-lpborder/60 px-3 py-1.5">Tinder</span>
              <span className="rounded-full border border-lpborder/60 px-3 py-1.5">Bumble</span>
              <span className="rounded-full border border-lpborder/60 px-3 py-1.5">Hinge</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6 — For couples */}
      <section id="couples" className="relative overflow-hidden">
        <img src="/lov/couples-morning.jpg" alt="Warm morning light through curtains onto a rumpled bed" width={1920} height={1080} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, oklch(0.18 0.02 50 / 0.92) 0%, oklch(0.18 0.02 50 / 0.55) 60%, transparent 100%)" }} />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:py-40">
          <div className="max-w-xl">
            <Eyebrow>Already yours?</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">A room that stays open.</h2>
            <p className="mt-8 text-lg leading-relaxed text-lpcream/85">
              When you live in different cities. When one of you is on the road. When you live in the same house but the kids are everywhere. Keep a room. Pin a vision board. Leave each other notes. Watch a movie at the same time from two time zones. Make the walls yours. It stays open as long as you want it to.
            </p>
            <Link to={START} className="lp-btn mt-10">Open a Together room</Link>
          </div>
        </div>
      </section>

      {/* Section 7 — For friends */}
      <section id="friends" className="relative overflow-hidden">
        <img src="/lov/friends-evening.jpg" alt="Cozy living room with a laptop showing a group video call" width={1920} height={1080} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(270deg, oklch(0.18 0.02 50 / 0.92) 0%, oklch(0.18 0.02 50 / 0.55) 60%, transparent 100%)" }} />
        <div className="relative z-10 mx-auto flex max-w-7xl justify-end px-6 py-28 md:py-40">
          <div className="max-w-xl">
            <Eyebrow>Or bring the group</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">Closer than the group chat.</h2>
            <p className="mt-8 text-lg leading-relaxed text-lpcream/85">
              Best friends in three different cities. Sisters in different countries. The book club that lives across time zones. Up to five of you in one room. Watch a movie at the same time. Play the deck. Argue about whose turn it is on the DJ. The group chat, but you can actually see each other.
            </p>
            <Link to={START} className="lp-btn mt-10">Open a room with friends</Link>
          </div>
        </div>
      </section>

      {/* Section 8 — Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">Pick the room that fits.</h2>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {[
            { name: "Try", price: "Free", unit: "one date · 20 min", desc: "Ad-supported.", cta: "Start free" },
            { name: "Date Pack", price: "$5", unit: "three dates · 1 hour each", desc: "For the early matches.", cta: "Get the pack" },
            { name: "Long Pack", price: "$10", unit: "five dates · 2 hours each", desc: "For the ones with potential.", cta: "Get the pack" },
          ].map((p) => (
            <PricingCard key={p.name} {...p} />
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <PricingCard name="Together" price="$20" unit="/ month · for two" desc="A room that stays open. Custom walls. Unlimited everything." cta="Open Together" featured />
          <PricingCard name="Crew" price="$25" unit="/ month · up to five" desc="Movie nights, game nights, book clubs, group hangs. Room for more chairs." cta="Open Crew" featured />
        </div>
      </section>

      {/* Section 9 — App badges */}
      <section className="mx-auto max-w-7xl px-6 pb-20 text-center">
        <p className="lp-serif text-2xl italic text-lpcream">Coming soon to your pocket.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {[
            { top: "Coming soon on", bot: "App Store" },
            { top: "Coming soon on", bot: "Google Play" },
          ].map((b) => (
            <div key={b.bot} className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-lpborder bg-lpcard/60 px-6 py-3 text-left opacity-70">
              <Sparkles className="h-6 w-6 text-lpmuted" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-lpmuted">{b.top}</div>
                <div className="lp-serif text-lg italic text-lpcream">{b.bot}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 10 — Trust strip */}
      <section className="border-y border-lpborder/40 bg-[oklch(0.14_0.012_40)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8 text-sm text-lpcream/85">
          {[
            { Icon: ShieldCheck, t: "Date safer." },
            { Icon: PhoneOff, t: "No phone numbers exchanged." },
            { Icon: KeyRound, t: "Code plus optional PIN." },
            { Icon: Lock, t: "End-to-end encrypted." },
          ].map(({ Icon, t }) => (
            <div key={t} className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-lppeach" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 11 — Final CTA */}
      <section id="cta" className="lp-vignette relative overflow-hidden">
        <img src="/lov/final-door.jpg" alt="An open door with warm light spilling into a dark room" width={1920} height={1080} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-36 text-center md:py-48">
          <h2 className="lp-display text-5xl text-lpcream md:text-7xl">Open the door.</h2>
          <p className="mt-8 text-lg text-lpcream/85">Two minutes to make a room. The next move is theirs.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            <Link to={START} className="lp-btn">Create an account</Link>
            <a href="#pricing" className="lp-link">View pricing plans</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-lpborder/40 bg-[oklch(0.13_0.01_40)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark size="text-2xl" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-lpmuted">
              We're on a mission to bring intentionality and safety to the part of dating no one designed: the space between a match and a meeting.
            </p>
            <p className="lp-serif mt-5 italic text-lppeachsoft">The room before the phone number.</p>
          </div>

          <FooterCol title="Product" links={["Features", "Pricing", "How it works"]} />
          <FooterCol title="Company" links={["About us", "Privacy", "Terms"]} />
          <FooterCol title="Connect" links={["Twitter", "Instagram", "Contact"]} icons={[Twitter, Instagram, Mail]} />
        </div>
        <div className="border-t border-lpborder/40">
          <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-lpmuted">© DateRoom, {new Date().getFullYear()}.</div>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({ name, price, unit, desc, cta, featured }: { name: string; price: string; unit: string; desc: string; cta: string; featured?: boolean }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-7 ${featured ? "border-lppeach/40 bg-gradient-to-b from-[oklch(0.22_0.03_50)] to-lpcard" : "border-lpborder bg-lpcard"}`}>
      <div className="text-sm uppercase tracking-widest text-lppeach">{name}</div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="lp-display text-5xl text-lpcream">{price}</span>
        <span className="text-sm text-lpmuted">{unit}</span>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-lpmuted">{desc}</p>
      <Link to={START} className="lp-btn mt-8 self-start text-sm">{cta}</Link>
    </div>
  );
}

function FooterCol({ title, links, icons }: { title: string; links: string[]; icons?: Array<ComponentType<{ className?: string }>> }) {
  return (
    <div>
      <div className="lp-eyebrow !text-lpmuted">{title}</div>
      <ul className="mt-5 space-y-3 text-sm text-lpcream/85">
        {links.map((l, i) => {
          const Icon = icons?.[i];
          return (
            <li key={l}>
              <a href="#" className="inline-flex items-center gap-2 transition hover:text-lppeach">
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {l}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
