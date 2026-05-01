import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { config } from '../config';
import { logger } from '../utils/logger';

async function deploy(): Promise<void> {
  const commands: unknown[] = [];
  const commandsPath = path.join(__dirname, '..', 'commands');

  const loadDir = async (dir: string): Promise<void> => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        await loadDir(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        try {
          const modulePath = pathToFileURL(fullPath).href;
          const imported = await import(modulePath);
          const command = imported.default ?? imported;
          if (command?.data?.toJSON) {
            commands.push(command.data.toJSON());
            logger.info(`Komut hazırlandı: ${command.data.name}`);
          }
        } catch (err) {
          logger.error(`Komut okunamadı: ${file}`, {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            err,
          });
        }
      }
    }
  };

  if (fs.existsSync(commandsPath)) await loadDir(commandsPath);

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`${commands.length} slash command deploy ediliyor...`);

    if (config.guildId) {
      // Guild-specific (geliştirme)
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
      });
      logger.info(`✅ ${commands.length} komut guild'e deploy edildi`);
    } else {
      // Global
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      logger.info(`✅ ${commands.length} komut global deploy edildi`);
    }
  } catch (error) {
    logger.error('Deploy hatası', { error });
    process.exit(1);
  }
}

deploy();
