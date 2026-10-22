"use client";

export class CaptureError extends Error {
  constructor(public code: "mic-denied" | "mic-missing" | "share-cancelled" | "share-no-audio" | "unsupported" | "worklet", message: string) {
    super(message);
  }
}

export interface CaptureHandles {
  ctx: AudioContext;
  micStream: MediaStream;
  tabStream?: MediaStream;
  stop: () => void;
}

export function isCaptureSupported() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!navigator.mediaDevices?.getDisplayMedia && !!(window.AudioContext || (window as any).webkitAudioContext);
}

export async function getMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false,
    });
  } catch (e: any) {
    if (e?.name === "NotAllowedError" || e?.name === "SecurityError") throw new CaptureError("mic-denied", "Microphone access was blocked. Click the lock icon in the address bar, allow the microphone, then try again.");
    if (e?.name === "NotFoundError") throw new CaptureError("mic-missing", "No microphone was found. Plug in a headset and try again.");
    throw new CaptureError("unsupported", `Could not open the microphone: ${e?.message ?? e}`);
  }
}

/** Asks the user to share the Google Meet (or any call) tab WITH audio. Video track is dropped immediately. */
export async function getTabAudio(): Promise<MediaStream> {
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 1, width: 320, height: 180 },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      systemAudio: "include",
      surfaceSwitching: "include",
    } as any);
  } catch (e: any) {
    if (e?.name === "NotAllowedError" || e?.name === "AbortError") throw new CaptureError("share-cancelled", "Tab sharing was cancelled. Pick the Google Meet tab and tick “Share tab audio”.");
    throw new CaptureError("unsupported", `Could not share the call tab: ${e?.message ?? e}`);
  }
  display.getVideoTracks().forEach((t) => t.stop());
  const audio = display.getAudioTracks();
  if (audio.length === 0) {
    display.getTracks().forEach((t) => t.stop());
    throw new CaptureError("share-no-audio", "The shared tab has no audio. Choose the “Chrome Tab” option (not Window or Screen) and tick “Share tab audio”.");
  }
  return new MediaStream(audio);
}

/**
 * Builds the audio graph: mic -> ch0, tab -> ch1 -> PCM worklet. Calls onFrame with interleaved Int16 PCM (16 kHz, 2 ch).
 */
export async function startGraph(opts: {
  mic: MediaStream;
  tab?: MediaStream;
  onFrame: (pcm: ArrayBuffer, rms: [number, number]) => void;
}): Promise<CaptureHandles> {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AC({ sampleRate: 16000 });
  try {
    await ctx.audioWorklet.addModule("/worklets/pcm-processor.js");
  } catch (e: any) {
    throw new CaptureError("worklet", `Audio engine failed to load: ${e?.message ?? e}`);
  }
  if (ctx.state === "suspended") await ctx.resume();

  const merger = ctx.createChannelMerger(2);
  const micSrc = ctx.createMediaStreamSource(opts.mic);
  micSrc.connect(merger, 0, 0);
  if (opts.tab) {
    const tabSrc = ctx.createMediaStreamSource(opts.tab);
    tabSrc.connect(merger, 0, 1);
  }
  const node = new AudioWorkletNode(ctx, "pcm-processor", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: "explicit", channelInterpretation: "discrete" });
  merger.connect(node);
  // keep the worklet scheduled: silent sink into the destination
  const sink = ctx.createGain(); sink.gain.value = 0; node.connect(sink); sink.connect(ctx.destination);
  node.port.onmessage = (ev) => opts.onFrame(ev.data.pcm as ArrayBuffer, ev.data.rms as [number, number]);

  const stop = () => {
    try { node.port.onmessage = null; node.disconnect(); merger.disconnect(); micSrc.disconnect(); } catch {}
    opts.mic.getTracks().forEach((t) => t.stop());
    opts.tab?.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
  // if the user stops sharing from Chrome's bar, surface that
  opts.tab?.getAudioTracks()[0]?.addEventListener("ended", () => window.dispatchEvent(new CustomEvent("majlis:share-ended")));
  return { ctx, micStream: opts.mic, tabStream: opts.tab, stop };
}
