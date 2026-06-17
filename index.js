#!/usr/bin/env node

/**
 * hakimov - CLI for simplifying your code setup
 *
 * Usage:
 *   npx hakimov nest-init   - Setup a NestJS project (swagger, typeorm, config)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CWD = process.cwd();

// ---------- helpers ----------

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg) {
  console.log(`${colors.cyan}[hakimov]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}[hakimov] ✔${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}[hakimov] ⚠${colors.reset} ${msg}`);
}

function error(msg) {
  console.error(`${colors.red}[hakimov] ✖${colors.reset} ${msg}`);
}

function readProjectPackageJson() {
  const pkgPath = path.join(CWD, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    error('package.json topilmadi. Bu buyruqni NestJS project ichida ishlating.');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    error(`package.json o'qib bo'lmadi: ${e.message}`);
    process.exit(1);
  }
}

function isInstalled(pm) {
  try {
    execSync(`${pm} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectPackageManager() {
  // 1. Lockfile bo'yicha aniqlash
  if (fs.existsSync(path.join(CWD, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(CWD, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(CWD, 'bun.lockb')) || fs.existsSync(path.join(CWD, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(CWD, 'package-lock.json'))) return 'npm';

  // 2. Qaysi package manager orqali ishga tushirilganini aniqlash (npx/pnpx/bunx)
  const userAgent = process.env.npm_config_user_agent || '';
  for (const pm of ['pnpm', 'yarn', 'bun']) {
    if (userAgent.startsWith(pm)) return pm;
  }

  // 3. Sistemada o'rnatilganini ishlatish (pnpm afzal)
  for (const pm of ['pnpm', 'yarn', 'bun']) {
    if (isInstalled(pm)) return pm;
  }

  return 'npm';
}

// pnpm v10+ build scriptlarni avtomatik ishga tushirmaydi (ERR_PNPM_IGNORED_BUILDS).
// Bu packagelar uchun build scriptlarga ruxsat beriladi.
const PNPM_ALLOWED_BUILDS = ['@nestjs/core', '@scarf/scarf', 'bcrypt'];

function pnpmMajorVersion() {
  try {
    return parseInt(execSync('pnpm --version', { encoding: 'utf8' }).trim().split('.')[0], 10);
  } catch {
    return 0;
  }
}

// pnpm versiyasiga qarab build scriptlarga ruxsat beriladi:
//   v11+  -> pnpm-workspace.yaml: allowBuilds (map)
//   v10   -> pnpm-workspace.yaml: onlyBuiltDependencies (list)
//   v9-   -> hech narsa kerak emas (build scriptlar avtomatik ishlaydi)
function ensurePnpmAllowBuilds(extraPackages = []) {
  const major = pnpmMajorVersion();
  if (major < 10) return;

  const wsPath = path.join(CWD, 'pnpm-workspace.yaml');
  let content = fs.existsSync(wsPath) ? fs.readFileSync(wsPath, 'utf8') : '';

  const section = major >= 11 ? 'allowBuilds' : 'onlyBuiltDependencies';
  if (!new RegExp(`^${section}:`, 'm').test(content)) {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `${section}:\n`;
  }

  const allPackages = [...new Set([...PNPM_ALLOWED_BUILDS, ...extraPackages])];
  for (const pkgName of allPackages) {
    const escaped = pkgName.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const entryRe = new RegExp(`^(\\s+)(- )?(['"]?)${escaped}\\3\\s*(:.*)?$`, 'm');
    const entry = major >= 11 ? `  '${pkgName}': true` : `  - '${pkgName}'`;
    if (entryRe.test(content)) {
      content = content.replace(entryRe, entry);
    } else {
      content = content.replace(new RegExp(`^${section}:\\s*$`, 'm'), (m) => `${m}\n${entry}`);
    }
  }

  fs.writeFileSync(wsPath, content, 'utf8');
  success(`pnpm-workspace.yaml: ${section} sozlandi.`);
}

const NEST_DEPENDENCIES = {
  '@nestjs/common': '^11.0.1',
  '@nestjs/config': '^4.0.4',
  '@nestjs/core': '^11.0.1',
  '@nestjs/platform-express': '^11.0.1',
  '@nestjs/swagger': '^11.4.4',
  '@nestjs/typeorm': '^11.0.1',
  'bcrypt': '^6.0.0',
  'class-transformer': '^0.5.1',
  'class-validator': '^0.15.1',
  'compression': '^1.8.1',
  'cookie-parser': '^1.4.7',
  'dotenv': '^17.4.2',
  'helmet': '^8.2.0',
  'mime-types': '^3.0.2',
  'pg': '^8.21.0',
  'reflect-metadata': '^0.2.2',
  'rxjs': '^7.8.2',
  'typeorm': '^1.0.0',
  'uuid': '^14.0.0',
};

const NEST_DEV_DEPENDENCIES = {
  '@eslint/eslintrc': '^3.2.0',
  '@eslint/js': '^9.18.0',
  '@nestjs/cli': '^11.0.0',
  '@nestjs/schematics': '^11.0.0',
  '@nestjs/testing': '^11.0.1',
  '@types/bcrypt': '^6.0.0',
  '@types/compression': '^1.8.1',
  '@types/cookie-parser': '^1.4.10',
  '@types/express': '^5.0.0',
  '@types/jest': '^30.0.0',
  '@types/mime-types': '^3.0.1',
  '@types/multer': '^2.1.0',
  '@types/node': '^24.13.1',
  '@types/supertest': '^7.0.0',
  'eslint': '^9.39.4',
  'eslint-config-prettier': '^10.1.8',
  'eslint-plugin-prettier': '^5.5.6',
  'globals': '^17.0.0',
  'jest': '^30.0.0',
  'prettier': '^3.8.4',
  'source-map-support': '^0.5.21',
  'supertest': '^7.0.0',
  'ts-jest': '^29.2.5',
  'ts-loader': '^9.5.2',
  'ts-node': '^10.9.2',
  'tsconfig-paths': '^4.2.0',
  'typescript': '^5.7.3',
  'typescript-eslint': '^8.20.0',
};

function installPackages(pkg) {
  const pm = detectPackageManager();

  pkg.dependencies = { ...pkg.dependencies, ...NEST_DEPENDENCIES };
  pkg.devDependencies = { ...pkg.devDependencies, ...NEST_DEV_DEPENDENCIES };
  // Mavjud scriptlarni ustun qo'yamiz, faqat yo'qlarini qo'shamiz.
  pkg.scripts = { ...NEST_SCRIPTS, ...pkg.scripts };

  if (pm === 'pnpm') {
    ensurePnpmAllowBuilds();
  }

  fs.writeFileSync(
    path.join(CWD, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n',
    'utf8'
  );
  success('package.json ga dependencies yozildi.');

  log(`Package manager: ${colors.bold}${pm}${colors.reset}`);
  log("Packagelar o'rnatilmoqda, biroz kuting...");

  if (pm === 'pnpm') {
    installWithPnpm();
    return;
  }

  try {
    execSync(`${pm} install`, { cwd: CWD, stdio: 'inherit' });
    success("Barcha packagelar o'rnatildi.");
  } catch (e) {
    warn("Packagelarni o'rnatishda xatolik yuz berdi, lekin setup davom etadi.");
    error(`Install xatosi: ${e.message}`);
    if (e.stderr) error(`stderr: ${e.stderr.toString().trim()}`);
    warn(`Keyinroq qo'lda o'rnating: ${colors.bold}${pm} install${colors.reset}`);
  }
}

// pnpm install ni qaytadan (output yashirin holda) ishga tushirib,
// ERR_PNPM_IGNORED_BUILDS dagi package nomlarini ajratib oladi.
// [] -> install muvaffaqiyatli, null -> boshqa turdagi xatolik
function findIgnoredBuilds() {
  try {
    execSync('pnpm install', { cwd: CWD, stdio: 'pipe', encoding: 'utf8' });
    return [];
  } catch (e) {
    const output = `${e.stdout || ''}\n${e.stderr || ''}`;
    const match = output.match(/Ignored build scripts:\s*([^\n]+)/);
    if (!match) return null;
    return match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      // "unrs-resolver@1.12.2" -> "unrs-resolver", "@scarf/scarf@1.4.0" -> "@scarf/scarf"
      .map((s) => (s.lastIndexOf('@') > 0 ? s.slice(0, s.lastIndexOf('@')) : s));
  }
}

const MAX_INSTALL_ATTEMPTS = 3;

function installWithPnpm() {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_INSTALL_ATTEMPTS; attempt++) {
    try {
      execSync('pnpm install', { cwd: CWD, stdio: 'inherit' });
      success("Barcha packagelar o'rnatildi.");
      return;
    } catch (e) {
      lastError = e;
      const ignored = findIgnoredBuilds();

      if (ignored && ignored.length === 0) {
        // Qayta urinishda o'z-o'zidan muvaffaqiyatli bo'ldi
        success("Barcha packagelar o'rnatildi.");
        return;
      }

      if (!ignored || attempt === MAX_INSTALL_ATTEMPTS) break;

      warn(`Build scriptlari bloklangan packagelar: ${colors.bold}${ignored.join(', ')}${colors.reset}`);
      log('pnpm-workspace.yaml ga ruxsat yozilib, install qayta ishga tushirilmoqda...');
      ensurePnpmAllowBuilds(ignored);
    }
  }

  warn("Packagelarni o'rnatishda xatolik yuz berdi, lekin setup davom etadi.");
  if (lastError) {
    error(`Install xatosi: ${lastError.message}`);
    if (lastError.stderr) error(`stderr: ${lastError.stderr.toString().trim()}`);
  }
  warn(`Keyinroq qo'lda o'rnating: ${colors.bold}pnpm install${colors.reset}`);
}

function writeFileSafe(relativePath, content) {
  const fullPath = path.join(CWD, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  success(`Yozildi: ${relativePath}`);
}

// Faqat fayl mavjud bo'lmaganda yozadi (mavjud konfiguratsiyani buzmaydi).
function writeFileIfMissing(relativePath, content) {
  const fullPath = path.join(CWD, relativePath);
  if (fs.existsSync(fullPath)) {
    warn(`${relativePath} allaqachon mavjud, o'zgartirilmadi.`);
    return;
  }
  writeFileSafe(relativePath, content);
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// IntelliSense / dekoratorlar (@IsString, @Module, ...) ishlashi uchun
// TypeScript loyiha fayllarini yaratadi. experimentalDecorators va
// emitDecoratorMetadata yoqilmaguncha class-validator/nest dekoratorlari
// editorda autocomplete bo'lmaydi.
function writeTsProjectFiles() {
  const tsconfig = `{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  }
}
`;

  const tsconfigBuild = `{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
`;

  const nestCli = `{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
`;

  // tsconfig.json yo'q bo'lsa standart commonjs versiyani yozamiz, mavjud
  // bo'lsa IntelliSense'ni buzadigan sozlamalarni (nodenext) tuzatamiz.
  const tsconfigPath = path.join(CWD, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    fixExistingTsconfig(tsconfigPath);
  } else {
    writeFileSafe('tsconfig.json', tsconfig);
  }

  writeFileIfMissing('tsconfig.build.json', tsconfigBuild);
  writeFileIfMissing('nest-cli.json', nestCli);
}

// Mavjud tsconfig.json'ni IntelliSense uchun tuzatadi:
//   - module/moduleResolution: nodenext|node16 -> commonjs / node
//   - resolvePackageJsonExports olib tashlanadi
//   - experimentalDecorators / emitDecoratorMetadata yo'q bo'lsa qo'shiladi
// Boshqa barcha sozlamalar saqlanadi. Faqat o'zgarish bo'lsa qayta yoziladi.
function fixExistingTsconfig(tsconfigPath) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  } catch (e) {
    warn(`tsconfig.json o'qib bo'lmadi (JSON xatosi): ${e.message}`);
    warn('IntelliSense uchun module=commonjs, moduleResolution=node va dekorator flaglarini qo\'lda tekshiring.');
    return;
  }

  const co = raw.compilerOptions || (raw.compilerOptions = {});
  const changes = [];

  const isNodeNext = (v) => typeof v === 'string' && /^(nodenext|node16)$/i.test(v.trim());

  if (isNodeNext(co.module)) {
    co.module = 'commonjs';
    changes.push('module → commonjs');
  }
  if (isNodeNext(co.moduleResolution)) {
    co.moduleResolution = 'node';
    changes.push('moduleResolution → node');
  }
  if ('resolvePackageJsonExports' in co) {
    delete co.resolvePackageJsonExports;
    changes.push('resolvePackageJsonExports olib tashlandi');
  }
  if (co.experimentalDecorators !== true) {
    co.experimentalDecorators = true;
    changes.push('experimentalDecorators → true');
  }
  if (co.emitDecoratorMetadata !== true) {
    co.emitDecoratorMetadata = true;
    changes.push('emitDecoratorMetadata → true');
  }

  if (changes.length === 0) {
    success('tsconfig.json allaqachon to\'g\'ri sozlangan.');
    return;
  }

  fs.writeFileSync(tsconfigPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  success(`tsconfig.json IntelliSense uchun tuzatildi (${changes.join(', ')}).`);
}

// app.module.ts AppController va AppService'ni import qiladi — ular
// bo'lmasa loyiha kompilyatsiya bo'lmaydi va IntelliSense ishlamaydi.
function writeAppFiles() {
  const appControllerTs = `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
`;

  const appServiceTs = `import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
`;

  writeFileIfMissing(path.join('src', 'app.controller.ts'), appControllerTs);
  writeFileIfMissing(path.join('src', 'app.service.ts'), appServiceTs);
}

const NEST_SCRIPTS = {
  build: 'nest build',
  format: 'prettier --write "src/**/*.ts" "test/**/*.ts"',
  start: 'nest start',
  'start:dev': 'nest start --watch',
  'start:debug': 'nest start --debug --watch',
  'start:prod': 'node dist/main',
  lint: 'eslint "{src,apps,libs,test}/**/*.ts" --fix',
  test: 'jest',
  'test:watch': 'jest --watch',
  'test:cov': 'jest --coverage',
};

