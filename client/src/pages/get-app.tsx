import { useEffect, useState } from "react";
import { Apple, Download, Globe, Smartphone, type LucideIcon } from "lucide-react";
import { MarketingNav, MarketingFooter } from "@/components/landing/audience";
import {
  androidDownload,
  iosDownload,
  webApp,
  detectPlatform,
  type AppDownload,
  type AppPlatform,
} from "@/lib/app-downloads";

// /app — the download route. Deliberately thin: it exists to hand someone the
// right build for the device they're holding. The pitch lives on the landing
// page and the audience subpages.

interface PlatformCardProps {
  icon: LucideIcon;
  title: string;
  note: string;
  download: AppDownload;
  highlighted: boolean;
}

const PlatformCard = ({ icon: Icon, title, note, download, highlighted }: PlatformCardProps) => (
  <div
    className={`sketch-border sketch-shadow flex flex-col rounded-2xl bg-card p-7 ${
      highlighted ? "ring-2 ring-primary/40" : ""
    }`}
  >
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon size={22} />
      </div>
      <div>
        <h2 className="font-heading text-xl font-bold">{title}</h2>
        {highlighted && <p className="text-xs font-medium text-primary">You&apos;re on this one</p>}
      </div>
    </div>

    <p className="text-sm text-muted-foreground">{note}</p>

    <div className="mt-6 border-t border-border pt-6">
      {download.href ? (
        <a
          href={download.href}
          className="sketch-border sketch-shadow-yellow hover-tilt inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-heading text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <Download size={16} /> {download.cta}
        </a>
      ) : (
        <p className="text-sm leading-relaxed text-foreground/80">{download.pending}</p>
      )}
    </div>
  </div>
);

const GetAppPage = () => {
  // Read once on mount. This app is client-rendered only, so there is no
  // server/client hydration mismatch to guard against here.
  const [platform] = useState<AppPlatform>(detectPlatform);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20">
      <MarketingNav />

      <main className="flex-1 pt-16">
        <section className="py-16 md:py-20">
          <div className="container max-w-5xl">
            <div className="mb-12 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
                Get <span className="text-primary">Class Mode</span> on your phone
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                Same account as the web app. You&apos;ll need one from a school that already uses
                Class Mode — there&apos;s no public sign-up in the app.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <PlatformCard
                icon={Smartphone}
                title="Android"
                note="Ships first. Going out to pilot schools ahead of the Play Store listing."
                download={androidDownload}
                highlighted={platform === "android"}
              />
              <PlatformCard
                icon={Apple}
                title="iPhone"
                note="Follows Android. The web app covers iPhone in the meantime."
                download={iosDownload}
                highlighted={platform === "ios"}
              />
              <PlatformCard
                icon={Globe}
                title="Any browser"
                note="No install. Works on every phone, tablet, and desktop, today."
                download={webApp}
                highlighted={platform === "web"}
              />
            </div>

            <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
              Not at a Class Mode school yet?{" "}
              <a href="/#contact" className="font-medium text-primary hover:underline">
                Get in touch
              </a>{" "}
              and we&apos;ll set yours up.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default GetAppPage;
