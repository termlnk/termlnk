/**
 * Keyboard-injection primitives for the Dynamic Island → external-terminal
 * Claude Code bridge.
 *
 * Problem: Claude Code's `AskUserQuestion` hook is either blocking (island
 * picks, CLI TUI never shows) or fire-and-forget (CLI TUI shows, but the
 * island pick has nowhere to go). On macOS we reconcile the two by
 * synthesising keyboard events with `CGEventPostToPid` into the terminal
 * application that owns the CLI's controlling tty. Requires Accessibility
 * permission (NSAccessibilityUsageDescription).
 *
 * Three entry points:
 *   checkAccessibilityTrusted(prompt) → is this process trusted?
 *   injectKeysByTty(tty, sequence)    → resolve tty → terminal app → post
 *   injectKeysByPid(pid, sequence)    → post directly (escape hatch)
 *
 * The sequence string is a space-delimited list of tokens so the JS layer
 * does not need to know macOS virtual keycodes; see ParseToken below for
 * the accepted tokens.
 */

#import <ApplicationServices/ApplicationServices.h>
#import <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>
#include <libproc.h>
#include <node_api.h>
#include <sys/proc_info.h>
#include <sys/stat.h>
#include <sys/sysctl.h>
#include <sys/types.h>
#include <unistd.h>

// ---------------------------------------------------------------------------
// NAPI helpers
// ---------------------------------------------------------------------------

static napi_value BoolResult(napi_env env, bool value) {
  napi_value out;
  napi_get_boolean(env, value, &out);
  return out;
}

static bool ReadString(napi_env env, napi_value arg, char* buf, size_t bufSize) {
  size_t len = 0;
  if (napi_get_value_string_utf8(env, arg, buf, bufSize, &len) != napi_ok) {
    return false;
  }
  buf[len < bufSize ? len : bufSize - 1] = '\0';
  return true;
}

// ---------------------------------------------------------------------------
// Token → virtual keycode mapping
// ---------------------------------------------------------------------------
//
// Keycodes are the Carbon `kVK_*` constants — stable across macOS releases
// and the exact values expected by CGEventCreateKeyboardEvent.

typedef struct {
  CGKeyCode keycode;
  bool valid;
} TokenKey;

static TokenKey ParseToken(const char* token, size_t len) {
  TokenKey k = {0, false};
  if (len == 0) {
    return k;
  }

  // Named keys.
  if (len == 2 && strncmp(token, "UP", 2) == 0) { k.keycode = kVK_UpArrow; k.valid = true; return k; }
  if (len == 4 && strncmp(token, "DOWN", 4) == 0) { k.keycode = kVK_DownArrow; k.valid = true; return k; }
  if (len == 4 && strncmp(token, "LEFT", 4) == 0) { k.keycode = kVK_LeftArrow; k.valid = true; return k; }
  if (len == 5 && strncmp(token, "RIGHT", 5) == 0) { k.keycode = kVK_RightArrow; k.valid = true; return k; }
  if (len == 5 && strncmp(token, "ENTER", 5) == 0) { k.keycode = kVK_Return; k.valid = true; return k; }
  if (len == 6 && strncmp(token, "RETURN", 6) == 0) { k.keycode = kVK_Return; k.valid = true; return k; }
  if (len == 3 && strncmp(token, "ESC", 3) == 0) { k.keycode = kVK_Escape; k.valid = true; return k; }
  if (len == 3 && strncmp(token, "TAB", 3) == 0) { k.keycode = kVK_Tab; k.valid = true; return k; }
  if (len == 5 && strncmp(token, "SPACE", 5) == 0) { k.keycode = kVK_Space; k.valid = true; return k; }

  // DIGIT:<1-9>  — the single-digit picker shortcut.
  if (len == 7 && strncmp(token, "DIGIT:", 6) == 0) {
    char d = token[6];
    if (d >= '1' && d <= '9') {
      static const CGKeyCode digitCodes[9] = {
        kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_3, kVK_ANSI_4,
        kVK_ANSI_5, kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9,
      };
      k.keycode = digitCodes[d - '1'];
      k.valid = true;
      return k;
    }
  }
  return k;
}

// ---------------------------------------------------------------------------
// Event posting
// ---------------------------------------------------------------------------
//
// For each token we post a key-down and key-up pair. `CGEventPostToPid`
// targets the event to a specific process — this works for terminal apps
// which own the controlling tty and forward the keystrokes into the PTY
// slave (and thus into Claude Code).

