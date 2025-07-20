# Live Chroma Key Overlay Viewer

This project is a browser-based video viewer that overlays live chroma-keyed video streams on top of a user's webcam feed. It is designed to pull in **four separate live HLS video streams** (red, green, blue, yellow) and composite them in real time using HTML5 Canvas and JavaScript.

---

## 🔧 How It Works

- The user’s webcam is displayed in the background.
- Each live stream is keyed by color and only visible where its corresponding color appears in the webcam feed.
- The overlays are controlled by buttons to toggle red, green, blue, and yellow layers on/off.
- Streams are pulled in via [HLS.js](https://github.com/video-dev/hls.js) and rendered with real-time chroma key masking.

---

## 🖥️ Live Streams

The video streams are hosted via [Mux](https://mux.com). Each stream is published using [OBS](https://obsproject.com/) or another RTMP-compatible encoder.

| Stream | OBS RTMP Config                  | HLS Playback URL                              |
|--------|-----------------------------------|------------------------------------------------|
| Red    | `rtmp://global-live.mux.com:5222/app`<br>Key: *stream_key_red* | `https://stream.mux.com/<playback_id_red>.m3u8` |
| Green  | `...`                             | `https://stream.mux.com/<playback_id_green>.m3u8` |
| Blue   | `...`                             | `https://stream.mux.com/<playback_id_blue>.m3u8` |
| Yellow | `...`                             | `https://stream.mux.com/<playback_id_yellow>.m3u8` |

> NOTE: You'll need to configure these in `main.js` under the `hlsUrls` object.

---

## 📦 Files

- `index.html` – Main frontend interface
- `main.js` – Core JavaScript logic (HLS setup, chroma key masking, webcam, overlay control)
- `style.css` – (optional) For custom styling

---
