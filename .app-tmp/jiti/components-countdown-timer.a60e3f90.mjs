"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CountdownTimer = void 0; /**
 * Reusable countdown timer for dialog components.
 */



class CountdownTimer {
  intervalId;
  remainingSeconds;
  tui;
  onTick;
  onExpire;

  constructor(timeoutMs, tui, onTick, onExpire) {
    this.tui = tui;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.remainingSeconds = Math.ceil(timeoutMs / 1000);
    this.onTick(this.remainingSeconds);

    this.intervalId = setInterval(() => {
      this.remainingSeconds--;
      this.onTick(this.remainingSeconds);
      this.tui?.requestRender();

      if (this.remainingSeconds <= 0) {
        this.dispose();
        this.onExpire();
      }
    }, 1000);
  }

  dispose() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}exports.CountdownTimer = CountdownTimer; /* v9-3a0b2215d9bc30e8 */
