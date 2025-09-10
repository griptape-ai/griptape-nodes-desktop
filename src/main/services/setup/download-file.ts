import * as https from 'https';
import { createWriteStream } from 'fs';

export async function downloadFile(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.destroy();
          downloadFile(redirectUrl, filepath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.destroy();
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          // Additional wait to ensure file handle is fully released
          setTimeout(() => {
            resolve();
          }, 500);
        });
      });
      file.on('error', reject);
    }).on('error', (err) => {
      file.destroy();
      reject(err);
    });
  });
}