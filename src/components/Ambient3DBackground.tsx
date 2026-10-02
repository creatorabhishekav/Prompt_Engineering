import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { cursorInteractionState } from '@/lib/cursorState';

/**
 * Robust Error Boundary to catch any WebGL context or device initialization failures
 */
class ThreeErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Ambient3DBackground WebGL error handled gracefully:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

/**
 * Fog setup component to provide natural 3D depth attenuation:
 * Closer front edges appear darker forest green (#14532D), while rear edges fade subtly
 * into the very light mint background (#F3FAF5).
 */
function DepthAtmosphere() {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog('#F3FAF5', 5.0, 14.0);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return null;
}

interface VertexNode {
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  worldBasePos: THREE.Vector3;
  radius: number;
  isOuter: boolean;
}

/**
 * Screen-space attraction radii
 */
const DESKTOP_ATTRACTION_RADIUS = 180; // pixels
const TABLET_ATTRACTION_RADIUS = 140; // pixels
const MAX_DISPLACEMENT = 0.32; // world units displacement (distinctly visible)
const DEBUG_MAGNETIC = false; // Debug mode toggle (false for production)

/**
 * Dark Forest Green 3D Geometric Sculpture with Magnetic 3D Spherical Vertices
 */
function GeometricSculpture({
  shouldReduceMotion,
  mouseRef,
}: {
  shouldReduceMotion: boolean;
  mouseRef: React.MutableRefObject<{
    clientX: number;
    clientY: number;
    ndcX: number;
    ndcY: number;
    isInsideWindow: boolean;
    isMousePointer: boolean;
  }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const secondaryGroupRef = useRef<THREE.Group>(null);
  const outerLineRef = useRef<THREE.LineSegments>(null);
  const boxLineRef = useRef<THREE.LineSegments>(null);
  const innerLineRef = useRef<THREE.LineSegments>(null);
  const outerMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const innerMeshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const { viewport } = useThree();

  // Tab visibility tracking to pause animation and save CPU/GPU cycles
  const isVisibleRef = useRef(true);
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Continuous rotation accumulators (refs to avoid React re-renders)
  const autoRotation = useRef({ x: 0.12, y: 0.25, z: 0.08 });
  const secondaryAutoRot = useRef({ x: 0, y: 0 });

  // Smoothed parallax values with inertia
  const parallaxPos = useRef({ x: 0, y: 0 });
  const parallaxTilt = useRef({ x: 0, y: 0 });

  // Debug log throttle
  const lastDebugLog = useRef(0);

  // Responsive scaling to achieve a 700px-1200px visual footprint on desktop
  const scale = useMemo(() => {
    if (viewport.width < 5) return 0.72; // mobile: ~340-420px
    if (viewport.width < 8) return 0.95; // tablet: ~520-680px
    if (viewport.width < 14) return 1.35; // desktop: ~850-1050px
    return 1.6; // large desktop: ~1100-1250px
  }, [viewport.width]);

  // Construct vertices and edge indices for the multi-tiered geometric sculpture
  const sculptureData = useMemo(() => {
    // 1. Outer Faceted Dodecahedron Cage (20 vertices, 30 edges)
    const dodecaGeom = new THREE.DodecahedronGeometry(3.1, 0);
    const dodecaPos = dodecaGeom.attributes.position.array;
    const outerVertices: VertexNode[] = [];
    const outerIndexMap = new Map<string, number>();

    for (let i = 0; i < dodecaPos.length; i += 3) {
      const v = new THREE.Vector3(dodecaPos[i], dodecaPos[i + 1], dodecaPos[i + 2]);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!outerIndexMap.has(key)) {
        outerIndexMap.set(key, outerVertices.length);
        outerVertices.push({
          basePos: v.clone(),
          targetPos: v.clone(),
          currentPos: v.clone(),
          worldBasePos: new THREE.Vector3(),
          radius: 0.13,
          isOuter: true,
        });
      }
    }

    const outerEdgesGeom = new THREE.EdgesGeometry(dodecaGeom);
    const outerEdgePos = outerEdgesGeom.attributes.position.array;
    const outerEdges: [number, number][] = [];
    for (let i = 0; i < outerEdgePos.length; i += 6) {
      const v1 = new THREE.Vector3(outerEdgePos[i], outerEdgePos[i + 1], outerEdgePos[i + 2]);
      const v2 = new THREE.Vector3(outerEdgePos[i + 3], outerEdgePos[i + 4], outerEdgePos[i + 5]);
      const k1 = `${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}`;
      const k2 = `${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}`;
      const idx1 = outerIndexMap.get(k1);
      const idx2 = outerIndexMap.get(k2);
      if (idx1 !== undefined && idx2 !== undefined) {
        outerEdges.push([idx1, idx2]);
      }
    }

    // 2. Intersecting Asymmetric Cube & Slender Prism (16 vertices, 24 edges)
    const box1Geom = new THREE.BoxGeometry(3.3, 3.3, 3.3);
    const box1EdgesGeom = new THREE.EdgesGeometry(box1Geom);
    const box1EdgePos = box1EdgesGeom.attributes.position.array;
    const boxVertices: VertexNode[] = [];
    const boxIndexMap = new Map<string, number>();

    const rotEuler = new THREE.Euler(0.42, 0.55, 0.2);
    for (let i = 0; i < box1EdgePos.length; i += 3) {
      const v = new THREE.Vector3(box1EdgePos[i], box1EdgePos[i + 1], box1EdgePos[i + 2]).applyEuler(
        rotEuler
      );
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!boxIndexMap.has(key)) {
        boxIndexMap.set(key, boxVertices.length);
        boxVertices.push({
          basePos: v.clone(),
          targetPos: v.clone(),
          currentPos: v.clone(),
          worldBasePos: new THREE.Vector3(),
          radius: 0.11,
          isOuter: true,
        });
      }
    }

    const boxEdges: [number, number][] = [];
    for (let i = 0; i < box1EdgePos.length; i += 6) {
      const v1 = new THREE.Vector3(box1EdgePos[i], box1EdgePos[i + 1], box1EdgePos[i + 2]).applyEuler(
        rotEuler
      );
      const v2 = new THREE.Vector3(
        box1EdgePos[i + 3],
        box1EdgePos[i + 4],
        box1EdgePos[i + 5]
      ).applyEuler(rotEuler);
      const k1 = `${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}`;
      const k2 = `${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}`;
      const idx1 = boxIndexMap.get(k1);
      const idx2 = boxIndexMap.get(k2);
      if (idx1 !== undefined && idx2 !== undefined) {
        boxEdges.push([idx1, idx2]);
      }
    }

    // 3. Inner Octahedron Core (6 vertices, 12 edges)
    const octaGeom = new THREE.OctahedronGeometry(1.85, 0);
    const octaPos = octaGeom.attributes.position.array;
    const innerVertices: VertexNode[] = [];
    const innerIndexMap = new Map<string, number>();

    for (let i = 0; i < octaPos.length; i += 3) {
      const v = new THREE.Vector3(octaPos[i], octaPos[i + 1], octaPos[i + 2]);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!innerIndexMap.has(key)) {
        innerIndexMap.set(key, innerVertices.length);
        innerVertices.push({
          basePos: v.clone(),
          targetPos: v.clone(),
          currentPos: v.clone(),
          worldBasePos: new THREE.Vector3(),
          radius: 0.085,
          isOuter: false,
        });
      }
    }

    const octaEdgesGeom = new THREE.EdgesGeometry(octaGeom);
    const octaEdgePos = octaEdgesGeom.attributes.position.array;
    const innerEdges: [number, number][] = [];
    for (let i = 0; i < octaEdgePos.length; i += 6) {
      const v1 = new THREE.Vector3(octaEdgePos[i], octaEdgePos[i + 1], octaEdgePos[i + 2]);
      const v2 = new THREE.Vector3(octaEdgePos[i + 3], octaEdgePos[i + 4], octaEdgePos[i + 5]);
      const k1 = `${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}`;
      const k2 = `${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}`;
      const idx1 = innerIndexMap.get(k1);
      const idx2 = innerIndexMap.get(k2);
      if (idx1 !== undefined && idx2 !== undefined) {
        innerEdges.push([idx1, idx2]);
      }
    }

    // Dynamic line segment buffer arrays
    const outerLineBuffer = new Float32Array(outerEdges.length * 6);
    const boxLineBuffer = new Float32Array(boxEdges.length * 6);
    const innerLineBuffer = new Float32Array(innerEdges.length * 6);

    const outerLineGeom = new THREE.BufferGeometry();
    outerLineGeom.setAttribute('position', new THREE.BufferAttribute(outerLineBuffer, 3));

    const boxLineGeom = new THREE.BufferGeometry();
    boxLineGeom.setAttribute('position', new THREE.BufferAttribute(boxLineBuffer, 3));

    const innerLineGeom = new THREE.BufferGeometry();
    innerLineGeom.setAttribute('position', new THREE.BufferAttribute(innerLineBuffer, 3));

    return {
      outerVertices,
      outerEdges,
      outerLineGeom,
      outerLineBuffer,
      boxVertices,
      boxEdges,
      boxLineGeom,
      boxLineBuffer,
      innerVertices,
      innerEdges,
      innerLineGeom,
      innerLineBuffer,
    };
  }, []);

  // Shared geometry and materials for 3D vertex spheres
  const sphereGeomOuter = useMemo(() => new THREE.SphereGeometry(0.13, 14, 14), []);
  const sphereGeomBox = useMemo(() => new THREE.SphereGeometry(0.11, 12, 12), []);
  const sphereGeomInner = useMemo(() => new THREE.SphereGeometry(0.085, 12, 12), []);

  const sphereMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#064E3B', // Deep dark forest green
        roughness: 0.3,
        metalness: 0.2,
      }),
    []
  );

  // Pre-allocated reusable vectors for zero-garbage collection animation loop
  const tempRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const tempMouseNDC = useMemo(() => new THREE.Vector2(), []);
  const tempPlane = useMemo(() => new THREE.Plane(), []);
  const tempCameraDir = useMemo(() => new THREE.Vector3(), []);
  const tempScreenProj = useMemo(() => new THREE.Vector3(), []);
  const tempMouseWorldAtDepth = useMemo(() => new THREE.Vector3(), []);
  const tempWorldDir = useMemo(() => new THREE.Vector3(), []);
  const tempWorldTarget = useMemo(() => new THREE.Vector3(), []);
  const tempInvGroupMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state, delta) => {
    if (shouldReduceMotion || !isVisibleRef.current) return;

    // 1. Slow continuous 3D rotation (approx 45-55s per revolution)
    autoRotation.current.y += delta * 0.078;
    autoRotation.current.x += delta * 0.026;
    autoRotation.current.z += delta * 0.012;

    // 2. Counter-rotation for inner core
    secondaryAutoRot.current.y -= delta * 0.042;
    secondaryAutoRot.current.x += delta * 0.016;

    // 3. Subtle vertical floating motion
    const floatY = Math.sin(state.clock.elapsedTime * 0.45) * 0.16;

    // 4. Smooth Mouse Parallax Calculation (Normalized & Clamped [-1, 1])
    let targetShiftX = 0;
    let targetShiftY = floatY;
    let targetTiltY = 0;
    let targetTiltX = 0;

    const mouse = mouseRef.current;
    if (mouse.isInsideWindow && mouse.isMousePointer) {
      const clampedX = Math.max(-1, Math.min(1, mouse.ndcX));
      const clampedY = Math.max(-1, Math.min(1, mouse.ndcY));

      targetShiftX = clampedX * 0.52;
      targetShiftY = clampedY * 0.38 + floatY;

      targetTiltY = clampedX * 0.065;
      targetTiltX = -clampedY * 0.052;
    }

    // 5. Inertia / Lerp smoothing towards mouse parallax target
    parallaxPos.current.x += (targetShiftX - parallaxPos.current.x) * 0.045;
    parallaxPos.current.y += (targetShiftY - parallaxPos.current.y) * 0.045;
    parallaxTilt.current.x += (targetTiltX - parallaxTilt.current.x) * 0.045;
    parallaxTilt.current.y += (targetTiltY - parallaxTilt.current.y) * 0.045;

    // 6. Apply additive position and rotation to group
    if (groupRef.current) {
      groupRef.current.position.x = parallaxPos.current.x;
      groupRef.current.position.y = parallaxPos.current.y;

      groupRef.current.rotation.x = autoRotation.current.x + parallaxTilt.current.x;
      groupRef.current.rotation.y = autoRotation.current.y + parallaxTilt.current.y;
      groupRef.current.rotation.z = autoRotation.current.z;

      groupRef.current.updateMatrixWorld();
      tempInvGroupMatrix.copy(groupRef.current.matrixWorld).invert();
    }

    if (secondaryGroupRef.current) {
      secondaryGroupRef.current.rotation.x = secondaryAutoRot.current.x;
      secondaryGroupRef.current.rotation.y = secondaryAutoRot.current.y;
    }

    // 7. SCREEN-SPACE MAGNETIC VERTEX ATTRACTION & SPRING-BACK UPDATE
    const canvasWidth = state.size.width;
    const canvasHeight = state.size.height;
    const attractionRadius =
      canvasWidth > 768 ? DESKTOP_ATTRACTION_RADIUS : TABLET_ATTRACTION_RADIUS;

    state.camera.getWorldDirection(tempCameraDir);
    tempMouseNDC.set(mouse.ndcX, mouse.ndcY);
    tempRaycaster.setFromCamera(tempMouseNDC, state.camera);

    let nearestScreenX = 0;
    let nearestScreenY = 0;
    let minScreenDist = 999999;

    const updateVertexGroup = (
      vertices: VertexNode[],
      meshRefs: (THREE.Mesh | null)[],
      edges: [number, number][],
      lineBuffer: Float32Array,
      lineGeom: THREE.BufferGeometry,
      groupOffset: number
    ) => {
      if (!groupRef.current) return;
      const groupMatrix = groupRef.current.matrixWorld;

      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];

        // 1. Calculate vertex permanent base position in world space
        v.worldBasePos.copy(v.basePos).applyMatrix4(groupMatrix);

        // 2. Project onto screen coordinates
        tempScreenProj.copy(v.worldBasePos).project(state.camera);
        const screenX = (tempScreenProj.x * 0.5 + 0.5) * canvasWidth;
        const screenY = (-tempScreenProj.y * 0.5 + 0.5) * canvasHeight;

        // 3. Screen-space distance to mouse pointer
        const dx = mouse.clientX - screenX;
        const dy = mouse.clientY - screenY;
        const screenDistance = Math.sqrt(dx * dx + dy * dy);

        // Track nearest vertex for kinetic cursor synchronization
        if (screenDistance < minScreenDist) {
          minScreenDist = screenDistance;
          nearestScreenX = screenX;
          nearestScreenY = screenY;
        }

        const isAttracted =
          mouse.isInsideWindow &&
          mouse.isMousePointer &&
          screenDistance < attractionRadius;

        if (isAttracted) {
          // Normalized distance & smooth quadratic falloff
          const normDist = Math.max(0, 1 - screenDistance / attractionRadius);
          const force = normDist * normDist;

          // Project ray onto camera-facing depth plane passing through vertex's base position
          tempPlane.setFromNormalAndCoplanarPoint(tempCameraDir, v.worldBasePos);
          tempRaycaster.ray.intersectPlane(tempPlane, tempMouseWorldAtDepth);

          // Vector from vertex base to mouse at that depth
          tempWorldDir.subVectors(tempMouseWorldAtDepth, v.worldBasePos);
          const worldDist = tempWorldDir.length();

          if (worldDist > 0.0001) {
            tempWorldDir.divideScalar(worldDist);
          }

          // Displace toward mouse clamped to MAX_DISPLACEMENT
          const displacement = Math.min(MAX_DISPLACEMENT, force * MAX_DISPLACEMENT);
          tempWorldTarget.copy(v.worldBasePos).addScaledVector(tempWorldDir, displacement);

          // Convert world target back to local group coordinates (cancels all group transform noise)
          v.targetPos.copy(tempWorldTarget).applyMatrix4(tempInvGroupMatrix);

          if (DEBUG_MAGNETIC && Date.now() - lastDebugLog.current > 500) {
            console.log(
              `[Magnetic Debug] Vertex #${groupOffset + i}: screenDist=${screenDistance.toFixed(
                1
              )}px, force=${force.toFixed(2)}, disp=${displacement.toFixed(3)}`
            );
            lastDebugLog.current = Date.now();
          }
        } else {
          // Far vertex: permanent base position anchor (zero accumulated drift)
          v.targetPos.copy(v.basePos);
        }

        // 4. Smooth spring-back interpolation (soft elastic response)
        const lerpFactor = isAttracted ? 0.14 : 0.09;
        v.currentPos.lerp(v.targetPos, lerpFactor);

        // Update 3D sphere mesh position
        const mesh = meshRefs[i];
        if (mesh) {
          mesh.position.copy(v.currentPos);
        }
      }

      // 5. Update line segments buffer so edges remain 100% attached to the moving spheres
      for (let e = 0; e < edges.length; e++) {
        const [idx1, idx2] = edges[e];
        const p1 = vertices[idx1].currentPos;
        const p2 = vertices[idx2].currentPos;
        const bufIdx = e * 6;

        lineBuffer[bufIdx] = p1.x;
        lineBuffer[bufIdx + 1] = p1.y;
        lineBuffer[bufIdx + 2] = p1.z;
        lineBuffer[bufIdx + 3] = p2.x;
        lineBuffer[bufIdx + 4] = p2.y;
        lineBuffer[bufIdx + 5] = p2.z;
      }

      lineGeom.attributes.position.needsUpdate = true;
    };

    // Update Outer Dodecahedron (vertices + edges)
    updateVertexGroup(
      sculptureData.outerVertices,
      outerMeshRefs.current,
      sculptureData.outerEdges,
      sculptureData.outerLineBuffer,
      sculptureData.outerLineGeom,
      0
    );

    // Update Intersecting Box Frame (vertices + edges)
    updateVertexGroup(
      sculptureData.boxVertices,
      outerMeshRefs.current.slice(sculptureData.outerVertices.length),
      sculptureData.boxEdges,
      sculptureData.boxLineBuffer,
      sculptureData.boxLineGeom,
      sculptureData.outerVertices.length
    );

    // Update Inner Core (vertices + edges)
    updateVertexGroup(
      sculptureData.innerVertices,
      innerMeshRefs.current,
      sculptureData.innerEdges,
      sculptureData.innerLineBuffer,
      sculptureData.innerLineGeom,
      sculptureData.outerVertices.length + sculptureData.boxVertices.length
    );

    // Synchronize nearest vertex information with kinetic cursor
    cursorInteractionState.nearestVertexX = nearestScreenX;
    cursorInteractionState.nearestVertexY = nearestScreenY;
    cursorInteractionState.nearestVertexDistance = minScreenDist;
    cursorInteractionState.isNearVertex = minScreenDist < attractionRadius;
    cursorInteractionState.isSnappedVertex = minScreenDist < 60;
    cursorInteractionState.magneticStrength = Math.max(0, 1 - minScreenDist / attractionRadius);
  });

  return (
    <group ref={groupRef} scale={scale} position={[0, 0, 0]}>
      {/* 1. Primary Outer Dodecahedron Cage — Dark Forest Green (#14532D) */}
      <lineSegments ref={outerLineRef} geometry={sculptureData.outerLineGeom}>
        <lineBasicMaterial
          color="#14532D"
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </lineSegments>

      {/* 2. Intersecting Asymmetric Cube — Secondary Dark Green (#166534) */}
      <lineSegments ref={boxLineRef} geometry={sculptureData.boxLineGeom}>
        <lineBasicMaterial
          color="#166534"
          transparent
          opacity={0.58}
          depthWrite={false}
        />
      </lineSegments>

      {/* 3. Outer Vertex Spheres — 3D Spherical Nodes with Depth (#064E3B) */}
      {sculptureData.outerVertices.map((v, i) => (
        <mesh
          key={`outer-${i}`}
          ref={(el) => {
            outerMeshRefs.current[i] = el;
          }}
          position={v.currentPos}
          geometry={sphereGeomOuter}
          material={sphereMaterial}
        />
      ))}

      {sculptureData.boxVertices.map((v, i) => (
        <mesh
          key={`box-${i}`}
          ref={(el) => {
            outerMeshRefs.current[sculptureData.outerVertices.length + i] = el;
          }}
          position={v.currentPos}
          geometry={sphereGeomBox}
          material={sphereMaterial}
        />
      ))}

      {/* 4. Secondary Tier — Internal Core (Octahedron) */}
      <group ref={secondaryGroupRef}>
        <lineSegments ref={innerLineRef} geometry={sculptureData.innerLineGeom}>
          <lineBasicMaterial
            color="#15803D"
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </lineSegments>

        {/* Inner Core Vertex Spheres */}
        {sculptureData.innerVertices.map((v, i) => (
          <mesh
            key={`inner-${i}`}
            ref={(el) => {
              innerMeshRefs.current[i] = el;
            }}
            position={v.currentPos}
            geometry={sphereGeomInner}
            material={sphereMaterial}
          />
        ))}
      </group>
    </group>
  );
}

