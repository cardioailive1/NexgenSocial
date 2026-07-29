const mediasoup = require("mediasoup");

// One mediasoup Worker is a separate OS process handling media for however
// many rooms get assigned to it. A single worker comfortably handles many
// concurrent small-to-medium streams; add more (one per CPU core is the
// usual rule of thumb) and round-robin across them as you scale up.
const WORKER_COUNT = Number(process.env.MEDIASOUP_WORKER_COUNT || 1);

const RTC_MIN_PORT = Number(process.env.MEDIASOUP_RTC_MIN_PORT || 40000);
const RTC_MAX_PORT = Number(process.env.MEDIASOUP_RTC_MAX_PORT || 49999);

// The codecs every room's Router will support. VP8 is chosen for broad
// browser compatibility without extra licensing considerations (vs H264).
const mediaCodecs = [
  { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: { "x-google-start-bitrate": 1000 },
  },
];

let workers = [];
let nextWorkerIndex = 0;

async function initWorkers() {
  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: "warn",
      rtcMinPort: RTC_MIN_PORT,
      rtcMaxPort: RTC_MAX_PORT,
    });
    worker.on("died", () => {
      console.error(`mediasoup worker ${worker.pid} died -- exiting so the process manager restarts us`);
      setTimeout(() => process.exit(1), 1000);
    });
    workers.push(worker);
    console.log(`mediasoup worker ${i + 1}/${WORKER_COUNT} started (pid ${worker.pid})`);
  }
}

function getWorker() {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

module.exports = { initWorkers, getWorker, mediaCodecs };
