/**
 * Генерация изображения через Whisk (Google Labs).
 * Вызов: node generate.mjs "<prompt>" "<outputDir>" [aspect]
 * aspect: landscape | portrait | square (по умолчанию landscape)
 * Переменная окружения: COOKIE — cookie авторизации Google (labs.google).
 */
import { Whisk } from '@rohitaryal/whisk-api';

const prompt = process.argv[2];
const outDir = process.argv[3] || './output';
const aspectArg = (process.argv[4] || 'landscape').toString().toLowerCase();
const aspectMap = {
  landscape: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  portrait: 'IMAGE_ASPECT_RATIO_PORTRAIT',
  square: 'IMAGE_ASPECT_RATIO_SQUARE',
};
const aspectRatio = aspectMap[aspectArg] || aspectMap.landscape;

const cookie = process.env.COOKIE || process.env.WHISK_COOKIE;
if (!cookie || !cookie.trim()) {
  process.stderr.write('Whisk: COOKIE or WHISK_COOKIE not set\n');
  process.exit(1);
}
if (!prompt || !prompt.trim()) {
  process.stderr.write('Whisk: prompt required as first argument\n');
  process.exit(1);
}

try {
  const whisk = new Whisk(cookie.trim());
  const project = await whisk.newProject('ARCHON');
  const media = await project.generateImage({
    prompt: prompt.trim(),
    aspectRatio,
  });
  const savedPath = media.save(outDir);
  if (!savedPath || typeof savedPath !== 'string') {
    process.stderr.write('Whisk: save() не вернул путь к файлу\n');
    process.exit(1);
  }
  process.stdout.write(savedPath.trim() + '\n');
} catch (err) {
  process.stderr.write('Whisk error: ' + (err?.message || String(err)) + '\n');
  process.exit(1);
}
