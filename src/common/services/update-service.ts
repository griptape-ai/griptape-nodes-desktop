import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { logger } from '../utils/logger.renderer';

export class UpdateService {
  private checking = false;

  constructor() {
    this.initializeAutoUpdater();
  }

  private initializeAutoUpdater() {
    // Initialize automatic updates (startup + periodic checks)
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.StaticStorage,
        baseUrl: `https://griptape-nodes-desktop-updates.s3.amazonaws.com/${process.platform}/${process.arch}`
      },
      updateInterval: '1 hour',
      notifyUser: true
    });

    // Add callback for when update is downloaded
    autoUpdater.on('update-downloaded', async (event, releaseNotes, releaseName) => {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
      })

      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });

    // Add global error handler
    autoUpdater.on('error', (message) => {
      logger.error('UpdateService: There was a problem updating the application');
      logger.error('UpdateService:', message);
    });

    logger.info('UpdateService: Auto updater initialized');
  }

  async checkForUpdates(browserWindow?: BrowserWindow): Promise<void> {
    if (this.checking) {
      logger.warn('UpdateService: Update check already in progress');
      return;
    }

    if (process.platform === 'linux') {
      const message = 'Auto updates are not available on Linux';
      logger.info('UpdateService:', message);

      if (browserWindow) {
        dialog.showMessageBox(browserWindow, {
          type: 'info',
          message: 'Updates Not Available',
          detail: message
        });
      }
      return;
    }

    this.checking = true;
    logger.info('UpdateService: Starting manual update check');

    const cleanup = () => {
      this.checking = false;
      autoUpdater.removeListener('update-not-available', onNone);
      autoUpdater.removeListener('update-available', onAvail);
      autoUpdater.removeListener('error', onError);
    };

    const onNone = () => {
      logger.info('UpdateService: No updates available');
      cleanup();

      if (browserWindow) {
        dialog.showMessageBox(browserWindow, {
          type: 'info',
          message: 'You\'re up to date',
          detail: `Version ${app.getVersion()}`
        });
      }
    };

    const onAvail = () => {
      logger.info('UpdateService: Update available, letting update-electron-app handle download');
      // Let update-electron-app handle download + prompt (notifyUser: true)
      cleanup();
    };

    const onError = (err: Error) => {
      logger.error('UpdateService: Update check failed:', err);
      cleanup();

      if (browserWindow) {
        dialog.showErrorBox('Update check failed', String(err?.message || err));
      }
    };

    autoUpdater.once('update-not-available', onNone);
    autoUpdater.once('update-available', onAvail);
    autoUpdater.once('error', onError);

    // Trigger the update check
    autoUpdater.checkForUpdates();
  }

  isSupported(): boolean {
    return process.platform !== 'linux';
  }
}