static void PostKeyToPid(pid_t pid, CGKeyCode keycode) {
  CGEventRef keyDown = CGEventCreateKeyboardEvent(NULL, keycode, true);
  CGEventRef keyUp = CGEventCreateKeyboardEvent(NULL, keycode, false);
  if (keyDown) {
    CGEventPostToPid(pid, keyDown);
    CFRelease(keyDown);
  }
  if (keyUp) {
    CGEventPostToPid(pid, keyUp);
    CFRelease(keyUp);
  }
}

/**
 * Post each token in `sequence` as a key-down + key-up to `pid`.
 * Returns true when every token parsed successfully (events were posted);
 * false when any token is unrecognised (caller decides whether to retry).
 * A short delay between keys gives the target app time to process each
 * event — matches what a fast human typist produces.
 */
static bool PostSequenceToPid(pid_t pid, const char* sequence) {
  if (!sequence || sequence[0] == '\0') {
    return false;
  }

  const char* cursor = sequence;
  bool allValid = true;
  while (*cursor) {
    while (*cursor == ' ') {
      cursor++;
    }
    if (*cursor == '\0') {
      break;
    }
    const char* start = cursor;
    while (*cursor && *cursor != ' ') {
      cursor++;
    }
    size_t len = (size_t)(cursor - start);
    TokenKey tk = ParseToken(start, len);
    if (!tk.valid) {
      allValid = false;
      continue;
    }
    PostKeyToPid(pid, tk.keycode);
    usleep(25 * 1000);  // 25ms between keystrokes
  }
  return allValid;
}

// ---------------------------------------------------------------------------
// tty → terminal-app PID resolution
// ---------------------------------------------------------------------------
//
// The hook helper reports `/dev/ttys001` (the CLI's controlling tty). We
// stat() that path to pick up its `st_rdev` — the device number — then
// enumerate all pids and match against `pbi_tdev` (their controlling tty
// device). From each match we walk ppid up until we hit a GUI app that
// NSRunningApplication can identify (iTerm2 / Terminal.app / Ghostty /
// Warp / VS Code-hosted terminal / …).

static pid_t FindTerminalAppForTty(const char* ttyPath) {
  if (!ttyPath || ttyPath[0] == '\0') {
    return 0;
  }
  struct stat st;
  if (stat(ttyPath, &st) != 0) {
    return 0;
  }
  dev_t targetDev = st.st_rdev;

  int count = proc_listpids(PROC_ALL_PIDS, 0, NULL, 0);
  if (count <= 0) {
    return 0;
  }
  int bufsize = count + 16;
  pid_t* pids = (pid_t*)calloc((size_t)bufsize, sizeof(pid_t));
  if (!pids) {
    return 0;
  }
  int gotBytes = proc_listpids(PROC_ALL_PIDS, 0, pids, (int)(bufsize * sizeof(pid_t)));
  int gotCount = gotBytes / (int)sizeof(pid_t);

  pid_t terminalPid = 0;
  for (int i = 0; i < gotCount; i++) {
    pid_t pid = pids[i];
    if (pid <= 0) {
      continue;
    }
    struct proc_bsdinfo bsd;
    int r = proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &bsd, PROC_PIDTBSDINFO_SIZE);
    if (r != (int)PROC_PIDTBSDINFO_SIZE) {
      continue;
    }
    if ((dev_t)bsd.e_tdev != targetDev) {
      continue;
    }
    // Found a process attached to this tty. Walk up to the first GUI
    // app — that's the terminal app we want to target.
    pid_t cursor = pid;
    for (int depth = 0; depth < 16 && cursor > 1; depth++) {
      NSRunningApplication* runningApp = [NSRunningApplication runningApplicationWithProcessIdentifier:cursor];
      if (runningApp) {
        terminalPid = cursor;
        break;
      }
      struct proc_bsdinfo pbi;
      int pr = proc_pidinfo(cursor, PROC_PIDTBSDINFO, 0, &pbi, PROC_PIDTBSDINFO_SIZE);
      if (pr != (int)PROC_PIDTBSDINFO_SIZE) {
        break;
      }
      if ((pid_t)pbi.pbi_ppid == cursor) {
        break;
      }
      cursor = (pid_t)pbi.pbi_ppid;
    }
    if (terminalPid != 0) {
      break;
    }
  }

  free(pids);
  return terminalPid;
}

