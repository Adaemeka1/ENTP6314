"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;

// A camera / photo drop zone with a framing guide. The photo is only shown back
// to the driver on their own screen: it is NOT uploaded, analysed or stored.
export function PhotoDropZone({ onChange }: { onChange?: (hasPhoto: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Free the preview from memory when it is replaced or the screen closes.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function take(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo (a JPG, PNG or similar image).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is too large. Please choose one under 10 MB.");
      return;
    }
    setError("");
    setUrl(URL.createObjectURL(file));
    onChange?.(true);
  }

  function remove() {
    setUrl(null);
    setError("");
    if (input.current) input.current.value = "";
    onChange?.(false);
  }

  return (
    <div className="dropzone">
      <div
        className={"dropzone-frame" + (over ? " dropzone-over" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Your photo of the problem" className="dropzone-image" />
        ) : (
          <div className="dropzone-empty">
            <span className="dropzone-icon" aria-hidden="true">
              📷
            </span>
            <strong>Take or drop a photo</strong>
            <span className="muted small">A leak, a belt, a tire or a warning light</span>
          </div>
        )}
        <span className="frame-corner frame-tl" aria-hidden="true" />
        <span className="frame-corner frame-tr" aria-hidden="true" />
        <span className="frame-corner frame-bl" aria-hidden="true" />
        <span className="frame-corner frame-br" aria-hidden="true" />
        <span className="frame-hint">Center the problem here</span>
      </div>

      <div className="dropzone-actions">
        <button type="button" className="btn btn-google" onClick={() => input.current?.click()}>
          {url ? "Retake photo" : "Take or choose a photo"}
        </button>
        {url && (
          <button type="button" className="btn btn-google" onClick={remove}>
            Remove photo
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => take(e.target.files?.[0])}
      />

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">
        Optional. Your photo stays on your device: in this demo it isn&rsquo;t uploaded, analysed or stored.
      </p>
    </div>
  );
}
