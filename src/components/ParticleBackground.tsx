"use client";

import { useEffect, useRef } from "react";

// Lightweight canvas particle field — small drifting dots, no external deps.
// Respects prefers-reduced-motion by rendering a single static frame instead
// of animating.
export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Particle = {
      x: number;
      y: number;
      r: number;
      vy: number;
      swayAmp: number;
      swayFreq: number;
      phase: number;
      a: number;
    };
    let particles: Particle[] = [];
    let t = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = 14000; // px^2 per particle — lower = more particles
      const count = Math.round((width * height) / density);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.4,
        vy: Math.random() * 0.35 + 0.12, // falling speed — snow-like
        swayAmp: Math.random() * 0.6 + 0.15, // side-to-side drift width
        swayFreq: Math.random() * 0.015 + 0.005, // sway speed
        phase: Math.random() * Math.PI * 2,
        a: Math.random() * 0.5 + 0.15,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(127, 232, 179, ${p.a})`; // brand-light
        ctx!.fill();
      }
    }

    function step() {
      t += 1;
      for (const p of particles) {
        p.y += p.vy;
        p.x += Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
        if (p.y > height + 5) {
          p.y = -5;
          p.x = Math.random() * width;
        }
      }
      draw();
      frame = requestAnimationFrame(step);
    }

    let frame = 0;
    resize();
    draw();
    window.addEventListener("resize", resize);

    if (!reduceMotion) {
      frame = requestAnimationFrame(step);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
