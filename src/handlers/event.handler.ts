import * as fs from 'fs';
import * as path from 'path';
import { ExtendedClient, EventHandler } from '../types';
import { logger } from '../utils/logger';

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const eventsPath = path.join(__dirname, '..', 'events');
  let loaded = 0;

  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    try {
      const event: EventHandler = require(path.join(eventsPath, file)).default;
      if (!event?.name) continue;

      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }

      loaded++;
      logger.debug(`Event yüklendi: ${event.name}`);
    } catch (err) {
      logger.error(`Event yüklenemedi: ${file}`, { err });
    }
  }

  logger.info(`${loaded} event yüklendi`);
}
