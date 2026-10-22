"use client";

import { useEffect, useRef, useState } from "react";
import { diagnose, type Reply } from "@/lib/diagnose";

type Message = { from: "me"; text: string } | { from: "helper"; reply: Reply };

const EXAMPLES = [
  "White smoke under the hood",
  "My brakes are squealing",
  "Car won't start",
  "Check engine light is on",
];

const GREETING =
  "Hi! I'm the NemaGo Car Helper. Tell me what's going on with your car. What do you see, hear or smell? I'll explain what it might be in plain English.";

export function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setMessages((old) => [
      ...old,
      { from: "me", text: trimmed },
      { from: "helper", reply: diagnose(trimmed) },
    ]);
    setText("");
  }

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        <div className="bubble bubble-helper">{GREETING}</div>

        {messages.map((m, i) =>
          m.from === "me" ? (
            <div key={i} className="bubble bubble-me">
              {m.text}
            </div>
          ) : (
            <div key={i} className="bubble bubble-helper">
              <strong>{m.reply.headline}</strong>
              <p>{m.reply.explanation}</p>
              <p className={"safety safety-" + m.reply.level}>{m.reply.safety}</p>
              <p>
                <strong>Next step:</strong> {m.reply.nextStep}
              </p>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 0 && (
        <div className="chips">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="chip" onClick={() => send(example)}>
              {example}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe what's wrong…"
          aria-label="Describe what's wrong with your car"
          maxLength={300}
        />
        <button type="submit" className="btn btn-primary btn-send" disabled={!text.trim()}>
          Send
        </button>
      </form>

      <p className="muted small">
        Demo helper: it matches key words and can be wrong. It is not a real mechanic, and
        nothing you type is saved.
      </p>
    </div>
  );
}
