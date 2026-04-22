/**
 * Set NSWindowCollectionBehaviorStationary on the window identified by
 * the native handle from `BrowserWindow.getNativeWindowHandle()`.
 *
 * Prevents the window from participating in macOS Mission Control and
 * Spaces animations — it stays fixed in place. No-op on non-macOS.
 */
export function makeStationary(nativeWindowHandle: Buffer): void;

/**
 * Disable AppKit's `-[NSWindow constrainFrameRect:toScreen:]` for the
 * target window via per-instance ISA swizzling.
 *
 * Default behaviour: AppKit constrains any window whose level is below
 * `NSStatusWindowLevel` to the screen's `visibleFrame` (below the menu
 * bar). The check fires on every `setFrame*` call and uses the *current*
 * level — so a `setPosition(y=0)` issued while the level has been briefly
 * demoted (Space switch / unlock / Mission Control) gets permanently
 * clipped to `y ≈ 25px`.
 *
 * After calling this once on a window, subsequent `setPosition` calls
 * reach the exact coordinates regardless of level ordering. Only the
 * targeted window is affected. No-op on non-macOS.
 */
export function disableFrameConstraint(nativeWindowHandle: Buffer): void;

/**
 * Return whether Termlnk has been granted macOS Accessibility permission
 * (System Settings → Privacy & Security → Accessibility). When `prompt`
 * is true, macOS will surface its one-shot permission dialog on the first
 * call — subsequent calls require the user to toggle the setting manually.
 *
 * Always returns `false` on non-macOS.
 */
export function checkAccessibilityTrusted(prompt?: boolean): boolean;

/**
 * Synthesise a sequence of keystrokes into the terminal application that
 * owns the given tty path (e.g. `/dev/ttys001` reported via the hook
 * helper's `meta.tty`). Walks the process tree up from the tty-holder
 * until it finds a GUI app (iTerm2 / Terminal.app / Ghostty / …), brings
 * it to the front, and posts CGEvent keyDown/keyUp pairs to its pid.
 *
 * `sequence` is a space-delimited list of tokens — see the addon source
 * for the supported set. Typical Claude Code AskUserQuestion usage:
 * `"DOWN DOWN ENTER"` selects the third option (0-indexed, with the
 * cursor starting on the first option). For free-text input (e.g. the
 * `Other…` slot in a multi-select picker), use a `TEXT:<base64>` token;
 * the payload is decoded as UTF-8 and each character is posted via
 * `CGEventKeyboardSetUnicodeString` so the terminal sees it as typed
 * input regardless of the target keyboard layout.
 *
 * Requires Accessibility permission (see {@link checkAccessibilityTrusted}).
 * Returns `false` when the tty cannot be resolved, the terminal app is
 * missing, permission has not been granted, or any token in the sequence
 * is malformed. Always returns `false` on non-macOS.
 */
export function injectKeysByTty(ttyPath: string, sequence: string): boolean;

/**
 * Escape hatch for {@link injectKeysByTty}: post the sequence directly to
 * the supplied pid without any tty / process-tree resolution. Intended
 * for callers that already know the GUI terminal app's pid (e.g. via
 * `NSRunningApplication` tracking). Same permission / platform caveats.
 */
export function injectKeysByPid(pid: number, sequence: string): boolean;
