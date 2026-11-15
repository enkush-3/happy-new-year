import { useEffect, useState } from "react";
import { Link } from "react-router";
import { GAMES_PATH } from "../../app/routeMap";
import { calculateCountdown, type CountdownValue } from "../../features/countdown/countdown";

const countdownUnits: { key: keyof Pick<CountdownValue, "days" | "hours" | "minutes" | "seconds">; label: string }[] = [
  { key: "days", label: "хоног" },
  { key: "hours", label: "цаг" },
  { key: "minutes", label: "минут" },
  { key: "seconds", label: "секунд" },
];

export default function CountdownPage() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const countdown = calculateCountdown(now);

  return (
    <section className="countdown-page" aria-labelledby="countdown-title">
      <div className="countdown-hero">
        <p className="eyebrow"><span aria-hidden="true">✧</span> ШИНЭ ОНЫГ ХАМТДАА УГТАЯ <span aria-hidden="true">✧</span></p>
        {countdown.hasArrived ? (
          <>
            <h1 id="countdown-title">2027 он ирлээ!</h1>
            <p className="hero-copy">Шинэ ондоо аз жаргал, инээд хөөр дүүрэн байгаарай.</p>
          </>
        ) : (
          <>
            <h1 id="countdown-title">2027 он гарах хүртэл</h1>
            <p className="hero-copy">Шинэ жилийн баярын мөч ойртсоор…</p>
          </>
        )}
        <div className="countdown-grid" aria-label={countdown.hasArrived ? "2027 он ирсэн" : "2027 он хүртэлх үлдсэн хугацаа"}>
          {countdownUnits.map(({ key, label }) => (
            <div className="countdown-unit" key={key}>
              <span className="countdown-value" aria-live={key === "seconds" ? "off" : undefined}>
                {String(countdown[key]).padStart(2, "0")}
              </span>
              <span className="countdown-label">{label}</span>
            </div>
          ))}
        </div>
        <p className="timezone-note">Таны орон нутгийн цагаар тооцож байна</p>
        <Link to={GAMES_PATH} className="button button--primary hero-cta">
          Тоглоомууд үзэх <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="home-note-row">
        <div className="home-note-icon" aria-hidden="true">✦</div>
        <div>
          <h2>Баярын хүлээлтийг хөгжилтэй өнгөрүүлээрэй</h2>
          <p>Жижигхэн тоглоом тоглож, бүтээлээ найзуудтайгаа хуваалцаарай.</p>
        </div>
        <Link to={GAMES_PATH} className="text-link">Бүх тоглоом <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );
}
