import * as fs from 'fs';
import * as path from 'path';
import { ExtendedClient, ButtonHandler } from '../types';
import { logger } from '../utils/logger';

export async function loadButtons(client: ExtendedClient): Promise<void> {
  const buttonsPath = path.join(__dirname, '..', 'interactions', 'buttons');
  if (!fs.existsSync(buttonsPath)) return;

  const files = fs.readdirSync(buttonsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    try {
      const button: ButtonHandler = require(path.join(buttonsPath, file)).default;
      if (!button?.customId) continue;
      client.buttons.set(String(button.customId), button);
      logger.debug(`Button handler yüklendi: ${file}`);
    } catch (err) {
      logger.error(`Button handler yüklenemedi: ${file}`, { err });
    }
  }
}
