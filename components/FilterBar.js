"use client";

const TYPES = [["all", "All"], ["video", "🎬 Memes"], ["audio", "🔊 SFX"], ["image", "🖼 Images"]];

export default function FilterBar({ type, setType, favOnly, setFavOnly, untagged, setUntagged, untaggedCount, sort, setSort, shown, total }) {
  return (
    <div className="bar">
      <div className="seg">
        {TYPES.map(([t, label]) => (
          <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>{label}</button>
        ))}
      </div>
      <button className={`toggle${favOnly ? " on" : ""}`} onClick={() => setFavOnly(!favOnly)}>★ Favorites</button>
      <button className={`toggle warnish${untagged ? " on" : ""}`} onClick={() => setUntagged(!untagged)}>
        🏷 Untagged{untaggedCount ? ` (${untaggedCount})` : ""}
      </button>
      <select value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="best">Best match</option>
        <option value="new">Newest</option>
        <option value="least">Least used</option>
        <option value="most">Most used</option>
        <option value="name">Name A to Z</option>
      </select>
      <span className="count">{total ? `${shown} of ${total}` : ""}</span>
    </div>
  );
}
