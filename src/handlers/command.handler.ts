import * as fs from 'fs';
import * as path from 'path';
import { ExtendedClient, SlashCommand } from '../types';
import { logger } from '../utils/logger';

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const commandsPath = path.join(__dirname, '..', 'commands');
  let loaded = 0;

  const loadDir = (dir: string): void => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        loadDir(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const command: SlashCommand = require(fullPath).default;
          if (!command?.data || !command?.execute) {
            logger.warn(`Geçersiz komut dosyası: ${file}`);
            continue;
          }
          client.commands.set(command.data.name, command);
          loaded++;
          logger.debug(`Komut yüklendi: ${command.data.name}`);
        } catch (err) {
          logger.error(`Komut yüklenemedi: ${file}`, { err });
        }
      }
    }
  };

  if (fs.existsSync(commandsPath)) loadDir(commandsPath);
  logger.info(`${loaded} komut yüklendi`);
}
