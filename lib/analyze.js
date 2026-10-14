// Reads a file before upload: thumbnail, duration, and waveform for sounds.

export function videoMeta(file) {
  return new Promise((res) => {
    const v = document.createElement("video"), url = URL.createObjectURL(file);
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true; v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); res(r);
    };
    v.muted = true; v.preload = "auto"; v.playsInline = true;
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.6, (v.duration || 1) / 3); };
    v.onseeked = () => {
      try {
        const w = 240, h = Math.round((w * (v.videoHeight || 135)) / (v.videoWidth || 240));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(v, 0, 0, w, h);
        finish({ thumb: c.toDataURL("image/jpeg", 0.62), duration: v.duration });
      } catch { finish({ thumb: null, duration: v.duration }); }
    };
    v.onerror = () => finish({ thumb: null, duration: null });
    setTimeout(() => finish({ thumb: null, duration: isFinite(v.duration) ? v.duration : null }), 8000);
    v.src = url;
  });
}

export function imageMeta(file) {
  return new Promise((res) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const w = 240, h = Math.round((w * img.naturalHeight) / img.naturalWidth) || 135;
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        res({ thumb: c.toDataURL("image/jpeg", 0.65) });
      } catch { res({ thumb: null }); }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res({ thumb: null }); };
    img.src = url;
  });
}

export async function audioMeta(file) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0), N = 48, step = Math.max(1, Math.floor(data.length / N)), peaks = [];
    for (let i = 0; i < N; i++) {
      let m = 0;
      const end = Math.min((i + 1) * step, data.length);
      for (let j = i * step; j < end; j += 8) { const a = Math.abs(data[j]); if (a > m) m = a; }
      peaks.push(m);
    }
    const mx = Math.max(...peaks, 0.01);
    return { peaks: peaks.map((p) => Math.round((p / mx) * 100) / 100), duration: buf.duration };
  } finally {
    try { ctx.close(); } catch {}
  }
}
