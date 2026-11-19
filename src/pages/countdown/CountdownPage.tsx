import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { GAMES_PATH } from "../../app/routeMap";
import UiIcon from "../../components/ui/UiIcon";
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
      <div className="countdown-hero ui-card">
        <p className="eyebrow ui-stagger-in" style={{ "--i": 0 } as CSSProperties}><span aria-hidden="true">✧</span> ШИНЭ ОНЫГ ХАМТДАА УГТАЯ <span aria-hidden="true">✧</span></p>
        {countdown.hasArrived ? (
          <>
            <h1 className="ui-stagger-in" style={{ "--i": 1 } as CSSProperties} id="countdown-title">2027 он ирлээ!</h1>
            <p className="hero-copy ui-stagger-in" style={{ "--i": 2 } as CSSProperties}>Шинэ ондоо аз жаргал, инээд хөөр дүүрэн байгаарай.</p>
          </>
        ) : (
          <>
            <h1 className="ui-stagger-in" style={{ "--i": 1 } as CSSProperties} id="countdown-title">
              2027 он <span className="countdown-title__phrase">гарах хүртэл</span>
            </h1>
            <p className="hero-copy ui-stagger-in" style={{ "--i": 2 } as CSSProperties}>Шинэ жилийн баярын мөч ойртсоор…</p>
          </>
        )}
        <div className="countdown-grid ui-stagger-in" style={{ "--i": 3 } as CSSProperties} aria-label={countdown.hasArrived ? "2027 он ирсэн" : "2027 он хүртэлх үлдсэн хугацаа"}>
          {countdownUnits.map(({ key, label }) => (
            <div className="countdown-unit" key={key}>
              <span className="countdown-value" aria-live={key === "seconds" ? "off" : undefined}>
                {String(countdown[key]).padStart(2, "0")}
              </span>
              <span className="countdown-label">{label}</span>
            </div>
          ))}
        </div>
        <p className="timezone-note ui-stagger-in" style={{ "--i": 4 } as CSSProperties}>Таны орон нутгийн цагаар тооцож байна</p>
        <Link to={GAMES_PATH} className="button button--primary hero-cta ui-btn ui-stagger-in" style={{ "--i": 5 } as CSSProperties}>
          Тоглоомууд үзэх <UiIcon name="arrow-right" size={18} />
        </Link>
      </div>
    </section>
  );
}
