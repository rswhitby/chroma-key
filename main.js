// main.js

// 1. Element references
const videoCam = document.getElementById("video-cam");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const buttons = document.querySelectorAll("#controls button");

// 2. Overlay streams for each color
const streams = {
  red: document.getElementById("video-red"),
  green: document.getElementById("video-green"),
  blue: document.getElementById("video-blue"),
  yellow: document.getElementById("video-yellow"),
};

// ===== HLS Setup for all 4 overlays =====
const hlsStreams = {
  red: "https://stream.mux.com/qbmLFMnR6yLLVQNDWxTd00xtWe00Prw02009Z01brhf4U8QE.m3u8",
  green:
    "https://stream.mux.com/3szftA95p4XgdnVx7kkj7OVkw28Ya9xj3Ps4eJsGziE.m3u8",
  blue: "https://stream.mux.com/yjwOhbdvbQhd2dejZsrOrS2F00At01zpSow3BJYchU7vQ.m3u8",
  yellow:
    "https://stream.mux.com/g00DWGCoz02YMASwERCbRvKDVbdKehBsP8sL02i4KZIGBY.m3u8",
};

for (const color in streams) {
  const video = streams[color];
  const hlsUrl = hlsStreams[color];

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.muted = true;
      video.playsInline = true;
      video.play().catch(console.warn); // ← ensure it starts decoding
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = hlsUrl;
    video.addEventListener("loadedmetadata", () => {
      video.muted = true;
      video.playsInline = true;
      video.play().catch(console.warn); // ← ensure it starts decoding
    });
  }
}

// 3. Track which colors are enabled
const enabled = { red: false, green: false, blue: false, yellow: false };

// 4. HSV threshold ranges for each chroma color
const thresholds = {
  red: { hMin: 340, hMax: 20, sMin: 0.4, sMax: 1, vMin: 0.3, vMax: 1 },
  green: { hMin: 70, hMax: 170, sMin: 0.4, sMax: 1, vMin: 0.3, vMax: 1 },
  blue: { hMin: 190, hMax: 270, sMin: 0.4, sMax: 1, vMin: 0.3, vMax: 1 },
  yellow: { hMin: 30, hMax: 80, sMin: 0.4, sMax: 1, vMin: 0.3, vMax: 1 },
};

// 5. Wire up the toggle buttons
buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    enabled[color] = !enabled[color];
    btn.classList.toggle("active", enabled[color]);

    /*
    if (enabled[color]) {
      streams[color].muted = true;
      streams[color].playsInline = true;
      streams[color].play().catch(console.warn);
    }
    */

    // Ensure the video will play once enabled
    if (enabled[color]) {
      streams[color].muted = false; //  Unmute on activation
      streams[color].playsInline = true;
      streams[color].play().catch(console.warn);
    } else {
      streams[color].pause(); // pause when disabled
      streams[color].muted = true; // Mute when inactive
    }
  });
});

// 6. Kick off playback for all overlays (muted + playsinline)
Object.values(streams).forEach((vid) => {
  vid.muted = true;
  vid.playsInline = true;
  vid.loop = true;
  vid.play().catch(console.warn); // ← start decoding right away
});

// 7. Start the camera feed
navigator.mediaDevices
  .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
  .then((stream) => {
    videoCam.srcObject = stream;
    videoCam.onloadedmetadata = () => {
      canvas.width = videoCam.videoWidth;
      canvas.height = videoCam.videoHeight;
      requestAnimationFrame(draw);
    };
  })
  .catch((err) => {
    console.error("Camera error:", err);
    alert(`Camera access failed: ${err.name}`);
  });

// 8. Main render loop: draw camera + any enabled chroma streams
function draw() {
  ctx.drawImage(videoCam, 0, 0, canvas.width, canvas.height);

  for (const color in enabled) {
    if (enabled[color]) {
      applyChroma(canvas, ctx, streams[color], thresholds[color]);
    }
  }

  requestAnimationFrame(draw);
}

// 9. Chroma-key routine: pixel-by-pixel replace
function applyChroma(canvas, ctx, srcVideo, t) {
  // Draw overlay offscreen
  const off = document.createElement("canvas");
  off.width = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(srcVideo, 0, 0, off.width, off.height);

  const bg = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ov = offCtx.getImageData(0, 0, off.width, off.height);

  for (let i = 0; i < bg.data.length; i += 4) {
    const r = bg.data[i],
      g = bg.data[i + 1],
      b = bg.data[i + 2];
    if (matchColor({ r, g, b }, t)) {
      bg.data[i] = ov.data[i];
      bg.data[i + 1] = ov.data[i + 1];
      bg.data[i + 2] = ov.data[i + 2];
      bg.data[i + 3] = ov.data[i + 3];
    }
  }

  ctx.putImageData(bg, 0, 0);
}

// 10. Check if a pixel falls within the HSV range
function matchColor({ r, g, b }, { hMin, hMax, sMin, sMax, vMin, vMax }) {
  const { h, s, v } = rgbToHsv(r / 255, g / 255, b / 255);
  const inHue = hMin <= hMax ? h >= hMin && h <= hMax : h >= hMin || h <= hMax; // wrap-around for red
  return inHue && s >= sMin && s <= sMax && v >= vMin && v <= vMax;
}

// 11. Convert RGB [0–1] to HSV (h in [0–360], s/v in [0–1])
function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s = max === 0 ? 0 : 1 - min / max,
    v = max;
  const d = max - min;

  if (d === 0) {
    h = 0;
  } else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, v };
}
