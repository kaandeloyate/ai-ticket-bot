import * as fs from 'fs';
import * as path from 'path';
import { ExtendedClient, SelectMenuHandler } from '../types';
import { logger } from '../utils/logger';

export async function loadSelectMenus(client: ExtendedClient): Promise<void> {
  const menusPath = path.join(__dirname, '..', 'interactions', 'selectMenus');
  if (!fs.existsSync(menusPath)) return;

  const files = fs.readdirSync(menusPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    try {
      const menu: SelectMenuHandler = require(path.join(menusPath, file)).default;
      if (!menu?.customId) continue;
      client.selectMenus.set(String(menu.customId), menu);
      logger.debug(`SelectMenu handler yüklendi: ${file}`);
    } catch (err) {
      logger.error(`SelectMenu handler yüklenemedi: ${file}`, { err });
    }
  }
}
