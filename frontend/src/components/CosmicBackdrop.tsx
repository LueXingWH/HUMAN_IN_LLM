import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  fadeDirection: 1 | -1
}

export function CosmicBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const canvasElement = canvas
    const drawingContext = context

    let width = 0
    let height = 0
    let animationFrame = 0
    let particles: Particle[] = []

    const particleCount = 96
    const connectionDistance = 112

    function initCanvas() {
      const ratio = window.devicePixelRatio || 1
      width = canvasElement.clientWidth
      height = canvasElement.clientHeight
      canvasElement.width = Math.max(1, Math.round(width * ratio))
      canvasElement.height = Math.max(1, Math.round(height * ratio))
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    class ParticleImpl {
      static create(): Particle {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.3 + 0.5,
          speedX: (Math.random() - 0.5) * 0.25,
          speedY: (Math.random() - 0.5) * 0.25,
          opacity: Math.random() * 0.4 + 0.1,
          fadeDirection: Math.random() > 0.5 ? 1 : -1,
        }
      }

      static update(particle: Particle) {
        particle.x += particle.speedX
        particle.y += particle.speedY
        particle.opacity += 0.004 * particle.fadeDirection
        if (particle.opacity >= 0.6) particle.fadeDirection = -1
        if (particle.opacity <= 0.05) particle.fadeDirection = 1

        if (particle.x < 0) particle.x = width
        if (particle.x > width) particle.x = 0
        if (particle.y < 0) particle.y = height
        if (particle.y > height) particle.y = 0
      }

      static draw(particle: Particle) {
        drawingContext.beginPath()
        drawingContext.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        drawingContext.fillStyle = `rgba(176, 181, 192, ${particle.opacity})`
        drawingContext.fill()
      }
    }

    function initParticles() {
      particles = Array.from({ length: particleCount }, () => ParticleImpl.create())
    }

    function animate() {
      drawingContext.clearRect(0, 0, width, height)
      for (let i = 0; i < particles.length; i += 1) {
        const current = particles[i]
        ParticleImpl.update(current)
        ParticleImpl.draw(current)
        for (let j = i; j < particles.length; j += 1) {
          const other = particles[j]
          const dx = current.x - other.x
          const dy = current.y - other.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < connectionDistance) {
            drawingContext.beginPath()
            drawingContext.moveTo(current.x, current.y)
            drawingContext.lineTo(other.x, other.y)
            const lineOpacity = (1 - distance / connectionDistance) * 0.08
            drawingContext.strokeStyle = `rgba(176, 181, 192, ${lineOpacity})`
            drawingContext.lineWidth = 0.5
            drawingContext.stroke()
          }
        }
      }
      animationFrame = window.requestAnimationFrame(animate)
    }

    function handleResize() {
      initCanvas()
      initParticles()
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  return <canvas ref={canvasRef} className="cosmic-backdrop" aria-hidden="true" />
}
