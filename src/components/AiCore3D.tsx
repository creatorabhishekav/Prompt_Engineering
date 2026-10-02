import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Target, Brain, Award } from 'lucide-react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function AiCore3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Mouse tilt offsets
  const targetTilt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (shouldReduceMotion) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetTilt.current = { x: nx * 0.8, y: -ny * 0.8 };
    };

    const handlePointerLeave = () => {
      targetTilt.current = { x: 0, y: 0 };
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handlePointerMove);
      container.addEventListener('mouseleave', handlePointerLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handlePointerMove);
        container.removeEventListener('mouseleave', handlePointerLeave);
      }
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;

    // Handle visibility pausing
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    // Dynamic resolution sizing
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const setSize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    setSize();
    window.addEventListener('resize', setSize);

    // 3D Icosahedron geometry vertices
    const phi = (1 + Math.sqrt(5)) / 2;
    const rawVertices: Point3D[] = [
      { x: -1, y: phi, z: 0 },
      { x: 1, y: phi, z: 0 },
      { x: -1, y: -phi, z: 0 },
      { x: 1, y: -phi, z: 0 },
      { x: 0, y: -1, z: phi },
      { x: 0, y: 1, z: phi },
      { x: 0, y: -1, z: -phi },
      { x: 0, y: 1, z: -phi },
      { x: phi, y: 0, z: -1 },
      { x: phi, y: 0, z: 1 },
      { x: -phi, y: 0, z: -1 },
      { x: -phi, y: 0, z: 1 },
    ].map((v) => {
      const len = Math.hypot(v.x, v.y, v.z);
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    });

    // Edges between vertices
    const edges: [number, number][] = [];
    const threshold = 1.1;
    for (let i = 0; i < rawVertices.length; i++) {
      for (let j = i + 1; j < rawVertices.length; j++) {
        const dx = rawVertices[i].x - rawVertices[j].x;
        const dy = rawVertices[i].y - rawVertices[j].y;
        const dz = rawVertices[i].z - rawVertices[j].z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < threshold) {
          edges.push([i, j]);
        }
      }
    }

    // Floating neural orbital particles
    const particleCount = 28;
    const particles = Array.from({ length: particleCount }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(Math.random() * 2 - 1),
      radius: 1.35 + Math.random() * 0.5,
      speed: (Math.random() * 0.006 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
      size: Math.random() * 1.5 + 1.2,
      glow: Math.random() * 0.4 + 0.3,
    }));

    let angleX = 0.2;
    let angleY = 0.4;
    let currentTiltX = 0;
    let currentTiltY = 0;

    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseScale = Math.min(w, h) * 0.28;

      // Smooth mouse interpolation
      if (!shouldReduceMotion) {
        currentTiltX += (targetTilt.current.x - currentTiltX) * 0.08;
        currentTiltY += (targetTilt.current.y - currentTiltY) * 0.08;
        angleY += 0.007;
        angleX += 0.003;
      }

      const rotY = angleY + currentTiltX;
      const rotX = angleX + currentTiltY;

      // Rotate 3D vector
      const rotate = (p: Point3D): Point3D => {
        // Y-axis rotation
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;

        // X-axis rotation
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        return { x: x1, y: y2, z: z2 };
      };

      // Project 3D -> 2D
      const fov = 4.2;
      const project = (p: Point3D) => {
        const factor = fov / (fov + p.z);
        return {
          x: cx + p.x * baseScale * factor,
          y: cy + p.y * baseScale * factor,
          z: p.z,
          scale: factor,
        };
      };

      // 1. Core internal glow gradient
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseScale * 0.9);
      coreGrad.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
      coreGrad.addColorStop(0.45, 'rgba(79, 70, 229, 0.12)');
      coreGrad.addColorStop(1, 'rgba(79, 70, 229, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseScale * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // 2. Transformed vertices
      const transformedVerts = rawVertices.map(rotate);
      const projectedVerts = transformedVerts.map(project);

      // 3. Render edges with depth-based lighting
      for (const [i, j] of edges) {
        const p1 = projectedVerts[i];
        const p2 = projectedVerts[j];
        const avgZ = (p1.z + p2.z) / 2;
        const alpha = Math.max(0.1, Math.min(0.85, (avgZ + 1.2) / 2.4));

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(129, 140, 248, ${alpha * 0.65})`;
        ctx.lineWidth = Math.max(0.8, (p1.scale + p2.scale) * 0.7);
        ctx.stroke();
      }

      // 4. Render vertices
      for (const p of projectedVerts) {
        const alpha = Math.max(0.2, (p.z + 1.2) / 2.2);
        const radius = Math.max(1.5, 3.2 * p.scale);

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(199, 210, 254, ${alpha})`;
        ctx.fill();

        if (p.z > 0.1) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${alpha * 0.28})`;
          ctx.fill();
        }
      }

      // 5. Render orbital particles
      for (const pt of particles) {
        if (!shouldReduceMotion) {
          pt.theta += pt.speed;
        }
        const px = pt.radius * Math.sin(pt.phi) * Math.cos(pt.theta);
        const py = pt.radius * Math.cos(pt.phi);
        const pz = pt.radius * Math.sin(pt.phi) * Math.sin(pt.theta);

        const rotated = rotate({ x: px, y: py, z: pz });
        const proj = project(rotated);
        const alpha = Math.max(0.12, (rotated.z + 1.5) / 3) * pt.glow;

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, pt.size * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(165, 180, 252, ${alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('resize', setSize);
    };
  }, [shouldReduceMotion]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full max-w-[480px] aspect-square mx-auto select-none pointer-events-auto"
      style={{ perspective: 1000 }}
    >
      {/* 3D Canvas Visual */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block relative z-10"
        aria-hidden="true"
      />

      {/* Floating Translucent Card: Top (Prompt Crafting) */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{
          opacity: 1,
          y: shouldReduceMotion ? 0 : [-4, 4, -4],
        }}
        transition={{
          opacity: { duration: 0.6, delay: 0.2 },
          y: { repeat: Infinity, duration: 4.8, ease: 'easeInOut' },
        }}
        className="absolute -top-3 sm:top-2 left-2 sm:left-4 z-20 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md max-w-[210px] sm:max-w-[230px]"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
          <Brain className="h-3 w-3 text-brand-600" />
          <span>Stage 01 · Prompt</span>
        </div>
        <p className="mt-1 font-mono text-[11px] leading-tight text-slate-700 truncate">
          &quot;Reflective crystalline hummingbird...&quot;
        </p>
      </motion.div>

      {/* Floating Translucent Card: Bottom-Left (Vision Alignment) */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{
          opacity: 1,
          x: 0,
          y: shouldReduceMotion ? 0 : [3, -5, 3],
        }}
        transition={{
          opacity: { duration: 0.6, delay: 0.35 },
          y: { repeat: Infinity, duration: 5.4, ease: 'easeInOut' },
        }}
        className="absolute bottom-4 sm:bottom-6 -left-2 sm:left-1 z-20 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
          <Target className="h-3 w-3 text-indigo-600" />
          <span>CLIP Vision</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-xs font-black text-slate-900">ViT-B/32</span>
          <span className="text-[10px] text-emerald-600 font-semibold">98.2% Match</span>
        </div>
      </motion.div>

      {/* Floating Translucent Card: Bottom-Right (AI Automated Score) */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{
          opacity: 1,
          x: 0,
          y: shouldReduceMotion ? 0 : [-5, 3, -5],
        }}
        transition={{
          opacity: { duration: 0.6, delay: 0.5 },
          y: { repeat: Infinity, duration: 5.1, ease: 'easeInOut' },
        }}
        className="absolute bottom-2 sm:bottom-4 -right-2 sm:right-1 z-20 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
          <Award className="h-3 w-3 text-amber-600" />
          <span>Evaluation</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="font-mono text-base font-black text-slate-900">76.8</span>
          <span className="font-mono text-[10px] text-slate-400 font-bold">/ 80 max</span>
        </div>
      </motion.div>

      {/* Subtle background glow */}
      <div className="absolute inset-0 rounded-full bg-brand-500/5 blur-3xl pointer-events-none" />
    </div>
  );
}