/**
 * Ambient3DBackground Component
 * Renders the large animated 3D dark-green geometrical sculpture with magnetic spherical vertices.
 * Layered at z-0 with pointer-events: none to never block user interactions.
 */
export function Ambient3DBackground() {
  const location = useLocation();
  const shouldReduceMotion = Boolean(useReducedMotion());

  // Global mouse tracking ref (listens to window events so pointer-events: none canvas never misses pointer movements)
  const mouseRef = useRef({
    clientX: -99999,
    clientY: -99999,
    ndcX: 0,
    ndcY: 0,
    isInsideWindow: false,
    isMousePointer: true,
  });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const isMouse = e.pointerType !== 'touch';
      mouseRef.current.clientX = e.clientX;
      mouseRef.current.clientY = e.clientY;
      mouseRef.current.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current.isInsideWindow = true;
      mouseRef.current.isMousePointer = isMouse;

      cursorInteractionState.clientX = e.clientX;
      cursorInteractionState.clientY = e.clientY;
      cursorInteractionState.ndcX = mouseRef.current.ndcX;
      cursorInteractionState.ndcY = mouseRef.current.ndcY;
      cursorInteractionState.isInsideWindow = true;
      cursorInteractionState.isMousePointer = isMouse;
    };

    const handlePointerLeave = () => {
      mouseRef.current.isInsideWindow = false;
      cursorInteractionState.isInsideWindow = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  // Subtle opacity attenuation per route:
  // - Instructions/Home: more visible (~0.42)
  // - Challenge: medium/subtle (~0.28)
  // - Leaderboard / Result: subtle (~0.26)
  // - Login / Register: subtle (~0.28)
  // - Admin: very subtle (~0.14)
  const [routeOpacity, setRouteOpacity] = useState(0.42);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/instructions' || path === '/') {
      setRouteOpacity(0.42);
    } else if (path.startsWith('/admin')) {
      setRouteOpacity(0.14);
    } else if (path.startsWith('/challenge')) {
      setRouteOpacity(0.28);
    } else if (path.startsWith('/leaderboard') || path.startsWith('/result')) {
      setRouteOpacity(0.26);
    } else if (path === '/login' || path === '/register') {
      setRouteOpacity(0.28);
    } else {
      setRouteOpacity(0.28);
    }
  }, [location.pathname]);

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 
        Three.js Canvas Layer
        Alpha enabled so the very light mint background (#F3FAF5) shows through cleanly.
      */}
      <div
        className="absolute inset-0 h-full w-full transition-opacity duration-700 ease-out"
        style={{ opacity: routeOpacity }}
      >
        <ThreeErrorBoundary>
          <Canvas
            camera={{ position: [0, 0, 8.2], fov: 46 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'low-power',
            }}
            dpr={[1, 1.5]}
          >
            {/* Soft lighting giving 3D spherical vertices highlights, shadows, and tangible volume */}
            <ambientLight intensity={0.9} color="#ecfdf5" />
            <directionalLight position={[6, 9, 6]} intensity={1.5} color="#ffffff" />
            <directionalLight position={[-6, -4, -3]} intensity={0.4} color="#86efac" />

            <DepthAtmosphere />
            <GeometricSculpture
              shouldReduceMotion={shouldReduceMotion}
              mouseRef={mouseRef}
            />
          </Canvas>
        </ThreeErrorBoundary>
      </div>

      {/* 
        Soft peripheral radial fade to ensure 100% text and card legibility at the viewport perimeter
      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 95% 75% at 50% 48%, transparent 45%, rgba(243, 250, 245, 0.65) 100%)',
        }}
      />
    </div>
  );
}
