import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { DEMO_MESSAGE } from "../api";

// Shown on every signed-in page of a DEMO MODE build, so no screen can be
// mistaken for live Oracle data.
function DemoBanner() {
  const [confirming, setConfirming] = useState(false);

  async function reset() {
    const { resetDemoState } = await import("../demo/demoApi.js");
    resetDemoState();
    window.location.reload();
  }

  return (
    <div className="demo-banner" role="note" aria-label="Demo mode notice">
      <FlaskConical size={18} aria-hidden="true" />
      <div>
        <strong>DEMO MODE: simulated, not connected to Oracle.</strong>{" "}
        <span>
          {DEMO_MESSAGE.replace(/^DEMO MODE: /, "")} Your simulated changes stay in this browser only.
          The genuine Oracle demonstration runs on the author&apos;s computer (see the README).
        </span>
      </div>
      {confirming ? (
        <span className="demo-banner-actions">
          <button type="button" onClick={reset}>Reset demo data</button>
          <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} title="Discard your simulated transactions and alert changes">
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
      )}
    </div>
  );
}

export default DemoBanner;
