import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from 'react'
import { TUTORIAL_STEPS } from './tutorialSteps'

export type TutorialActionHandler = (actionId: string) => void

interface TutorialContextType {
  isActive: boolean
  currentStep: number
  totalSteps: number
  startTutorial: () => void
  nextStep: () => void
  prevStep: () => void
  skipTutorial: () => void
  completeTutorial: () => void
  isTutorialCompleted: boolean
  refreshTutorialState: () => Promise<void>
  onAction: TutorialActionHandler | null
  setActionHandler: (handler: TutorialActionHandler | null) => void
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined)

interface TutorialProviderProps {
  children: ReactNode
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isTutorialCompleted, setIsTutorialCompleted] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [actionHandler, setActionHandler] = useState<TutorialActionHandler | null>(null)

  useEffect(() => {
    const loadTutorialState = async () => {
      try {
        const completed = await window.onboardingAPI.isTutorialCompleted()
        const lastStep = await window.onboardingAPI.getTutorialLastStep()
        setIsTutorialCompleted(completed)
        setCurrentStep(lastStep)
      } catch (err) {
        console.error('Failed to load tutorial state:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadTutorialState()
  }, [])

  const startTutorial = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
    window.onboardingAPI.setTutorialLastStep(0)
  }, [])

  const completeTutorial = useCallback(() => {
    setIsActive(false)
    setIsTutorialCompleted(true)
    setCurrentStep(0)
    window.onboardingAPI.setTutorialCompleted(true)
    window.onboardingAPI.setTutorialLastStep(0)
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      window.onboardingAPI.setTutorialLastStep(newStep)
    } else {
      completeTutorial()
    }
  }, [currentStep, completeTutorial])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1
      setCurrentStep(newStep)
      window.onboardingAPI.setTutorialLastStep(newStep)
    }
  }, [currentStep])

  const skipTutorial = useCallback(() => {
    setIsActive(false)
    setIsTutorialCompleted(true)
    window.onboardingAPI.setTutorialCompleted(true)
    window.onboardingAPI.setTutorialLastStep(0)
  }, [])

  const refreshTutorialState = useCallback(async () => {
    try {
      const completed = await window.onboardingAPI.isTutorialCompleted()
      const lastStep = await window.onboardingAPI.getTutorialLastStep()
      setIsTutorialCompleted(completed)
      setCurrentStep(lastStep)
    } catch (err) {
      console.error('Failed to refresh tutorial state:', err)
    }
  }, [])

  return (
    <TutorialContext.Provider
      value={{
        isActive: isLoading ? false : isActive,
        currentStep,
        totalSteps: TUTORIAL_STEPS.length,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        completeTutorial,
        isTutorialCompleted: isLoading ? true : isTutorialCompleted,
        refreshTutorialState,
        onAction: actionHandler,
        setActionHandler
      }}
    >
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider')
  }
  return context
}