// ---------- nest-init ----------

function nestInit() {
  const pkg = readProjectPackageJson();
  const projectName = pkg.name || 'app';
  const title = capitalize(projectName);

  log(`Project: ${colors.bold}${projectName}${colors.reset}`);

  // 1. Kerakli packagelarni o'rnatish
  installPackages(pkg);

  // 2. src/main.ts
  const mainTs = `import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('${title} example')
    .setDescription('The ${projectName} API description')
    .setVersion('1.0')
    .addTag('${projectName}')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 4040);
}
bootstrap();
`;

  // 3. src/app.module.ts
  const appModuleTs = `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      database: process.env.DB_DATABASE,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      synchronize: true
    }),
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
`;

  writeFileSafe(path.join('src', 'main.ts'), mainTs);
  writeFileSafe(path.join('src', 'app.module.ts'), appModuleTs);

  // TypeScript loyiha konfiguratsiyasi va AppController/AppService — bularsiz
  // IntelliSense (masalan, class-validator @IsString) ishlamaydi.
  writeTsProjectFiles();
  writeAppFiles();

  // 4. .env fayli (mavjud bo'lmasa yaratiladi)
  const envPath = path.join(CWD, '.env');
  if (!fs.existsSync(envPath)) {
    const envContent = `PORT=4040

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=${projectName}
`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    success('Yozildi: .env');
  } else {
    warn(".env allaqachon mavjud, o'zgartirilmadi.");
  }

  console.log('');
  success(`${colors.bold}nest-init muvaffaqiyatli yakunlandi!${colors.reset}`);
  log(".env faylida database sozlamalarini tekshirishni unutmang.");
}

