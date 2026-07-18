"use client"

import {
  Eraser01Icon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  Upload04Icon,
  VoiceIcon,
} from "@hugeicons/core-free-icons"
import EasySpeech from "easy-speech"
import { useEffect, useRef, useState } from "react"

import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { readFirstFileAsText } from "@/lib/utils"

type Status = "idle" | "speaking" | "paused"

// Speech runs on EasySpeech rather than raw speechSynthesis — the raw API is
// broken differently in every browser (async voice loading with no event on
// some, Chrome's mid-speech cutoff and stuck-pause flags, utterances getting
// garbage-collected mid-speech and dropping their events) and the library
// exists to carry all of those workarounds. Its init() also fails loudly
// with a reason when the engine is unusable, instead of playing silence.
type Engine =
  | { state: "pending" }
  | { state: "ready"; voices: SpeechSynthesisVoice[] }
  | { state: "failed"; message: string }

// Sentinel for "speak() was accepted but nothing ever started" — Chrome's
// speech process can wedge machine-wide (it survives page reloads) and only
// a full browser restart clears it, which deserves different advice than a
// per-voice failure.
const ENGINE_STUCK = "engine not responding"

function errorCode(cause: unknown): string {
  if (cause && typeof cause === "object" && "error" in cause) {
    return String((cause as SpeechSynthesisErrorEvent).error)
  }
  return cause instanceof Error ? cause.message : String(cause)
}

// Temporary debug logging while we chase down silent playback — check the
// DevTools console for a [tts] trail of every step and engine state change.
function log(...args: unknown[]) {
  console.info("[tts]", ...args)
}

// Snapshot of the raw engine flags, for logging alongside each step.
function synthState() {
  const synth = window.speechSynthesis
  return {
    speaking: synth.speaking,
    pending: synth.pending,
    paused: synth.paused,
  }
}

