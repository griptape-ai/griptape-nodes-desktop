import React, { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react'
import { useTutorial } from './TutorialProvider'
import { TUTORIAL_STEPS, TooltipPosition } from './tutorialSteps'
import { cn } from '../../utils/utils'

interface TargetRect {
  left: number
  top: number
  width: number
  height: number
}

interface TooltipPosition2D {
  left: number
  top: number
}

const SPOTLIGHT_PADDING = 8
const TOOLTIP_WIDTH = 340
const TOOLTIP_OFFSET = 16

function calculateTooltipPosition(
  targetRect: TargetRect,
  position: TooltipPosition,
  tooltipHeight: number
): TooltipPosition2D {
  const centerX = targetRect.left + targetRect.width / 2
  const centerY = targetRect.top + targetRect.height / 2

  switch (position) {
    case 'top':
      return {
        left: Math.max(
          16,
          Math.min(centerX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 16)
        ),
        top: Math.max(16, targetRect.top - SPOTLIGHT_PADDING - tooltipHeight - TOOLTIP_OFFSET)
      }
    case 'bottom':
      return {
        left: Math.max(
          16,
          Math.min(centerX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 16)
        ),
        top: targetRect.top + targetRect.height + SPOTLIGHT_PADDING + TOOLTIP_OFFSET
      }
    case 'left':
      return {
        left: Math.max(16, targetRect.left - SPOTLIGHT_PADDING - TOOLTIP_WIDTH - TOOLTIP_OFFSET),
        top: Math.max(16, centerY - tooltipHeight / 2)
      }
    case 'right':
      return {
        left: Math.min(
          targetRect.left + targetRect.width + SPOTLIGHT_PADDING + TOOLTIP_OFFSET,
          window.innerWidth - TOOLTIP_WIDTH - 16
        ),
        top: Math.max(16, centerY - tooltipHeight / 2)
      }
    default:
      return {
        left: centerX - TOOLTIP_WIDTH / 2,
        top: targetRect.top + targetRect.height + TOOLTIP_OFFSET
      }
  }
}

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    onAction
  } = useTutorial()
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(200)
  const [isVisible, setIsVisible] = useState(false)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  const currentStepData = TUTORIAL_STEPS[currentStep]
  const isLastStep = currentStep === totalSteps - 1
  const hasAction = currentStepData?.action
  const showDismiss = currentStepData?.showDismiss

  const updateTargetRect = useCallback(() => {
    if (!currentStepData) return

    const targetElement = document.querySelector(currentStepData.target)
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect()
      setTargetRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      })
    } else {
      setTargetRect(null)
    }
  }, [currentStepData])

  // Handle animation on step change
  useEffect(() => {
    if (!isActive) {
      setIsVisible(false)
      return
    }

    setIsVisible(false)

    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 50)

    return () => clearTimeout(timer)
  }, [isActive, currentStep])

  useEffect(() => {
    if (!isActive) return

    updateTargetRect()

    const handleResize = () => {
      updateTargetRect()
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)

    const resizeObserver = new ResizeObserver(updateTargetRect)
    resizeObserver.observe(document.body)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
      resizeObserver.disconnect()
    }
  }, [isActive, currentStep, updateTargetRect])

  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight)
    }
  }, [currentStep, isVisible])

  const handleActionClick = useCallback(() => {
    if (hasAction && onAction) {
      completeTutorial()
      onAction(hasAction.actionId)
    }
  }, [hasAction, onAction, completeTutorial])

  if (!isActive || !currentStepData) {
    return null
  }

  const tooltipPos = targetRect
    ? calculateTooltipPosition(targetRect, currentStepData.position, tooltipHeight)
    : { left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2, top: window.innerHeight / 2 }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Animated spotlight cutout using box-shadow */}
      {targetRect && (
        <div
          className={cn(
            'fixed rounded-xl pointer-events-none',
            'transition-all duration-500 ease-out'
          )}
          style={{
            left: targetRect.left - SPOTLIGHT_PADDING,
            top: targetRect.top - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: isVisible
              ? '0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 30px 5px rgba(var(--primary-rgb, 59, 130, 246), 0.3)'
              : '0 0 0 9999px rgba(0, 0, 0, 0)'
          }}
        />
      )}

      {/* Fallback dark overlay if no target found */}
      {!targetRect && (
        <div
          className={cn(
            'fixed inset-0 transition-opacity duration-500',
            isVisible ? 'bg-black/80' : 'bg-black/0'
          )}
        />
      )}

      {/* Animated Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          'fixed bg-card border border-border rounded-xl shadow-2xl p-5',
          'transition-all duration-500 ease-out',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}
        style={{
          left: tooltipPos.left,
          top: tooltipPos.top,
          width: TOOLTIP_WIDTH,
          zIndex: 10000
        }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === currentStep
                  ? 'w-6 bg-primary'
                  : index < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold mb-2">{currentStepData.title}</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {currentStepData.description}
        </p>

        {/* Action buttons for last step */}
        {isLastStep && (
          <div className="space-y-2 mb-4">
            {hasAction && onAction && (
              <button
                onClick={handleActionClick}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                  'shadow-md hover:shadow-lg group'
                )}
              >
                <Sparkles className="w-4 h-4 group-hover:animate-sparkle" />
                {hasAction.label}
              </button>
            )}
            {showDismiss && (
              <button
                onClick={completeTutorial}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg',
                  'border border-border hover:bg-accent',
                  'transition-colors'
                )}
              >
                Let&apos;s Go!
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={skipTutorial}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tutorial
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {!isLastStep && (
              <button
                onClick={nextStep}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={skipTutorial}
        className={cn(
          'fixed top-4 right-4 p-2 rounded-full bg-card/90 backdrop-blur border border-border',
          'hover:bg-accent transition-all duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        style={{ zIndex: 10001 }}
        aria-label="Close tutorial"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
