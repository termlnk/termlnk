/**
 * @termlnk/macos-utils — N-API addon exposing macOS NSWindow utilities.
 *
 * Electron does not expose NSWindowCollectionBehaviorStationary through
 * its JS API. This addon bridges that gap so a window can stay fixed
 * during Mission Control / Spaces transitions.
 *
 * It also exposes disableFrameConstraint() which neutralises AppKit's
 * -[NSWindow constrainFrameRect:toScreen:] so that setPosition(y=0) is
 * never silently pushed down to visibleFrame regardless of the current
 * window level. Implemented via method swizzling + associated objects
 * (KVO-safe — does not touch the isa pointer).
 */

#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>
#include <node_api.h>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static NSWindow* WindowFromBufferArg(napi_env env, napi_value arg) {
  bool isBuffer = false;
  napi_is_buffer(env, arg, &isBuffer);
  if (!isBuffer) {
    napi_throw_type_error(env, NULL, "Argument must be a Buffer");
    return nil;
  }

  void* data = NULL;
  size_t length = 0;
  napi_get_buffer_info(env, arg, &data, &length);

  if (!data || length < sizeof(void*)) {
    napi_throw_range_error(env, NULL, "Buffer too small for a pointer");
    return nil;
  }

  // getNativeWindowHandle() returns an NSView* on macOS.
  NSView* view = (__bridge NSView*)(*(void**)data);
  if (!view || ![view isKindOfClass:[NSView class]]) {
    return nil;
  }

  return [view window];
}

// ---------------------------------------------------------------------------
// makeStationary — set NSWindowCollectionBehaviorStationary
// ---------------------------------------------------------------------------

static napi_value MakeStationary(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  if (argc < 1) {
    napi_throw_type_error(env, NULL, "Expected a Buffer (getNativeWindowHandle)");
    return NULL;
  }

  @autoreleasepool {
    NSWindow* window = WindowFromBufferArg(env, args[0]);
    if (!window) {
      return NULL;
    }

    NSUInteger behavior = [window collectionBehavior];

    // Managed / Transient / Stationary are mutually exclusive per Apple
    // docs. The default Managed flag must be cleared, otherwise it wins
    // and Stationary is silently ignored.
    behavior &= ~NSWindowCollectionBehaviorManaged;
    behavior &= ~NSWindowCollectionBehaviorTransient;
    behavior |= NSWindowCollectionBehaviorStationary;
    behavior |= NSWindowCollectionBehaviorIgnoresCycle;

    [window setCollectionBehavior:behavior];
  }

  return NULL;
}

// ---------------------------------------------------------------------------
// disableFrameConstraint — neutralise -constrainFrameRect:toScreen:
// ---------------------------------------------------------------------------
//
// AppKit's default constrainFrameRect:toScreen: pushes windows whose level
// is below NSStatusWindowLevel into the screen's visibleFrame (i.e. below
// the menu bar). That check fires on every setFrame*/setFrameOrigin* call
// and uses the *current* level, not the eventual one — so any setPosition
// invoked while the island's level has been temporarily demoted (sleep/wake,
// lock/unlock, Space switch, Mission Control, etc.) permanently clips y=0
// up to visibleFrame.y (~25px).
//
// Implementation: method swizzling (NOT ISA swizzling).
//
// We do a one-time global replacement of -[NSWindow constrainFrameRect:toScreen:]
// via method_setImplementation(). The hook checks an associated-object flag on
// each window instance: flagged windows get the rect returned unchanged; all
// other windows fall through to the original AppKit implementation.
//
// Why not ISA swizzling (the previous approach)?
// ISA swizzling conflicts with KVO's own ISA swizzling. When both modify the
// same instance's isa pointer, KVO's observer deregistration fails during
// -[NSWindow dealloc], causing NSInternalInconsistencyException → SIGTRAP on
// Cmd+Q. See docs/agent/dynamic-island-quit-crash-investigation.md.
//
// Method swizzling is KVO-safe because it never touches the isa pointer.

static IMP g_originalConstrainImp = NULL;
static const char kBypassConstraintKey = '\0';

static NSRect TermlnkConstrainHook(id self, SEL _cmd, NSRect rect, NSScreen* screen) {
  if (objc_getAssociatedObject(self, &kBypassConstraintKey)) {
    return rect;  // Bypass: return the requested rect unchanged.
  }
  // Fall through to the original AppKit implementation for all other windows.
  return ((NSRect (*)(id, SEL, NSRect, NSScreen*))g_originalConstrainImp)(self, _cmd, rect, screen);
}

static napi_value DisableFrameConstraint(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  if (argc < 1) {
    napi_throw_type_error(env, NULL, "Expected a Buffer (getNativeWindowHandle)");
    return NULL;
  }

  @autoreleasepool {
    NSWindow* window = WindowFromBufferArg(env, args[0]);
    if (!window) {
      return NULL;
    }

    // One-time global method swizzle (thread-safe via dispatch_once).
    static dispatch_once_t once;
    dispatch_once(&once, ^{
      Method m = class_getInstanceMethod([NSWindow class],
                                         @selector(constrainFrameRect:toScreen:));
      g_originalConstrainImp = method_getImplementation(m);
      method_setImplementation(m, (IMP)TermlnkConstrainHook);
    });

    // Mark this specific window instance for bypass.
    objc_setAssociatedObject(window, &kBypassConstraintKey, @YES,
                             OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }

  return NULL;
}

// ---------------------------------------------------------------------------
// Module init
// ---------------------------------------------------------------------------

// Registered from src/keyboard-inject.mm — exposes checkAccessibilityTrusted /
// injectKeysByTty / injectKeysByPid for the Dynamic Island → Claude Code
// CLI keystroke bridge.
extern "C" void TermlnkRegisterKeyboardInject(napi_env env, napi_value exports);

static napi_value Init(napi_env env, napi_value exports) {
  napi_value makeStationaryFn;
  napi_create_function(env, "makeStationary", NAPI_AUTO_LENGTH, MakeStationary, NULL, &makeStationaryFn);
  napi_set_named_property(env, exports, "makeStationary", makeStationaryFn);

  napi_value disableFrameConstraintFn;
  napi_create_function(env, "disableFrameConstraint", NAPI_AUTO_LENGTH, DisableFrameConstraint, NULL, &disableFrameConstraintFn);
  napi_set_named_property(env, exports, "disableFrameConstraint", disableFrameConstraintFn);

  TermlnkRegisterKeyboardInject(env, exports);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
