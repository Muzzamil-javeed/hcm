import { useEffect, useState } from "react";

export default function AnalogClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  const secondDeg = s * 6;
  const minuteDeg = m * 6 + s * 0.1;
  const hourDeg = h * 30 + m * 0.5;

  return (
    <div className="analog-clock">
      {[...Array(12)].map((_, i) => (
        <span key={i} className="tick" style={{ transform: `rotate(${i * 30}deg)` }} />
      ))}
      <div className="clock-center" />
      <div className="hand hour" style={{ transform: `rotate(${hourDeg}deg)` }} />
      <div className="hand minute" style={{ transform: `rotate(${minuteDeg}deg)` }} />
      <div className="hand second" style={{ transform: `rotate(${secondDeg}deg)` }} />
    </div>
  );
}
