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
      "Griptape Nodes Desktop is your local workspace for building AI workflows with nodes. From here, you'll start the engine and work in the visual editor. Let's take a quick tour so you know where everything lives.",
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
      "The Engine tab shows detailed logs and advanced controls. You'll mostly use this for troubleshooting or when you want to see what the engine is doing under the hood.",
    position: 'bottom'
  },
  {
    id: 'workspace',
    target: '[data-tutorial="workspace"]',
    title: 'Your Workspace',
    description:
      'Griptape Nodes saves your workflows and project files here by default. You can change this later in Settings if needed.',
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
