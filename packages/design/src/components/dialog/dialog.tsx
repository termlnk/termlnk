/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Children, createContext, Fragment, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../common/cn';
import { Button } from '../button';
import { ConfigContext } from '../config-provider';
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, Dialog as DialogProvider, DialogTitle } from './dialog-primitive';

const DIALOG_VIEWPORT_GUTTER = 16;
const DIALOG_VIEWPORT_MAX_WIDTH = `calc(100vw - ${DIALOG_VIEWPORT_GUTTER * 2}px)`;
const DIALOG_VIEWPORT_MAX_HEIGHT = `calc(100vh - ${DIALOG_VIEWPORT_GUTTER * 2}px)`;

interface IDialogDragContextValue {
  draggable: boolean;
  onMouseDown: ((e: ReactMouseEvent<HTMLElement>) => void) | undefined;
}

const DialogDragContext = createContext<IDialogDragContextValue>({
  draggable: false,
  onMouseDown: undefined,
});

export interface IDialogDragHandleProps {
  /**
   * The height of the transparent drag region.
   * @default 30
   */
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Transparent drag region that hands mousedown back to the parent Dialog's
 * draggable hook. Render inside a Dialog's `children` when the Dialog has no
 * visible title bar but should still be draggable from its top edge.
 *
 * Renders nothing when the surrounding Dialog is not draggable.
 */
export function DialogDragHandle({ height = 30, className, style }: IDialogDragHandleProps) {
  const { draggable, onMouseDown } = useContext(DialogDragContext);
  if (!draggable || !onMouseDown) {
    return null;
  }

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      data-slot="dialog-drag-handle"
      className={cn(
        'tm:pointer-events-auto tm:absolute tm:inset-x-0 tm:top-0 tm:z-0 tm:select-none',
        className
      )}
      style={{
        height: resolvedHeight,
        cursor: 'grab',
        touchAction: 'none',
        ...style,
      }}
      onMouseDown={onMouseDown}
    />
  );
}

function getViewportSize() {
  const { clientWidth, clientHeight } = document.documentElement;
  return { width: clientWidth, height: clientHeight };
}

export interface IDialogProps {
  children: ReactNode;

  /**
   * The style of the dialog.
   */
  style?: CSSProperties;

  /**
   * Whether the dialog is visible.
   * @default false
   */
  open?: boolean;

  /**
   * The width of the dialog.
   */
  width?: number | string;

  /**
   * The title of the dialog.
   */
  title?: ReactNode;

  /**
   * Whether the dialog can be dragged. If a dialog is draggable, the backdrop would be hidden and
   * the wrapper container would not response to user's mouse events.
   *
   * @default false
   */
  draggable?: boolean;

  /**
   * The default position of the dialog.
   */
  defaultPosition?: { x: number; y: number };

  /**
   * Whether the dialog should be destroyed on close.
   * @deprecated
   * @default false
   */
  destroyOnClose?: boolean;

  /**
   * Whether the dialog should preserve its position on destroy.
   * @default false
   */
  preservePositionOnDestroy?: boolean;

  /**
   * The footer of the dialog.
   */
  footer?: ReactNode;

  /**
   *  Whether the dialog should show a mask.
   */
  mask?: boolean;

  /**
   * Whether to enable Radix Dialog's modal mode (focus trap + RemoveScroll +
   * hideOthers + `disableOutsidePointerEvents`).
   *
   * Defaults to `mask` so existing callers keep their old behavior: a masked
   * dialog locks the rest of the page. Set this to `false` when the dialog
   * embeds Portal-based popups (Popover, Combobox, Select, ...) — Radix
   * modal's `disableOutsidePointerEvents` sets `body { pointer-events: none }`,
   * which breaks non-Radix popups (e.g. base-ui Combobox) that don't register
   * into Radix's DismissableLayer.
   */
  modal?: boolean;

  /**
   * additional className for dialog
   */
  className?: string;

  /**
   * whether show close button
   */
  closable?: boolean;

  /**
   * whether click mask to close, default is true
   */
  maskClosable?: boolean;

  /**
   * whether support press esc to close
   * @default true
   */
  keyboard?: boolean;

  /**
   * The callback function when the open state changes.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * The callback function when the dialog is closed.
   */
  onClose?: () => void;

  /**
   * Disable Radix auto focus behavior on open.
   * Use this when the default "focus first tabbable element" is not desired.
   *
   * @default false
   */
  disableAutoFocus?: boolean;

