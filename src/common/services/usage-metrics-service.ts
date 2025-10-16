import { logger } from '@/main/utils/logger'

interface UsageReportPayload {
  type: 'nodes_desktop_app_launched'
  resource_id: string
}

export class UsageMetricsService {
  constructor() {
    // No longer need persistent storage since backend handles install detection
  }

  start() {
    logger.info('UsageMetricsService: Started')
  }

  async reportLaunch(accessToken: string, deviceId: string): Promise<void> {
    try {
      await this.reportUsage(accessToken, deviceId)
      logger.info('UsageMetricsService: Launch event reported successfully')
    } catch (error) {
      logger.error('UsageMetricsService: Failed to report launch event:', error)
      // Don't throw - we don't want to block app startup for metrics
    }
  }

  private async reportUsage(accessToken: string, deviceId: string): Promise<void> {
    const payload: UsageReportPayload = {
      type: 'nodes_desktop_app_launched',
      resource_id: deviceId
    }

    const response = await fetch('https://cloud.griptape.ai/api/usage/report/nodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Usage report failed: ${response.status} ${response.statusText} - ${errorText}`
      )
    }
  }
}
