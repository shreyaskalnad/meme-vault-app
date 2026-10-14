// Waveform bars for sound effects
export default function Wave({ item }) {
  let peaks = item.peaks;
  if (!peaks) {
    let h = 0;
    for (const c of item.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    peaks = Array.from({ length: 48 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(h + i * 1.7)));
  }
  return (
    <div className="wave">
      {peaks.map((v, i) => (
        <i key={i} style={{ height: Math.max(6, Math.round(v * 100)) + "%" }} />
      ))}
    </div>
  );
}
