/**
 * Horizontal scroll: touch/mouse drag (lazy threshold), wheel on desktop, programmatic scroll.
 * Native image/link drag is blocked so desktop scrolling works while the cursor is over a product.
 */
export function useHorizontalDragScroll(containerRef: Ref<HTMLElement | null>) {
  const isDragging = ref(false);

  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let activePointerId: number | null = null;
  let pendingPointer = false;
  let didDrag = false;
  let windowBound = false;

  const DRAG_THRESHOLD_MOUSE = 8;
  const DRAG_THRESHOLD_TOUCH = 6;

  function dragThreshold(pointerType: string) {
    return pointerType === 'mouse' ? DRAG_THRESHOLD_MOUSE : DRAG_THRESHOLD_TOUCH;
  }

  function shouldIgnoreDragStart(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    if (target.closest('.chip-strip')) return false;
    return Boolean(target.closest('button, input, textarea, select, label, [role="button"]'));
  }

  function onDragStart(event: DragEvent) {
    event.preventDefault();
  }

  function bindWindowPointer() {
    if (windowBound) return;
    windowBound = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function unbindWindowPointer() {
    if (!windowBound) return;
    windowBound = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function onPointerDown(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || event.button !== 0 || shouldIgnoreDragStart(event.target)) return;
    // Touch keeps native pan so a vertical swipe on a product still scrolls the page.
    if (event.pointerType === 'touch') return;

    pendingPointer = true;
    isDragging.value = false;
    didDrag = false;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = el.scrollLeft;
    bindWindowPointer();
  }

  function onPointerMove(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || activePointerId !== event.pointerId || !pendingPointer) return;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!isDragging.value) {
      const threshold = dragThreshold(event.pointerType);
      if (Math.abs(deltaX) <= threshold && Math.abs(deltaY) <= threshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        abortPending();
        return;
      }
      isDragging.value = true;
      didDrag = true;
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      el.classList.add('is-dragging');
    }

    if (event.pointerType === 'mouse') {
      event.preventDefault();
    }

    el.scrollLeft = startScrollLeft - deltaX;
  }

  function onPointerUp(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    finishDrag();
  }

  function onPointerCancel(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    finishDrag();
  }

  function abortPending() {
    unbindWindowPointer();
    pendingPointer = false;
    isDragging.value = false;
    didDrag = false;
    activePointerId = null;
  }

  function finishDrag() {
    const el = containerRef.value;
    if (el && activePointerId != null && isDragging.value) {
      try {
        el.releasePointerCapture(activePointerId);
      } catch {
        // ignore
      }
      el.classList.remove('is-dragging');
    }

    if (didDrag && el) {
      const blockClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      el.addEventListener('click', blockClick, { capture: true, once: true });
    }

    unbindWindowPointer();
    pendingPointer = false;
    isDragging.value = false;
    activePointerId = null;
  }

  function onWheel(event: WheelEvent) {
    const el = containerRef.value;
    if (!el || !import.meta.client) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 2) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) return;

    const before = el.scrollLeft;
    el.scrollLeft += delta;
    if (el.scrollLeft !== before) {
      event.preventDefault();
    }
  }

  function scrollByPage(direction: -1 | 1) {
    const el = containerRef.value;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.75), behavior: 'smooth' });
  }

  function bind() {
    const el = containerRef.value;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('dragstart', onDragStart, true);
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
  }

  function unbind() {
    unbindWindowPointer();
    const el = containerRef.value;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('dragstart', onDragStart, true);
    el.removeEventListener('wheel', onWheel, true);
  }

  onMounted(() => nextTick(bind));
  onUnmounted(unbind);

  return { isDragging, scrollByPage };
}
