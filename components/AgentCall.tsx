"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "agent" | "caller" | "system";

interface TranscriptEntry {
  id: string;
  role: Role;
  content: string;
}

const randomId = () => crypto.randomUUID();

const introMessage: TranscriptEntry = {
  id: randomId(),
  role: "agent",
  content:
    "Hello, this is Lumen, your AI concierge. Thanks for picking up! To make sure I can help, I'll just need to ask a couple of quick questions."
};

const systemMessage: TranscriptEntry = {
  id: randomId(),
  role: "system",
  content:
    "Tip: stay close to your microphone and speak clearly so the AI can capture your answers."
};

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
const SpeechRecognition =
  typeof window !== "undefined"
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : undefined;

export function AgentCall() {
  const [isCalling, setIsCalling] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([introMessage, systemMessage]);
  const [isSynthSpeaking, setIsSynthSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [availability, setAvailability] = useState("Ready");
  const [inputValue, setInputValue] = useState("");
  const recognitionRef = useRef<any>(null);
  const queuedUtterances = useRef<SpeechSynthesisUtterance[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendToAgentRef = useRef<(message: string) => void>();

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev, entry]);
  }, []);

  const speak = useCallback((text: string) => {
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.01;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSynthSpeaking(true);
    utterance.onend = () => {
      setIsSynthSpeaking(false);
      queuedUtterances.current.shift();
      if (!queuedUtterances.current.length) {
        synth.resume();
      }
    };
    queuedUtterances.current.push(utterance);
    synth.cancel();
    synth.speak(utterance);
  }, []);

  const ensureRecognition = useCallback(() => {
    if (!SpeechRecognition) return null;
    if (recognitionRef.current) return recognitionRef.current;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const spoken = event.results?.[0]?.[0]?.transcript?.trim();
      if (!spoken) return;
      setIsListening(false);
      appendTranscript({ id: randomId(), role: "caller", content: spoken });
      sendToAgentRef.current?.(spoken);
    };
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "no-speech") {
        appendTranscript({
          id: randomId(),
          role: "system",
          content: "Didn't catch that. Let's try once more."
        });
        setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch (startError) {
            console.warn("Failed to restart recognition", startError);
          }
        }, 500);
        return;
      }
      setError(`Speech recognition error: ${event.error}`);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    return recognition;
  }, [appendTranscript]);

  const startListening = useCallback(() => {
    const recognition = ensureRecognition();
    if (!recognition) return;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setError("Microphone is busy. Please try again.");
    }
  }, [ensureRecognition]);

  const promptCaller = useCallback(() => {
    setTimeout(() => {
      startListening();
    }, 400);
  }, [startListening]);

  const primeCall = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/session", {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to initialize session");
      const { sessionId: newSessionId, openingLine } = await res.json();
      setSessionId(newSessionId);
      const agentEntry: TranscriptEntry = {
        id: randomId(),
        role: "agent",
        content: openingLine
      };
      appendTranscript(agentEntry);
      speak(openingLine);
      setAvailability("Listening");
      promptCaller();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setIsCalling(false);
      setAvailability("Unavailable");
    }
  }, [appendTranscript, promptCaller, speak]);

  const stopCall = useCallback(() => {
    setIsCalling(false);
    setSessionId(null);
    setAvailability("Ready");
    recognitionRef.current?.stop();
    synth?.cancel();
    appendTranscript({
      id: randomId(),
      role: "system",
      content: "Call ended. Start a new session whenever you're ready."
    });
  }, [appendTranscript]);

  useEffect(() => {
    if (!isCalling) return;
    primeCall();
  }, [isCalling, primeCall]);

  const sendToAgent = useCallback(
    async (message: string) => {
      if (!sessionId) return;
      setAvailability("Processing");
      let ended = false;
      try {
        const res = await fetch("/api/agent/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message })
        });
        if (!res.ok) throw new Error("Agent failed to respond");
        const data = await res.json();
        const agentReply: TranscriptEntry = {
          id: randomId(),
          role: "agent",
          content: data.reply
        };
        appendTranscript(agentReply);
        speak(data.reply);
        if (data.followUp) {
          appendTranscript({
            id: randomId(),
            role: "agent",
            content: data.followUp
          });
          speak(data.followUp);
        }
        ended = Boolean(data.ended);
        if (ended) {
          stopCall();
        } else {
          promptCaller();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        stopCall();
      } finally {
        if (!ended) {
          setAvailability("Listening");
        }
      }
    },
    [appendTranscript, promptCaller, sessionId, speak, stopCall]
  );

  useEffect(() => {
    sendToAgentRef.current = (message: string) => {
      void sendToAgent(message);
    };
    return () => {
      sendToAgentRef.current = undefined;
    };
  }, [sendToAgent]);

  const handleManualSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      setInputValue("");
      appendTranscript({ id: randomId(), role: "caller", content: trimmed });
      sendToAgent(trimmed);
    },
    [appendTranscript, inputValue, sendToAgent]
  );

  const callStatus = useMemo(() => {
    if (!isCalling) return "Idle";
    if (isSynthSpeaking) return "Agent speaking";
    if (isListening) return "Listening";
    return availability;
  }, [availability, isCalling, isListening, isSynthSpeaking]);

  const startCall = useCallback(() => {
    setTranscript([introMessage, systemMessage]);
    setIsCalling(true);
    setAvailability("Connecting");
    setError(null);
  }, []);

  return (
    <section>
      <div className="call-controls">
        <button
          className="primary"
          onClick={startCall}
          disabled={isCalling}
        >
          {isCalling ? "Call Running" : "Start AI Call"}
        </button>
        <button
          className="secondary"
          onClick={stopCall}
          disabled={!isCalling}
        >
          End Call
        </button>
        <span className="status-pill">{callStatus}</span>
      </div>
      <form onSubmit={handleManualSubmit} style={{ marginTop: 24 }}>
        <label htmlFor="manual-entry">Type a response (if microphone unavailable)</label>
        <input
          id="manual-entry"
          type="text"
          placeholder="Answer the agent here..."
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={!isCalling}
        />
      </form>
      <div className="log">
        {transcript.map((entry) => (
          <div key={entry.id} className={`log-item ${entry.role}`}>
            <strong>{entry.role === "agent" ? "Agent" : entry.role === "caller" ? "You" : "System"}</strong>
            <span>{entry.content}</span>
          </div>
        ))}
      </div>
      {error ? <small>Error: {error}</small> : null}
    </section>
  );
}
