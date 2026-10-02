/**
 * Shared Cursor & 3D Vertex Interaction State
 * Singleton mutable state object allowing zero-overhead, frame-by-frame synchronization
 * between Three.js (Ambient3DBackground) and DOM (KineticCursor) without triggering React re-renders.
 */

export interface CursorInteractionData {
  // Current mouse pointer in client/viewport pixel coordinates
  clientX: number;
  clientY: number;
  ndcX: number;
  ndcY: number;
  isInsideWindow: boolean;
  isMousePointer: boolean;

  // 3D Nearest Vertex awareness (updated in useFrame by Ambient3DBackground)
  nearestVertexX: number;
  nearestVertexY: number;
  nearestVertexDistance: number; // in screen pixels
  magneticStrength: number; // 0 to 1
  isNearVertex: boolean; // distance < 180px
  isSnappedVertex: boolean; // distance < 60px
}

export const cursorInteractionState: CursorInteractionData = {
  clientX: -99999,
  clientY: -99999,
  ndcX: 0,
  ndcY: 0,
  isInsideWindow: false,
  isMousePointer: true,

  nearestVertexX: 0,
  nearestVertexY: 0,
  nearestVertexDistance: 99999,
  magneticStrength: 0,
  isNearVertex: false,
  isSnappedVertex: false,
};
