/** Human-in-the-loop waits for headed, interactive runs (Section 9.3, 10.4). */
export interface Prompter {
  /** Prints `message` and blocks until the user presses Enter. */
  waitForEnter(message: string): Promise<void>;
}
