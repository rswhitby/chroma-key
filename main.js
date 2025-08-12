// main.js

// 1. Element references
const videoCam = document.getElementById("video-cam");
const canvas   = document.getElementById("output");
const ctx      = canvas.getContext("2d");
const buttons  = document.querySelectorAll("#controls button");

// 2. Overlay streams for each color
const streams = {
  red:    document.getElementById("video-red"),
  green:  document.getElementById("video-green"),
  blue:   document.getElementById("video-blue"),
  yellow: document.getElementById("video-yellow"),
};

// 3. HLS URLs
const hlsStreams = {
  red:    "https://stream1.ovationav.com/red",
  green:  "http://50.212.139.137/green.m3u8",
  blue:   "http://50.212.139.137/blue.m3u8",
  yellow: "http://50.212.139.137/yellow.m3u8",
};

// 4. Initialize Hls.js on each overlay
Object.entries(streams).forEach(([color, video]) => {
  // keep video in layout for iOS decoding
  video.crossOrigin = "anonymous";
  video.muted        = true;
  video.playsInline  = true;
  video.loop         = true;

  const hls = new Hls();
  hls.loadSource(hlsStreams[color]);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    // prime decoding
    video.play().catch(console.warn);
  });
});

// 5. Track enabled overlays
const enabled = { red: false, green: false, blue: false, yellow: false };

// 6. Wire up the toggle buttons
buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    enabled[color] = !enabled[color];
    btn.classList.toggle("active", enabled[color]);

    const vid = streams[color];
    if (enabled[color]) {
      // unmute on activation if desired
      vid.muted = false;
      vid.play().catch(console.warn);
    } else {
      vid.pause();
      vid.muted = true;
    }
  });
});

// 7. Start camera feed
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } }
})
.then(camStream => {
  videoCam.srcObject = camStream;
  videoCam.play().catch(console.warn);

  videoCam.onloadedmetadata = () => {
    canvas.width  = videoCam.videoWidth;
    canvas.height = videoCam.videoHeight;

    // use requestVideoFrameCallback on supported iOS
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

// 8. Render loop
function renderFrame() {
  ctx.drawImage(videoCam, 0, 0, canvas.width, canvas.height);

  // composite any enabled overlay
  for (const color in enabled) {
    if (enabled[color]) {
      applyChroma(streams[color], thresholds[color]);
    }
  }

  // schedule next frame
  if ('requestVideoFrameCallback' in videoCam) {
    videoCam.requestVideoFrameCallback(renderFrame);
  } else {
    requestAnimationFrame(renderFrame);
  }
}

// 9. Chroma-key routine
function applyChroma(srcVideo, t) {
  // offscreen draw
  const off = document.createElement("canvas");
  off.width  = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(srcVideo, 0, 0, off.width, off.height);

  const bg = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ov = offCtx.getImageData(0, 0, off.width, off.height);

  for (let i = 0; i < bg.data.length; i += 4) {
    const r = bg.data[i], g = bg.data[i+1], b = bg.data[i+2];
    if (matchColor({r, g, b}, t)) {
      bg.data[i]   = ov.data[i];
      bg.data[i+1] = ov.data[i+1];
      bg.data[i+2] = ov.data[i+2];
      bg.data[i+3] = ov.data[i+3];
    }
  }
  ctx.putImageData(bg, 0, 0);
}

// 10. HSV threshold ranges
const thresholds = {
  red:    { hMin:340, hMax:20,  sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
  green:  { hMin:70,  hMax:170, sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
  blue:   { hMin:190, hMax:270, sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
  yellow: { hMin:30,  hMax:80,  sMin:0.4, sMax:1, vMin:0.3, vMax:1 },
};

// 11. Color match helper
function matchColor({r, g, b}, {hMin, hMax, sMin, sMax, vMin, vMax}) {
  const {h, s, v} = rgbToHsv(r/255, g/255, b/255);
  const inHue = hMin <= hMax
    ? (h >= hMin && h <= hMax)
    : (h >= hMin || h <= hMax);
  return inHue && s>=sMin && s<=sMax && v>=vMin && v<=vMax;
}

// 12. RGB→HSV converter
function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = max ? d/max : 0, v = max;
  if (d) {
    switch (max) {
      case r: h = ((g - b)/d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r)/d + 2) * 60; break;
      case b: h = ((r - g)/d + 4) * 60; break;
    }
  }
  return {h, s, v};
}
