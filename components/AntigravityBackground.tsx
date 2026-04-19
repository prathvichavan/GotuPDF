"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  driftPhase: number;
  driftSpeed: number;
  driftRadius: number;
};

const COLORS: Array<[number, number, number]> = [
  [59, 130, 246],
  [147, 51, 234],
  [236, 72, 153],
  [249, 115, 22],
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export default function AntigravityBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const deviceMemory = nav.deviceMemory ?? 8;
    const saveData = nav.connection?.saveData ?? false;
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;

    const isLowEnd = deviceMemory <= 4 || hardwareConcurrency <= 4 || saveData;
    const allowMotion = !prefersReducedMotion.matches;
    const interactionEnabled = allowMotion && !isLowEnd && !coarsePointer.matches;
    const ambientOnly = !interactionEnabled;

    let animationId = 0;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const pointer = {
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      vx: 0,
      vy: 0,
      active: false,
    };

    const pickColor = () => {
      const [r, g, b] = COLORS[Math.floor(Math.random() * COLORS.length)];
      const alpha = rand(0.26, 0.42);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const gaussian = (mean: number, stdDev: number) => {
      let u = 0;
      let v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      return mean + num * stdDev;
    };

    const buildParticles = () => {
      const area = width * height;
      const density = ambientOnly ? 18000 : 11000;
      const minCount = ambientOnly ? 80 : 150;
      const maxCount = ambientOnly ? 230 : 380;
      const count = clamp(Math.round(area / density), minCount, maxCount);
      const nextParticles: Particle[] = [];
      const centerX = width / 2;
      const centerY = height * 0.48;
      const clusterCount = ambientOnly ? 3 : 4;
      const clusters = Array.from({ length: clusterCount }, () => ({
        x: centerX + rand(-width * 0.16, width * 0.16),
        y: centerY + rand(-height * 0.18, height * 0.18),
        spreadX: width * rand(0.08, 0.16),
        spreadY: height * rand(0.08, 0.18),
      }));

      for (let i = 0; i < count; i += 1) {
        const useCluster = Math.random() < 0.72;
        let x = 0;
        let y = 0;

        if (useCluster) {
          const cluster = clusters[Math.floor(Math.random() * clusters.length)];
          x = gaussian(cluster.x, cluster.spreadX);
          y = gaussian(cluster.y, cluster.spreadY);
        } else {
          x = Math.random() * width;
          y = Math.random() * height;
          const centerBias = Math.random();
          if (centerBias < 0.45) {
            x = gaussian(centerX, width * 0.18);
            y = gaussian(centerY, height * 0.22);
          }
        }

        x = clamp(x, 0, width);
        y = clamp(y, 0, height);

        nextParticles.push({
          x,
          y,
          ox: x,
          oy: y,
          vx: 0,
          vy: 0,
          size: rand(0.9, 2.4),
          color: pickColor(),
          driftPhase: Math.random() * Math.PI * 2,
          driftSpeed: rand(0.09, 0.24),
          driftRadius: rand(6, 18),
        });
      }

      particles = nextParticles;
      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.tx = pointer.x;
      pointer.ty = pointer.y;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, isLowEnd ? 1.5 : 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildParticles();
      drawStatic();
    };

    const drawParticle = (particle: Particle) => {
      context.beginPath();
      context.fillStyle = particle.color;
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    };

    const drawStatic = () => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        particle.x = particle.ox;
        particle.y = particle.oy;
        drawParticle(particle);
      }
    };

    const animate = () => {
      context.clearRect(0, 0, width, height);

      const time = performance.now() * 0.001;
      const influenceRadius = interactionEnabled ? Math.min(width, height) * 0.26 : 0;
      const maxPull = interactionEnabled ? 0.11 : 0;
      const waveStrength = interactionEnabled ? 0.085 : 0;
      const spring = 0.014;
      const damping = ambientOnly ? 0.925 : 0.905;

      if (interactionEnabled) {
        const ease = pointer.active ? 0.24 : 0.1;
        pointer.x += (pointer.tx - pointer.x) * ease;
        pointer.y += (pointer.ty - pointer.y) * ease;
        pointer.vx = (pointer.tx - pointer.x) * 0.16;
        pointer.vy = (pointer.ty - pointer.y) * 0.16;
      }

      for (const particle of particles) {
        const driftX = Math.cos(time * particle.driftSpeed + particle.driftPhase) * particle.driftRadius;
        const driftY = Math.sin(time * particle.driftSpeed + particle.driftPhase) * particle.driftRadius;
        const targetX = particle.ox + driftX;
        const targetY = particle.oy + driftY;

        particle.vx += (targetX - particle.x) * spring;
        particle.vy += (targetY - particle.y) * spring;

        if (interactionEnabled && pointer.active) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.001 && dist < influenceRadius) {
            const strength = (1 - dist / influenceRadius) * maxPull;
            particle.vx += (dx / dist) * strength;
            particle.vy += (dy / dist) * strength;
          }
          const flow = Math.max(0, 1 - dist / (influenceRadius * 1.2));
          particle.vx += pointer.vx * flow * waveStrength;
          particle.vy += pointer.vy * flow * waveStrength;
        }

        particle.vx *= damping;
        particle.vy *= damping;
        particle.x += particle.vx;
        particle.y += particle.vy;

        drawParticle(particle);
      }

      animationId = requestAnimationFrame(animate);
    };

    const start = () => {
      cancelAnimationFrame(animationId);
      if (allowMotion) {
        animationId = requestAnimationFrame(animate);
      } else {
        drawStatic();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.active = true;
      const rect = canvas.getBoundingClientRect();
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
    };

    const handlePointerLeave = (event: MouseEvent) => {
      if (event.relatedTarget === null) {
        pointer.active = false;
        pointer.tx = width / 2;
        pointer.ty = height / 2;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else {
        start();
      }
    };

    resize();
    start();

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    if (interactionEnabled) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("mouseout", handlePointerLeave, { passive: true });
    }

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (interactionEnabled) {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("mouseout", handlePointerLeave);
      }
    };
  }, []);

  return (
    <div className="antigravity-background" aria-hidden="true">
      <canvas className="antigravity-canvas" ref={canvasRef} />
    </div>
  );
}
