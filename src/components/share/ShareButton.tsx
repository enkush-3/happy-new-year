import { useState } from "react";
import { createGameShareUrl, presentGameResult } from "../../features/games/shared/gameShare";
import type { GameResult } from "../../features/games/shared/types";

interface ShareButtonProps {
  result: GameResult;
}

export default function ShareButton({ result }: ShareButtonProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [status, setStatus] = useState("");
  const presentation = presentGameResult(result);

  async function shareResult() {
    const url = createGameShareUrl(result, window.location.origin);
    setShareUrl(url);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: presentation.title, text: presentation.text, url });
        setStatus("Үр дүнг хуваалцлаа.");
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setStatus("Үр дүнгийн линкийг хууллаа.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Автоматаар хуваалцаж чадсангүй. Линкийг доороос сонгоод хуулна уу.");
      window.setTimeout(() => {
        const input = document.getElementById("game-share-link") as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }, 0);
    }
  }

  return (
    <div className="share-control">
      <button type="button" className="button button--primary ui-btn" onClick={shareResult}>
        <span aria-hidden="true">↗</span> Үр дүнгээ хуваалцах
      </button>
      {status && <p className="share-status" role="status" aria-live="polite">{status}</p>}
      {shareUrl && status.startsWith("Автоматаар") && (
        <div className="share-link-wrap">
          <label htmlFor="game-share-link">Share линк</label>
          <input id="game-share-link" type="url" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}
