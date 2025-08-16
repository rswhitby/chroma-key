// main.js

// ----- elements -----
const videoCam = document.getElementById("video-cam");
const canvas   = document.getElementById("output");
const ctx      = canvas.getContext("2d");
const buttons  = document.querySelectorAll("#controls button");

// Always rotate overlays by this angle (90 or -90). Set to 0 to disable.
const OVERLAY_ROTATE_DEG = 90;

const streams = {
  red:    document.getElementById("video-red"),
  green:  document.getElementById("video-green"),
  blue:   document.getElementById("video-blue"),
  yellow: document.getElementById("video-yellow"),
};

/*
// ----- your HLS URLs -----
const hlsStreams = {
  red: "https://stream.mux.com/KtpDUWnzBLkuBy6x2LNsnfGfMuL8n02EY3vwd8ySCoAQ.m3u8",
  green: "https://stream.mux.com/J01dKLQObHWBU9ex00kK5p00OT2MHFi5sXJum1wwLWTwRg.m3u8",
  blue: "https://stream.mux.com/rMcdMotmURzskzSV5ZI4w8x8LkIuXyalfGTWLb1DqvI.m3u8",
  yellow: "https://stream.mux.com/qAJ01jpHaXsLFRt7NDjfOboj3pOiZ5h5SHk6pKNt51tI.m3u8",
};

*/
// ----- your HLS URLs -----
const hlsStreams = {
  red: "https://stream2.ovationav.com/red.m3u8",
  green: "https://stream2.ovationav.com/green.m3u8",
  blue: "https://stream2.ovationav.com/blue.m3u8",
  yellow: "https://stream2.ovationav.com/yellow.m3u8",
};

// ----- init HLS on each overlay -----
Object.entries(streams).forEach(([color, video]) => {
  video.crossOrigin = "anonymous";
  video.muted        = true;
  video.playsInline  = true;
  video.loop         = true;

  const hls = new Hls();
  hls.loadSource(hlsStreams[color]);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(console.warn);
  });
});

// enabled flags + buttons
const enabled = { red: false, green: false, blue: false, yellow: false };

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    enabled[color] = !enabled[color];
    btn.classList.toggle("active", enabled[color]);

    const vid = streams[color];
    if (enabled[color]) {
      vid.muted = false;                // let audio through when active (optional)
      vid.play().catch(console.warn);
    } else {
      vid.pause();
      vid.muted = true;
    }
  });
});

// ----- camera -----
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } }
})
.then(camStream => {
  videoCam.srcObject = camStream;
  videoCam.play().catch(console.warn);

  videoCam.onloadedmetadata = () => {
    // size the internal canvas buffer to the CSS box for crisp rendering
    syncCanvasToCSS();
    if ('requestVideoFrameCallback' in videoCam) {
      videoCam.requestVideoFrameCallback(renderFrame);
    } else {
      requestAnimationFrame(renderFrame);
    }
  };
})
.catch(err => {
  console.error("Camera error:", err);
  alert(`Camera access failed: ${err.name}`);
});

// keep canvas pixels matching its CSS size
function syncCanvasToCSS() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth  * dpr || window.innerWidth  * dpr);
  const h = Math.round(canvas.clientHeight * dpr || window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener('resize', syncCanvasToCSS);
window.addEventListener('orientationchange', syncCanvasToCSS);

// ----- drawing helpers (cover fit + optional rotation) -----
function drawVideoCover(ctx, video, dstW, dstH, rotateDeg = 0) {
  const vw = video.videoWidth  || 0;
  const vh = video.videoHeight || 0;
  if (!vw || !vh) return;

  ctx.save();

  if (rotateDeg % 180 !== 0) {
    // rotate about canvas center
    ctx.translate(dstW / 2, dstH / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);

    // after rotation, width/height swap for cover math
    const scale = Math.max(dstW / vh, dstH / vw);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
  } else {
    const scale = Math.max(dstW / vw, dstH / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (dstW - dw) / 2;
    const dy = (dstH - dh) / 2;
    ctx.drawImage(video, dx, dy, dw, dh);
  }

  ctx.restore();
}

// ----- render loop -----
function renderFrame() {
  // 1) draw camera (no rotation)
  drawVideoCover(ctx, videoCam, canvas.width, canvas.height, 0);

  // 2) composite enabled overlays; rotate when landscape
  const overlayRotate = OVERLAY_ROTATE_DEG;  // always rotate by fixed angle
  
  for (const color in enabled) {
    if (enabled[color]) applyChroma(streams[color], thresholds[color], overlayRotate);
  }

  if ('requestVideoFrameCallback' in videoCam) {
    videoCam.requestVideoFrameCallback(renderFrame);
  } else {
    requestAnimationFrame(renderFrame);
  }
}

// ----- chroma key with rotated overlay -----
function applyChroma(srcVideo, t, rotateDeg) {
  const off = document.createElement("canvas");
  off.width  = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext("2d");

  // draw the overlay with cover-fit + optional rotation
  drawVideoCover(offCtx, srcVideo, off.width, off.height, rotateDeg);

  const bg = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ov = offCtx.getImageData(0, 0, off.width, off.height);

  for (let i = 0; i < bg.data.length; i += 4) {
    const r = bg.data[i], g = bg.data[i + 1], b = bg.data[i + 2];
    if (matchColor({ r, g, b }, t)) {
      bg.data[i]     = ov.data[i];
      bg.data[i + 1] = ov.data[i + 1];
      bg.data[i + 2] = ov.data[i + 2];
      bg.data[i + 3] = ov.data[i + 3];
    }
  }
  ctx.putImageData(bg, 0, 0);
}

// ----- thresholds (unchanged) -----
const thresholds = {
  red:    { hMin:340, hMax:15,  sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
  green:  { hMin:110,  hMax:170, sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
  blue:   { hMin:210, hMax:240, sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
  yellow: { hMin:25,  hMax:60,  sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
};

// ----- helpers -----
function matchColor({ r, g, b }, { hMin, hMax, sMin, sMax, vMin, vMax }) {
  const { h, s, v } = rgbToHsv(r / 255, g / 255, b / 255);
  const inHue = hMin <= hMax ? (h >= hMin && h <= hMax) : (h >= hMin || h <= hMax);
  return inHue && s >= sMin && s <= sMax && v >= vMin && v <= vMax;
}
function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = max ? d / max : 0, v = max;
  if (d) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { h, s, v };
}