export default function TextToSpeechPage() {
  const [text, setText] = useState("")
  const [voiceURI, setVoiceURI] = useState("")
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(100)
  const [status, setStatus] = useState<Status>("idle")
  const [engine, setEngine] = useState<Engine>({ state: "pending" })
  // The engine's error code (e.g. "synthesis-failed", "not-allowed") from the
  // last attempt, surfaced in the sidebar — without it a broken voice just
  // plays silence with no clue why.
  const [speechError, setSpeechError] = useState<string | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  // Bumped by every speak/stop so a superseded speak()'s settled promise can
  // tell it's stale and leave the state alone.
  const generationRef = useRef(0)
  // Whether the current utterance actually started playing — if speak() is
  // accepted but this never flips, the engine is wedged.
  const startedRef = useRef(false)
  // Whether the current pause came from our own Pause button. An engine pause
  // we didn't ask for (macOS routes media commands across apps, so pausing a
  // video in another browser pauses Chrome's speech too) gets auto-resumed.
  const pausedByUserRef = useRef(false)

  const voices = engine.state === "ready" ? engine.voices : []
  // Prefer local voices for the default — remote (network-backed) voices are
  // the ones that flake out: they need connectivity and are the main victims
  // of Chrome's silent mid-speech cutoffs.
  const selectedVoice =
    voices.find((voice) => voice.voiceURI === voiceURI) ??
    voices.find((voice) => voice.default && voice.localService) ??
    voices.find((voice) => voice.localService) ??
    voices.find((voice) => voice.default) ??
    voices[0]

  useEffect(() => {
    let disposed = false
    // Route EasySpeech's internal logging (browser detection, which
    // workarounds it applies) into the console alongside our own trail.
    // The `debug` hook exists at runtime but is missing from the lib's types.
    ;(EasySpeech as unknown as { debug: (...args: unknown[]) => void }).debug =
      (...args: unknown[]) => console.debug("[easy-speech]", ...args)
    log("init starting", EasySpeech.detect())
    // Direct voice load, then the voiceschanged event, then interval polling
    // — whichever this browser actually implements.
    EasySpeech.init({ maxTimeout: 5000, interval: 250, quiet: false })
      .then(() => {
        if (disposed) return
        const loaded = EasySpeech.voices()
        log("init ok", {
          voiceCount: loaded.length,
          firstVoices: loaded
            .slice(0, 5)
            .map((v) => `${v.name} (${v.lang})${v.localService ? " local" : ""}`),
          ...synthState(),
        })
        setEngine({ state: "ready", voices: loaded })
      })
      .catch((cause: unknown) => {
        if (disposed) return
        log("init FAILED", cause)
        setEngine({ state: "failed", message: errorCode(cause) })
      })
    return () => {
      disposed = true
      // cancel() throws if init() hasn't completed yet — which is exactly
      // when StrictMode's first dev unmount runs — so guard on the lib's own
      // initialized flag (present in status() but missing from its types).
      const { initialized } = EasySpeech.status() as { initialized?: boolean }
      if (initialized) EasySpeech.cancel()
    }
  }, [])

  // The OS can pause speech behind the page's back with no event fired here
  // (media keys, another app's audio). While we're supposed to be speaking,
  // poll for a pause the user didn't ask for and pick right back up.
  useEffect(() => {
    if (status !== "speaking") return
    const id = window.setInterval(() => {
      if (window.speechSynthesis.paused && !pausedByUserRef.current) {
        log("externally paused — auto-resuming", synthState())
        EasySpeech.resume()
      }
    }, 300)
    return () => window.clearInterval(id)
  }, [status])

  async function speak() {
    generationRef.current += 1
    const generation = generationRef.current
    setSpeechError(null)
    startedRef.current = false
    pausedByUserRef.current = false
    setStatus("speaking")
    log("speak requested", {
      generation,
      chars: text.length,
      voice: selectedVoice
        ? `${selectedVoice.name} (${selectedVoice.lang})${selectedVoice.localService ? " local" : " remote"}`
        : "(engine default)",
      rate,
      pitch,
      volume: volume / 100,
      ...synthState(),
    })

    // If nothing has started playing a few seconds in, the engine took the
    // utterance and went silent — reset and say so, instead of sitting on a
    // Stop button with no audio.
    window.setTimeout(() => {
      if (generationRef.current !== generation) return
      if (startedRef.current) return
      log("no start event within 3s — engine considered stuck", synthState())
      generationRef.current += 1
      EasySpeech.cancel()
      setSpeechError(ENGINE_STUCK)
      setStatus("idle")
    }, 3000)

    try {
      await EasySpeech.speak({
        text,
        voice: selectedVoice,
        rate,
        pitch,
        volume: volume / 100,
        start: () => {
          startedRef.current = true
          log("utterance started", { generation, ...synthState() })
        },
        end: () => {
          log("utterance ended", { generation, ...synthState() })
        },
        error: (event) => {
          log("utterance error event", {
            generation,
            error: event.error,
            ...synthState(),
          })
        },
      })
      if (generationRef.current !== generation) return
      log("speak finished normally", { generation })
      setStatus("idle")
    } catch (cause) {
      const code = errorCode(cause)
      log("speak rejected", { generation, code, cause })
      if (generationRef.current !== generation) return
      // "interrupted"/"canceled" are just our own cancel()/Stop echoing
      // back — only real engine failures are worth surfacing.
      if (code !== "interrupted" && code !== "canceled") {
        setSpeechError(code)
      }
      setStatus("idle")
    }
  }

  function stop() {
    log("stop clicked", synthState())
    generationRef.current += 1
    pausedByUserRef.current = false
    EasySpeech.cancel()
    setStatus("idle")
  }

  function togglePause() {
    if (status === "paused") {
      log("resume clicked", synthState())
      pausedByUserRef.current = false
      EasySpeech.resume()
      setStatus("speaking")
    } else {
      log("pause clicked", synthState())
      pausedByUserRef.current = true
      EasySpeech.pause()
      setStatus("paused")
    }
  }

  function clear() {
    if (status !== "idle") stop()
    setText("")
  }

  async function handleFiles(files: FileList | null) {
    const content = await readFirstFileAsText(files)
    if (content == null) return
    setText(content)
  }

  return (
    <ToolPage
      page="Text to Speech"
      icon={VoiceIcon}
      onAddFile={dropzoneRef}
      sidebar={{
        segments:
          voices.length > 0
            ? {
                label: "Voice",
                variant: "select",
                value: selectedVoice?.voiceURI ?? "",
                onValueChange: (value) => {
                  setVoiceURI(value)
                  setSpeechError(null)
                },
                disabled: status !== "idle",
                options: voices.map((voice) => ({
                  value: voice.voiceURI,
                  label: `${voice.name} (${voice.lang})`,
                  icon: VoiceIcon,
                })),
              }
            : undefined,
        slider: [
          {
            label: "Rate",
            value: rate,
            onValueChange: setRate,
            min: 0.5,
            // Chrome fails outright on rates above 2, despite the API
            // nominally allowing up to 10.
            max: 2,
            step: 0.1,
            unit: "x",
          },
          {
            label: "Pitch",
            value: pitch,
            onValueChange: setPitch,
            min: 0,
            max: 2,
            step: 0.1,
          },
          {
            label: "Volume",
            value: volume,
            onValueChange: setVolume,
            min: 0,
            max: 100,
            step: 5,
            unit: "%",
          },
        ],
        hint:
          engine.state === "pending" ? (
            "Loading your device's voices…"
          ) : engine.state === "failed" ? (
            <span className="text-destructive">
              Speech isn&apos;t available in this browser ({engine.message}).
              Try another browser — the tool uses the browser&apos;s own
              speech engine.
            </span>
          ) : speechError === ENGINE_STUCK ? (
            <span className="text-destructive">
              The browser&apos;s speech engine isn&apos;t responding. It can
              get stuck machine-wide (a page reload won&apos;t clear it) —
              quit the browser fully and reopen it, then try again. Picking a
              different voice sometimes helps too.
            </span>
          ) : speechError ? (
            <span className="text-destructive">
              Speech failed ({speechError}). Try another voice — some voices
              don&apos;t play in every browser, and network voices need a
              connection.
            </span>
          ) : (
            "Speech uses your device's built-in voices — your text never leaves the browser. Rate, pitch, and volume apply the next time you hit Speak."
          ),
        actions: [
          status !== "idle" && {
            label: status === "paused" ? "Resume" : "Pause",
            icon: status === "paused" ? PlayIcon : PauseIcon,
            onClick: togglePause,
            variant: "secondary",
            emphasis: "secondary",
          },
          status === "idle"
            ? {
                label: "Speak",
                icon: PlayIcon,
                onClick: speak,
                disabled: engine.state !== "ready" || !text.trim(),
              }
            : { label: "Stop", icon: StopIcon, onClick: stop },
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "outline",
          },
        ],
      }}
    >
      <PreviewCard
        fill
        layer={{
          kind: "textinput",
          value: text,
          onChange: setText,
          placeholder:
            "Type or paste text to read aloud (your text is not saved anywhere)",
        }}
      />

      <Dropzone
        ref={dropzoneRef}
        hidden
        icon={Upload04Icon}
        title="Drag and drop a text file to upload"
        description="or, click to browse · your file is not saved anywhere"
        accept=".txt,.md,text/plain"
        onFiles={handleFiles}
      />
    </ToolPage>
  )
}