// ---------------------------------------------------------------------------
// NAPI: checkAccessibilityTrusted(prompt?) → boolean
// ---------------------------------------------------------------------------

static napi_value CheckAccessibilityTrusted(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  bool prompt = false;
  if (argc >= 1) {
    napi_valuetype t;
    napi_typeof(env, args[0], &t);
    if (t == napi_boolean) {
      napi_get_value_bool(env, args[0], &prompt);
    }
  }

  bool trusted = false;
  @autoreleasepool {
    // AXIsProcessTrustedWithOptions(empty dict) crashes inside CFGetTypeID
    // on macOS 26 for ad-hoc signed bundles, so only take the options path
    // when we actually need to surface the system prompt.
    if (prompt) {
      NSDictionary* options = @{(__bridge NSString*)kAXTrustedCheckOptionPrompt: @YES};
      trusted = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
    } else {
      trusted = AXIsProcessTrusted();
    }
  }
  return BoolResult(env, trusted);
}

// ---------------------------------------------------------------------------
// NAPI: injectKeysByTty(ttyPath, sequence) → boolean
// ---------------------------------------------------------------------------

static napi_value InjectKeysByTty(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  if (argc < 2) {
    napi_throw_type_error(env, NULL, "Expected (ttyPath: string, sequence: string)");
    return NULL;
  }

  char ttyPath[256];
  char sequence[1024];
  if (!ReadString(env, args[0], ttyPath, sizeof(ttyPath))) {
    return BoolResult(env, false);
  }
  if (!ReadString(env, args[1], sequence, sizeof(sequence))) {
    return BoolResult(env, false);
  }

  @autoreleasepool {
    if (!AXIsProcessTrusted()) {
      return BoolResult(env, false);
    }
    pid_t pid = FindTerminalAppForTty(ttyPath);
    if (pid == 0) {
      return BoolResult(env, false);
    }
    // Bring the terminal app forward so CGEvent is actually delivered.
    // CGEventPostToPid targets the pid regardless of foreground state,
    // but some terminal apps only process synthesised keys while they
    // own key-focus. Activating matches what a human "click the tab and
    // type" would do.
    NSRunningApplication* app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
    if (app) {
      [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
      // Give the WindowServer ~60ms to reorder before the first keystroke.
      usleep(60 * 1000);
    }
    bool ok = PostSequenceToPid(pid, sequence);
    return BoolResult(env, ok);
  }
}

// ---------------------------------------------------------------------------
// NAPI: injectKeysByPid(pid, sequence) → boolean
// ---------------------------------------------------------------------------

static napi_value InjectKeysByPid(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  if (argc < 2) {
    napi_throw_type_error(env, NULL, "Expected (pid: number, sequence: string)");
    return NULL;
  }

  int32_t pidRaw = 0;
  if (napi_get_value_int32(env, args[0], &pidRaw) != napi_ok || pidRaw <= 0) {
    return BoolResult(env, false);
  }
  char sequence[1024];
  if (!ReadString(env, args[1], sequence, sizeof(sequence))) {
    return BoolResult(env, false);
  }

  @autoreleasepool {
    if (!AXIsProcessTrusted()) {
      return BoolResult(env, false);
    }
    NSRunningApplication* app = [NSRunningApplication runningApplicationWithProcessIdentifier:pidRaw];
    if (app) {
      [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
      usleep(60 * 1000);
    }
    bool ok = PostSequenceToPid((pid_t)pidRaw, sequence);
    return BoolResult(env, ok);
  }
}

// ---------------------------------------------------------------------------
// Module registration (called from Init in window-utils.mm)
// ---------------------------------------------------------------------------

extern "C" void TermlnkRegisterKeyboardInject(napi_env env, napi_value exports) {
  napi_value fn;

  napi_create_function(env, "checkAccessibilityTrusted", NAPI_AUTO_LENGTH, CheckAccessibilityTrusted, NULL, &fn);
  napi_set_named_property(env, exports, "checkAccessibilityTrusted", fn);

  napi_create_function(env, "injectKeysByTty", NAPI_AUTO_LENGTH, InjectKeysByTty, NULL, &fn);
  napi_set_named_property(env, exports, "injectKeysByTty", fn);

  napi_create_function(env, "injectKeysByPid", NAPI_AUTO_LENGTH, InjectKeysByPid, NULL, &fn);
  napi_set_named_property(env, exports, "injectKeysByPid", fn);
}