// ---------- help ----------

function showHelp() {
  console.log(`
${colors.bold}hakimov${colors.reset} - kodlarni osonlashtirish uchun CLI

${colors.bold}Foydalanish:${colors.reset}
  npx hakimov <buyruq>

${colors.bold}Buyruqlar:${colors.reset}
  nest-init   NestJS project'ni sozlaydi:
              - Barcha kerakli dependencies va devDependencies'ni o'rnatadi
                (nestjs, swagger, typeorm, pg, bcrypt, helmet, eslint, jest va h.k.)
              - src/main.ts ga Swagger sozlamalarini yozadi
              - src/app.module.ts ga TypeORM + ConfigModule sozlamalarini yozadi
              - .env fayl yaratadi (mavjud bo'lmasa)

  help        Ushbu yordam xabarini ko'rsatadi
`);
}

// ---------- self-update ----------
//
// hakimov har ishga tushganda o'zining eng yangi npm versiyasiga yangilanib,
// darhol o'sha versiya bilan davom etadi. Sabab: foydalanuvchidagi lokal/npx
// versiya eskirgan bo'lishi mumkin (masalan 1.0.6), npm da esa yangirog'i bor.
//
// MUHIM — root cause pnpm/npm METADATA KESHIda: kesh eski "latest" ni beradi.
// Shuning uchun (1) versiya tekshiruvi keshni butunlay chetlab o'tib, to'g'ridan
// to'g'ri registry HTTP endpointidan o'qiydi; (2) re-exec ANIQ versiya bilan
// (hakimov@{latest}, @latest emas) qilinadi — npx shu aniq versiyani oladi,
// kesh esa bunga ta'sir qila olmaydi.
//
// O'tkazib yuborish uchun: HAKIMOV_SKIP_SELF_UPDATE=1

