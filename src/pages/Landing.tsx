import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  MessageSquare, 
  Music, 
  Video, 
  Camera, 
  Heart, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/constants";
import { PageShell } from "@/components/PageShell";

export default function Landing() {
  return (
    <PageShell orbs={false} vignette={false} grain={false} className="bg-transparent">
      {/* Fixed full-bleed hero art — focal point sits slightly right of center (tablet / video call) */}
      <div className="fixed inset-0 z-[-20] overflow-hidden">
        <img
          src="/hero-virtual-date-rose-petals.png"
          alt=""
          className="h-full w-full min-h-[100dvh] object-cover animate-fade-in-slow object-[54%_44%] sm:object-[56%_46%] md:object-[58%_48%] xl:object-[60%_48%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/35 to-background/90" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)_/_0.5)_120%)]" />
      </div>

      {/* Dynamic Ambient Background */}
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-primary/10 rounded-full blur-[120px] -z-10 animate-breathe" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-rosegold/10 rounded-full blur-[120px] -z-10 animate-pulse-glow" />
      <div className="fixed top-[40%] left-[20%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-champagne/5 rounded-full blur-[100px] -z-10 animate-[breathe_7s_ease-in-out_infinite]" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[60] px-6 py-6 flex items-center justify-between glass-subtle backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5 group cursor-pointer select-none">
          <BrandLogoImage />
          <span className="font-serif italic text-2xl tracking-wide text-cream font-semibold transition-colors duration-300 group-hover:text-rosegold">{BRAND_NAME}</span>
        </div>
        <div className="hidden md:flex items-center gap-10">
          <a href="#features" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition-colors">Features</a>
          <a href="#about" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition-colors">How it works</a>
          <Link to="/pricing" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition-colors">Pricing</Link>
        </div>
        <Link to="/auth?mode=signin" className="btn-secondary py-2.5 px-6 text-sm">
          Log in
        </Link>
      </nav>

      <div className="relative z-[1] flex min-h-[100dvh] w-full flex-col">
        {/* Hero Section */}
        <main className="flex flex-1 flex-col">
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6">
        {/* Hero-only accents (photo is fixed behind whole page — avoids stacking two copies) */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="absolute top-[10%] left-[15%] w-[45vw] h-[45vw] bg-rosegold/18 rounded-full blur-[140px] mix-blend-screen animate-pulse-glow" />
          <div className="absolute bottom-[20%] right-[15%] w-[40vw] h-[40vw] bg-champagne/14 rounded-full blur-[120px] mix-blend-color-dodge animate-breathe" />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/35" />
        </div>

        <div className="relative z-10 max-w-4xl text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-subtle text-[10px] uppercase tracking-[0.3em] text-rosegold mb-4">
            <Sparkles className="w-3 h-3" />
            A new way to connect
          </div>
          <h1 className="text-5xl md:text-8xl font-serif italic gradient-text leading-[1.1]">
            {BRAND_TAGLINE}
          </h1>
          <p className="text-lg md:text-xl text-cream/70 max-w-2xl mx-auto font-light leading-relaxed">
            Structured virtual dates that spark real conversation. After the match, before you meet. Keep long-distance partners connected between visits.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link to="/auth" className="btn-primary flex items-center gap-2">
              Start your first date <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="btn-secondary">
              See the activities
            </a>
          </div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-40 animate-bounce">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-cream/50" />
          <span className="text-[10px] uppercase tracking-[0.4em] rotate-90 mb-4">Scroll</span>
        </div>
      </section>

      {/* Narrative Section */}
      <section id="about" className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-10 animate-fade-in">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-serif italic text-cream leading-tight">
                The space between <br /> matching and meeting.
              </h2>
              <div className="w-20 h-px bg-rosegold" />
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Dating apps are great for discovery, but the transition to real life is often clumsy. {BRAND_NAME} provides a structured environment to truly get to know someone beyond the text bubble.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Heart className="text-rosegold w-6 h-6" />
                <h3 className="text-cream font-serif italic text-xl">Deep Connection</h3>
                <p className="text-sm text-muted-foreground">Move past small talk with 250+ curated conversation prompts.</p>
              </div>
              <div className="space-y-3">
                <ShieldCheck className="text-rosegold w-6 h-6" />
                <h3 className="text-cream font-serif italic text-xl">Privacy First</h3>
                <p className="text-sm text-muted-foreground">End-to-end encrypted rooms that expire 24h after your session.</p>
              </div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative glass-strong rounded-[2.5rem] p-4 card-shadow overflow-hidden aspect-video">
              <video 
                src="/date-laughing.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="rounded-[2rem] w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none rounded-[2.5rem]" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="py-32 px-6 relative bg-black/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto text-center space-y-6 mb-20">
          <h2 className="text-4xl md:text-6xl font-serif italic text-cream">Everything for a perfect evening.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-light">Five curated activities seamlessly synced between you and your partner. No awkward pauses, just flow.</p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<MessageSquare className="w-6 h-6" />}
            title="The Deck"
            description="250+ prompts across four levels of intimacy. Skip the small talk and dive deep."
            image="/card-deck.png"
          />
          <FeatureCard 
            icon={<Music className="w-6 h-6" />}
            title="Synced DJ"
            description="Take turns choosing the soundtrack. Shared music, synchronized playback."
            image="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800"
          />
          <FeatureCard 
            icon={<Video className="w-6 h-6" />}
            title="Watch Together"
            description="Bring your favorite YouTube clips and enjoy them in real-time together."
            image="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=800"
          />
          <FeatureCard 
            icon={<Sparkles className="w-6 h-6" />}
            title="This or That"
            description="Fast-paced prompts to reveal your core similarities and quirky differences."
            image="/hero-date.png"
          />
          <FeatureCard 
            icon={<Camera className="w-6 h-6" />}
            title="Capture"
            description="A shared polaroid moment. Take a selfie together to remember the night."
            image="/lobby-hero.png"
          />
          <FeatureCard 
            icon={<Sparkles className="w-6 h-6" />}
            title="More coming soon."
            description="We're constantly crafting new ways to share a little space."
            image="/premium-bg.png"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-30" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-10">
          <h2 className="text-5xl md:text-7xl font-serif italic text-cream leading-tight">
            Ready to open the door?
          </h2>
          <p className="text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
            Invite your match or your partner to a space that belongs only to the two of you. 
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/auth" className="btn-primary flex items-center gap-3 text-lg px-10">
              Create an account <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/pricing" className="text-cream hover:text-rosegold transition-colors flex items-center gap-2 group tracking-widest text-xs uppercase">
              View Pricing Plans <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
        </main>

      {/* Footer — mt-auto pins to viewport bottom when content is short; solid scrim separates from hero art */}
      <footer className="relative z-20 mt-auto border-t border-white/10 bg-background/88 py-16 px-6 shadow-[0_-24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-3.5">
              <BrandLogoImage />
              <span className="font-serif italic text-2xl font-semibold tracking-wide text-cream">{BRAND_NAME}</span>
            </div>
            <p className="text-muted-foreground max-w-sm font-light">
              We're on a mission to bring intentionality and intimacy back to the digital dating experience.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] uppercase tracking-[0.3em] text-rosegold">Product</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-cream transition-colors">Features</a></li>
              <li><Link to="/pricing" className="hover:text-cream transition-colors">Pricing</Link></li>
              <li><a href="#" className="hover:text-cream transition-colors">Security</a></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] uppercase tracking-[0.3em] text-rosegold">Company</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-cream transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-cream transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-cream transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-muted-foreground/50 text-xs">
            <span>Made with love for the digital-first generation.</span>
          </div>
        </div>
      </footer>
      </div>
    </PageShell>
  );
}

function BrandLogoImage() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent p-0">
      <img
        src="/logo.png"
        alt=""
        className="h-full w-full scale-[1.05] object-cover drop-shadow-[0_0_8px_rgba(212,130,106,0.35)]"
      />
    </div>
  );
}

function FeatureCard({ icon, title, description, image }: { icon: React.ReactNode, title: string, description: string, image: string }) {
  return (
    <div className="group relative overflow-hidden rounded-[2.5rem] glass card-shadow border-white/5 hover:border-white/20 transition-all duration-500">
      <div className="aspect-[4/5] overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>
      <div className="absolute inset-0 p-8 flex flex-col justify-end space-y-4">
        <div className="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="space-y-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
          <h3 className="text-2xl font-serif italic text-cream">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
