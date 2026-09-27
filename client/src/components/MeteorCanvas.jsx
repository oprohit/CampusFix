import React, { useEffect, useRef } from 'react';

export default function MeteorCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Ambient floating white stardust / particles
    const particleCount = Math.floor(Math.min(width, 1400) / 22);
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.7 + 0.2,
      speedY: Math.random() * 0.4 + 0.15,
      speedX: (Math.random() - 0.5) * 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.008,
      pulseDir: Math.random() > 0.5 ? 1 : -1,
    }));

    // Falling Meteors / Shooting Stars
    const meteors = [];
    const maxMeteors = 4;
    let lastMeteorTime = Date.now();
    let nextMeteorInterval = 800 + Math.random() * 1400; // 0.8s to 2.2s

    const spawnMeteor = () => {
      const angle = (Math.PI / 180) * (38 + Math.random() * 14); // ~40-52 degrees diagonal
      const speed = 14 + Math.random() * 12;
      const length = 120 + Math.random() * 140;
      
      // Spawn either from top or left edge
      const startFromTop = Math.random() > 0.35;
      const x = startFromTop ? Math.random() * (width * 0.85) : -20;
      const y = startFromTop ? -20 : Math.random() * (height * 0.45);

      meteors.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        length,
        size: Math.random() * 1.8 + 1.2,
        opacity: 1,
        fadeSpeed: 0.008 + Math.random() * 0.006,
        life: 0,
        maxLife: 60 + Math.random() * 30,
      });
    };

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw floating ambient particles (white stardust)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX;
        p.alpha += p.pulseSpeed * p.pulseDir;
        if (p.alpha > 0.95) p.pulseDir = -1;
        if (p.alpha < 0.15) p.pulseDir = 1;

        if (p.y > height) {
          p.y = -5;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(235, 215, 255, 0.8)';
        ctx.fill();
      }

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      // 2. Spawn meteors at randomized intervals
      const now = Date.now();
      if (now - lastMeteorTime > nextMeteorInterval && meteors.length < maxMeteors) {
        spawnMeteor();
        lastMeteorTime = now;
        nextMeteorInterval = 900 + Math.random() * 1800;
      }

      // 3. Draw meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.dx;
        m.y += m.dy;
        m.life++;

        if (m.life > m.maxLife * 0.6) {
          m.opacity -= m.fadeSpeed;
        }

        if (m.opacity <= 0 || m.x > width + 100 || m.y > height + 100) {
          meteors.splice(i, 1);
          continue;
        }

        // Calculate tail coordinate (behind current head)
        const angle = Math.atan2(m.dy, m.dx);
        const tailX = m.x - Math.cos(angle) * m.length;
        const tailY = m.y - Math.sin(angle) * m.length;

        // Meteor trail gradient
        const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.65, `rgba(200, 160, 255, ${m.opacity * 0.45})`);
        gradient.addColorStop(0.9, `rgba(255, 255, 255, ${m.opacity * 0.85})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${m.opacity})`);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = m.size;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glowing meteor head
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${m.opacity})`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