// Eng yangi versiyani registry HTTP endpointidan KESHSIZ oladi (metadata
// keshini butunlay chetlab o'tadi). Muvaffaqiyatsiz bo'lsa null qaytaradi.
function fetchLatestVersionViaRegistry(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = https.get(
      'https://registry.npmjs.org/hakimov/latest',
      { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).version || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

// HTTP ishlamasa fallback: npm view. Muvaffaqiyatsiz bo'lsa null.
function fetchLatestVersionViaNpm() {
  try {
    const out = execSync('npm view hakimov version', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// Semver bo'yicha solishtirish (string emas): "1.0.10" > "1.0.9".
// a > b -> musbat, a < b -> manfiy, teng -> 0.
function compareSemver(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function selfUpdate() {
  // Re-exec qilingan yangi versiyada qayta yangilanmaslik uchun (loop oldini olish).
  if (process.env.HAKIMOV_SKIP_SELF_UPDATE) return;

  // Joriy versiyani hakimovning O'Z package.json idan o'qiymiz (CWD dan emas —
  // CWD foydalanuvchi loyihasi).
  let current;
  try {
    const ownPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    current = ownPkg.version;
  } catch {
    return; // o'z versiyamizni o'qiy olmasak — jim davom etamiz
  }
  if (!current) return;

  // Eng yangi versiyani KESHSIZ olamiz: avval registry HTTP, keyin npm view.
  let latest = await fetchLatestVersionViaRegistry();
  if (!latest) latest = fetchLatestVersionViaNpm();

  // Tarmoq/registry muammosi nest-init ni HECH QACHON bloklamasligi kerak.
  if (!latest) {
    warn("Yangi versiyani tekshirib bo'lmadi (tarmoq/registry), joriy versiya bilan davom etilmoqda.");
    return;
  }

  // Allaqachon eng yangi (yoki undan ham yangi) — jimgina davom etamiz.
  if (compareSemver(latest, current) <= 0) return;

  log(`Yangi versiya: ${colors.bold}${current} → ${latest}${colors.reset}, yangilanmoqda...`);

  // ANIQ versiya bilan re-exec (kesh ta'sir qilmasligi uchun @latest EMAS).
  const args = process.argv.slice(2);
  try {
    execSync(`npx -y hakimov@${latest} ${args.join(' ')}`.trim(), {
      stdio: 'inherit',
      env: { ...process.env, HAKIMOV_SKIP_SELF_UPDATE: '1' },
    });
    process.exit(0); // eski process davom etmasin
  } catch (e) {
    warn(`Yangilanish bajarilmadi (${e.message}), joriy versiya (${current}) bilan davom etilmoqda.`);
  }
}

// ---------- entrypoint ----------

async function main() {
  // Har qanday ish boshlanmasdan oldin — eng yangi versiyaga yangilanish.
  await selfUpdate();

  const command = process.argv[2];

  switch (command) {
    case 'nest-init':
      nestInit();
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
    default:
      error(`Noma'lum buyruq: "${command}"`);
      showHelp();
      process.exit(1);
  }
}

main();