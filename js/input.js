export function directionFromDelta(deltaX, deltaY, threshold = 24) {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return null;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX > 0 ? 'right' : 'left';
  return deltaY > 0 ? 'down' : 'up';
}

export function neighborFromDirection(position, direction) {
  const offsets = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  };
  const [row, col] = offsets[direction] ?? [0, 0];
  return { row: position.row + row, col: position.col + col };
}

function positionFromTarget(target) {
  const tile = target.closest?.('.tile');
  if (!tile) return null;
  return { row: Number(tile.dataset.row), col: Number(tile.dataset.col) };
}

export function bindBoardInput(boardElement, handlers) {
  let start = null;
  let pointerId = null;

  const onPointerDown = (event) => {
    const position = positionFromTarget(event.target);
    if (!position || handlers.isLocked?.()) return;
    start = { position, x: event.clientX, y: event.clientY };
    pointerId = event.pointerId;
    event.target.closest('.tile')?.setPointerCapture?.(pointerId);
  };

  const onPointerUp = (event) => {
    if (!start || event.pointerId !== pointerId) return;
    const direction = directionFromDelta(event.clientX - start.x, event.clientY - start.y);
    if (direction) handlers.onSwap?.(start.position, neighborFromDirection(start.position, direction));
    else handlers.onTap?.(start.position);
    start = null;
    pointerId = null;
  };

  const onPointerCancel = () => {
    start = null;
    pointerId = null;
  };

  const beginLegacyGesture = (target, point) => {
    const position = positionFromTarget(target);
    if (!position || handlers.isLocked?.()) return;
    start = { position, x: point.clientX, y: point.clientY };
  };
  const finishLegacyGesture = (point) => {
    if (!start) return;
    const direction = directionFromDelta(point.clientX - start.x, point.clientY - start.y);
    if (direction) handlers.onSwap?.(start.position, neighborFromDirection(start.position, direction));
    else handlers.onTap?.(start.position);
    start = null;
  };
  const onTouchStart = (event) => {
    event.preventDefault();
    beginLegacyGesture(event.target, event.touches[0]);
  };
  const onTouchEnd = (event) => {
    event.preventDefault();
    finishLegacyGesture(event.changedTouches[0]);
  };
  const onMouseDown = (event) => beginLegacyGesture(event.target, event);
  const onMouseUp = (event) => finishLegacyGesture(event);
  const onContextMenu = (event) => event.preventDefault();
  const supportsPointer = Boolean(boardElement.ownerDocument?.defaultView?.PointerEvent);

  if (supportsPointer) {
    boardElement.addEventListener('pointerdown', onPointerDown);
    boardElement.addEventListener('pointerup', onPointerUp);
    boardElement.addEventListener('pointercancel', onPointerCancel);
  } else {
    boardElement.addEventListener('touchstart', onTouchStart, { passive: false });
    boardElement.addEventListener('touchend', onTouchEnd, { passive: false });
    boardElement.addEventListener('mousedown', onMouseDown);
    boardElement.addEventListener('mouseup', onMouseUp);
  }
  boardElement.addEventListener('contextmenu', onContextMenu);

  return () => {
    if (supportsPointer) {
      boardElement.removeEventListener('pointerdown', onPointerDown);
      boardElement.removeEventListener('pointerup', onPointerUp);
      boardElement.removeEventListener('pointercancel', onPointerCancel);
    } else {
      boardElement.removeEventListener('touchstart', onTouchStart);
      boardElement.removeEventListener('touchend', onTouchEnd);
      boardElement.removeEventListener('mousedown', onMouseDown);
      boardElement.removeEventListener('mouseup', onMouseUp);
    }
    boardElement.removeEventListener('contextmenu', onContextMenu);
  };
}