  showOk?: boolean;
  showCancel?: boolean;

  onOk?: () => void;
  onCancel?: () => void;
}

function useDraggable(
  options: {
    defaultPosition?: { x: number; y: number };
    enabled?: boolean;
    /**
     * Whether the surrounding dialog is currently open. Global listeners
     * (window resize) must not stay attached for closed dialogs.
     */
    open?: boolean;
  } = {}
) {
  const elementRef = useRef<HTMLElement | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startClientRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);
  // Once the user drags the dialog manually, we stop auto-recentering on
  // content resize — their deliberate position wins over content-driven layout.
  const userHasDraggedRef = useRef(false);
  // Observer tracking the dialog element's own size; lets late-arriving content
  // (e.g. data fetched after mount) re-center the dialog instead of leaving it
  // anchored at the first render's smaller footprint.
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastKnownSizeRef = useRef<{ width: number; height: number } | null>(null);

  const getElementSize = useCallback((element?: HTMLElement | null) => {
    const targetElement = element ?? elementRef.current;

    if (!targetElement) {
      return lastKnownSizeRef.current;
    }

    const { width, height } = targetElement.getBoundingClientRect();
    if (width > 0 && height > 0) {
      const nextSize = { width, height };
      lastKnownSizeRef.current = nextSize;
      return nextSize;
    }

    return lastKnownSizeRef.current ?? { width, height };
  }, []);

  const clampPositionToViewport = useCallback(
    (nextPosition: { x: number; y: number }, size?: { width: number; height: number }) => {
      const targetSize = size ?? getElementSize();

      if (!targetSize) {
        return nextPosition;
      }

      const { width: viewportWidth, height: viewportHeight } = getViewportSize();
      const minX = DIALOG_VIEWPORT_GUTTER;
      const minY = DIALOG_VIEWPORT_GUTTER;
      const maxX = Math.max(minX, viewportWidth - targetSize.width - DIALOG_VIEWPORT_GUTTER);
      const maxY = Math.max(minY, viewportHeight - targetSize.height - DIALOG_VIEWPORT_GUTTER);

      return {
        x: Math.min(Math.max(nextPosition.x, minX), maxX),
        y: Math.min(Math.max(nextPosition.y, minY), maxY),
      };
    },
    [getElementSize]
  );

  const getCenteredPosition = useCallback((size?: { width: number; height: number } | null) => {
    const targetSize = size ?? getElementSize();
    const { width: viewportWidth, height: viewportHeight } = getViewportSize();

    if (!targetSize) {
      return clampPositionToViewport({
        x: viewportWidth / 2,
        y: viewportHeight / 2,
      }, { width: 0, height: 0 });
    }

    return clampPositionToViewport({
      x: (viewportWidth - targetSize.width) / 2,
      y: (viewportHeight - targetSize.height) / 2,
    }, targetSize);
  }, [clampPositionToViewport, getElementSize]);

  const { defaultPosition = getCenteredPosition(), enabled = false, open = false } = options;

  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!elementRef.current || initializedRef.current || options.defaultPosition) {
      return;
    }

    const centeredPosition = getCenteredPosition();
    setPosition(centeredPosition);
    startPosRef.current = centeredPosition;
    initializedRef.current = true;
  }, [getCenteredPosition, options.defaultPosition]);

  const calculateBounds = useCallback((clientX: number, clientY: number) => {
    const newX = startPosRef.current.x + (clientX - startClientRef.current.x);
    const newY = startPosRef.current.y + (clientY - startClientRef.current.y);

    return clampPositionToViewport({ x: newX, y: newY });
  }, [clampPositionToViewport]);

  const startDrag = useCallback((e: ReactMouseEvent<HTMLElement> | MouseEvent) => {
    if (!enabled) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    startPosRef.current = { ...position };
    startClientRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    userHasDraggedRef.current = true;

    document.body.style.userSelect = 'none';
  }, [enabled, position]);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const newPosition = calculateBounds(e.clientX, e.clientY);
    setPosition(newPosition);
  }, [isDragging, calculateBounds]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = '';
  }, []);

  // Reset centering state when the dialog closes so the next open re-centers
  // from scratch. This cannot live in setElementRef's null branch: Radix's
  // composed ref is recreated every render, so React re-fires (null, node)
  // on each render and the null call cannot tell a real close from ref churn.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      userHasDraggedRef.current = false;
    }
  }, [open]);

  // Attach global drag listeners only while a drag is in progress; a closed
  // (or unmounted) dialog must not keep document-level handlers alive. The
  // teardown also restores userSelect in case we unmount mid-drag, since
  // endDrag would never fire then.
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);

    return () => {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', endDrag);
      document.body.style.userSelect = '';
    };
  }, [isDragging, onDrag, endDrag]);

  useEffect(() => {
    if (!enabled || !open) {
      return;
    }

    const handleResize = () => {
      const nextSize = getElementSize();

      const nextPosition = options.defaultPosition
        ? clampPositionToViewport(options.defaultPosition, nextSize ?? undefined)
        : getCenteredPosition(nextSize);

      setPosition(nextPosition);
      startPosRef.current = nextPosition;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPositionToViewport, enabled, open, getElementSize, getCenteredPosition, options.defaultPosition]);

  // React re-invokes this with (null, node) on every render because Radix's
  // composed ref changes identity each render — so the null call must stay
  // cheap and idempotent: it only tears down the observer. Close-time state
  // reset is handled by the `open` effect above.
  const setElementRef = useCallback((el: HTMLElement | null) => {
    // Tear down any previous observer before switching elements or when the
    // element detaches, so we never keep observing a node removed from the
    // document (which would pin the whole dialog DOM tree in memory).
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    elementRef.current = el;

    if (!el) {
      return;
    }

    const nextSize = getElementSize(el);

    // First-paint centering: use the size available now, even if the
    // dialog's content will grow later (ResizeObserver will catch up).
    if (!initializedRef.current && !options.defaultPosition) {
      const centeredPosition = getCenteredPosition(nextSize);
      setPosition(centeredPosition);
      startPosRef.current = centeredPosition;
      initializedRef.current = true;
    }

    // Follow-up centering: when content loads asynchronously (e.g. data
    // fetched after mount), the dialog's size changes and it should
    // re-center — unless the user has already chosen a position by
    // dragging it, in which case we leave their choice alone.
    if (!options.defaultPosition && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (userHasDraggedRef.current) {
          return;
        }
        // entry.contentRect excludes padding/border; re-measure via border-box.
        const nextSize = getElementSize(el);
        if (!nextSize || nextSize.width <= 0 || nextSize.height <= 0) {
          return;
        }
        const centered = getCenteredPosition(nextSize);
        setPosition(centered);
        startPosRef.current = centered;
      });
      observer.observe(el);
      resizeObserverRef.current = observer;
    }
  }, [getElementSize, getCenteredPosition, options.defaultPosition]);

  return {
    position,
    isDragging,
    elementRef,
    setElementRef,
    handleMouseDown: startDrag,
  };
}

