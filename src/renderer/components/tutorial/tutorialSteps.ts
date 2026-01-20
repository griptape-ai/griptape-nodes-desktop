export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TutorialStepAction {
  label: string
  actionId: string
}

export interface TutorialStep {
  id: string
  target: string
  title: string
  description: string
  position: TooltipPosition
  action?: TutorialStepAction
  showDismiss?: boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    target: '[data-tutorial="logo"]',
    title: 'Welcome to Griptape Nodes!',
    description:
      "Griptape Nodes Desktop is your local development environment for building AI workflows. This app manages the Griptape Nodes engine and provides easy access to the visual workflow editor. Let's take a quick tour!",
    position: 'bottom'
  },
  {
    id: 'engine-status',
    target: '[data-tutorial="engine-status"]',
    title: 'Engine Controls',
    description:
      'This is your engine control center. Start and stop the engine here, check its status, and access the logs. The engine must be running to create workflows.',
    position: 'bottom'
  },
  {
    id: 'engine-tab',
    target: '[data-tutorial="engine-tab"]',
    title: 'Engine Page',
    description:
      'The Engine tab gives you detailed logs and advanced controls for troubleshooting.',
    position: 'bottom'
  },
  {
    id: 'workspace',
    target: '[data-tutorial="workspace"]',
    title: 'Your Workspace',
    description:
      'Your workflows and project files are saved here. You can change this location in Settings.',
    position: 'top'
  },
  {
    id: 'open-editor',
    target: '[data-tutorial="editor-button"]',
    title: 'Start Creating!',
    description:
      'Once the engine is running, click this button to open the visual workflow editor and start building AI workflows.',
    position: 'bottom',
    action: {
      label: 'Start Creating',
      actionId: 'open-editor'
    },
    showDismiss: true
  }
]