function hasCustomDialogContent(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child)) {
      return false;
    }

    if (child.type === DialogContent) {
      return true;
    }

    if (child.type === Fragment) {
      const fragmentChildren = (child.props as { children?: ReactNode }).children;
      return hasCustomDialogContent(fragmentChildren);
    }

    return false;
  });
}

export function Dialog(props: IDialogProps) {
  const {
    className,
    children,
    style,
    open = false,
    title,
    width,
    draggable = false,
    defaultPosition,
    footer: propFooter,
    mask = true,
    modal: modalProp,
    keyboard = true,
    closable = true,
    maskClosable = true,
    showOk,
    showCancel,
    disableAutoFocus = false,
    onOpenChange,
    onClose,
    onOk,
    onCancel,
  } = props;

  const { locale } = useContext(ConfigContext);
  const shouldRenderRootOnly = hasCustomDialogContent(children);
  const resolvedWidth = width ? (typeof width === 'number' ? `${width}px` : width) : undefined;
  // Decouple visual mask from Radix's modal lock. Default keeps the historical
  // "mask implies modal" behavior; callers can opt out when they embed Portal
  // popups that get killed by `disableOutsidePointerEvents`.
  const modal = modalProp ?? mask;
  const renderStandaloneBackdrop = mask && !modal;

  const { position, isDragging, setElementRef, handleMouseDown } = useDraggable({ defaultPosition, enabled: draggable, open });

  const dragContextValue = useMemo<IDialogDragContextValue>(
    () => ({ draggable, onMouseDown: draggable ? handleMouseDown : undefined }),
    [draggable, handleMouseDown]
  );

  const footer = propFooter ?? (showOk || showCancel
    ? (
      <div className="tm:flex tm:justify-end tm:gap-2">
        {showCancel && (
          <Button variant="outline" onClick={onCancel}>
            {locale?.Confirm?.cancel ?? 'Cancel'}
          </Button>
        )}
        {showOk && (
          <Button variant="default" onClick={onOk}>
            {locale?.Confirm?.confirm ?? 'OK'}
          </Button>
        )}
      </div>
    )
    : null);

  const handleContentRef = useCallback((node: HTMLDivElement | null) => {
    // Forward null too: setElementRef's cleanup branch disconnects the
    // ResizeObserver and resets centering state when the content unmounts.
    if (draggable) {
      setElementRef(node);
    }
  }, [draggable, setElementRef]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!mask && !isOpen) {
      return;
    }

    onOpenChange?.(isOpen);

    if (!isOpen) {
      onClose?.();
    }
  }, [onClose, onOpenChange]);

  function handleClickClose() {
    onOpenChange?.(false);
    onClose?.();
  }

  if (shouldRenderRootOnly) {
    return (
      <DialogProvider
        open={open}
        onOpenChange={handleOpenChange}
        modal={modal}
      >
        {renderStandaloneBackdrop && (
          <DialogPortal>
            <div
              data-slot="dialog-backdrop"
              className="tm:fixed tm:inset-0 tm:z-50 tm:bg-darker-black/50"
              onClick={maskClosable ? handleClickClose : undefined}
            />
          </DialogPortal>
        )}
        <DialogDragContext.Provider value={dragContextValue}>
          {children}
        </DialogDragContext.Provider>
      </DialogProvider>
    );
  }

  return (
    <DialogProvider
      open={open}
      onOpenChange={handleOpenChange}
      modal={modal}
    >
      {renderStandaloneBackdrop && (
        <DialogPortal>
          <div
            data-slot="dialog-backdrop"
            className="tm:fixed tm:inset-0 tm:z-50 tm:bg-darker-black/50"
            onClick={maskClosable ? handleClickClose : undefined}
          />
        </DialogPortal>
      )}
      <DialogContent
        ref={handleContentRef}
        className={cn(className, {
          'tm:data-[state=closed]:animate-none tm:data-[state=open]:animate-none': draggable,
        })}
        style={{
          ...style,
          width: resolvedWidth,
          maxWidth: resolvedWidth ? style?.maxWidth ?? DIALOG_VIEWPORT_MAX_WIDTH : style?.maxWidth,
          maxHeight: style?.maxHeight ?? DIALOG_VIEWPORT_MAX_HEIGHT,
          ...(draggable
            ? {
              position: 'fixed',
              margin: 0,
              left: `${position.x}px`,
              top: `${position.y}px`,
              translate: 'none',
              transform: 'none',
              transition: isDragging ? 'none' : undefined,
              cursor: isDragging ? 'grabbing' : undefined,
            }
            : {}),
        }}
        closable={closable}
        onClickClose={handleClickClose}
        onEscapeKeyDown={(e) => {
          if (keyboard) {
            handleClickClose();
          }
          e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (maskClosable) {
            handleClickClose();
          }
          e.preventDefault();
        }}
        onFocusOutside={(e) => {
          // A non-modal Dialog must not close just because focus moved into a
          // portalled layer outside its React subtree — e.g. a global confirm
          // dialog opened via IConfirmService, which renders under GLOBAL, not
          // under this Dialog. Radix's non-modal DismissableLayer treats such
          // focus as "outside" and would dismiss us. Outside *clicks* still
          // close via onPointerDownOutside above; focus alone is not a dismiss
          // intent. Radix's modal path already preventDefaults this internally.
          e.preventDefault();
        }}
        onOpenAutoFocus={(e) => {
          if (disableAutoFocus) {
            e.preventDefault();
          }
        }}
      >
        <DialogDragContext.Provider value={dragContextValue}>
          <DialogHeader
            className={cn({
              'tm:hidden': !title,
            })}
            data-drag-handle={draggable ? 'true' : undefined}
            style={{
              cursor: draggable ? 'grab' : undefined,
              userSelect: draggable ? 'none' : undefined,
              touchAction: draggable ? 'none' : undefined,
            }}
            onMouseDown={draggable ? handleMouseDown : undefined}
          >
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="tm:hidden" />
          </DialogHeader>

          {children}

          {footer && (
            <DialogFooter>
              {footer}
            </DialogFooter>
          )}
        </DialogDragContext.Provider>
      </DialogContent>
    </DialogProvider>
  );
}
