'use strict';
// ensureAppModule / ensureMainTs ning idempotent, additiv merge xatti-harakatini
// tekshiradi. Ishga tushirish: npm test (node --test).
//
// CWD index.js da modul yuklanganda const sifatida olinadi, shuning uchun har
// fixture alohida child-process'da (process.chdir + require) ishlatiladi.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const INDEX = path.join(__dirname, '..', 'index.js');

// Berilgan dir da ensure* funksiyalarini CLI ishlatadigan tarzda chaqiradi.
function runEnsure(dir) {
  const code =
    `process.chdir(${JSON.stringify(dir)});` +
    `const m=require(${JSON.stringify(INDEX)});` +
    `m.ensureMainTs('myapp','Myapp');` +
    `m.ensureAppModule();`;
  return execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' });
}

function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakimov-test-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const count = (hay, needle) => hay.split(needle).length - 1;

const PLAIN_MAIN = `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
`;

const FULL_MAIN = `import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  SwaggerModule.setup('api', app, () => ({}));
  await app.listen(3000);
}
bootstrap();
`;

const ONLY_CONFIG = `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [],
  providers: [],
})
export class AppModule {}
`;

const ONLY_TYPEORM = `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ type: 'sqlite', database: ':memory:' }) }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
`;

const BOTH = `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'postgres' }),
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
`;

test('faqat ConfigModule bor -> TypeOrmModule qo\'shiladi, Config tegilmaydi', () => {
  const dir = makeProject({ 'src/app.module.ts': ONLY_CONFIG, 'src/main.ts': FULL_MAIN });
  runEnsure(dir);
  const am = read(dir, 'src/app.module.ts');
  assert.ok(am.includes('TypeOrmModule.forRoot'), 'TypeOrmModule qo\'shilishi kerak');
  assert.ok(am.includes("from '@nestjs/typeorm'"), 'typeorm importi qo\'shilishi kerak');
  assert.strictEqual(count(am, 'ConfigModule.forRoot'), 1, 'ConfigModule tegilmasligi kerak');
});

test('faqat TypeOrmModule (custom) bor -> ConfigModule qo\'shiladi, custom o\'zgarmaydi', () => {
  const dir = makeProject({ 'src/app.module.ts': ONLY_TYPEORM, 'src/main.ts': FULL_MAIN });
  runEnsure(dir);
  const am = read(dir, 'src/app.module.ts');
  assert.ok(am.includes('ConfigModule.forRoot'), 'ConfigModule qo\'shilishi kerak');
  assert.ok(am.includes('forRootAsync') && am.includes("type: 'sqlite'"), 'custom config saqlanishi kerak');
  assert.ok(!am.includes('autoLoadEntities'), 'standart TypeOrm bloki qo\'shilmasligi kerak');
});

test('ikkalasi ham bor -> app.module.ts o\'zgarmaydi', () => {
  const dir = makeProject({ 'src/app.module.ts': BOTH, 'src/main.ts': FULL_MAIN });
  const before = read(dir, 'src/app.module.ts');
  const out = runEnsure(dir);
  assert.strictEqual(read(dir, 'src/app.module.ts'), before, 'fayl o\'zgarmasligi kerak');
  assert.ok(out.includes('allaqachon sozlangan'));
});

test('main.ts Swagger bor -> o\'zgarmaydi; yo\'q -> qo\'shiladi (listen dan oldin)', () => {
  // Swagger bor:
  const withSw = makeProject({ 'src/app.module.ts': BOTH, 'src/main.ts': FULL_MAIN });
  const before = read(withSw, 'src/main.ts');
  runEnsure(withSw);
  assert.strictEqual(read(withSw, 'src/main.ts'), before, 'Swagger bor bo\'lsa o\'zgarmasligi kerak');

  // Swagger yo'q:
  const noSw = makeProject({ 'src/app.module.ts': BOTH, 'src/main.ts': PLAIN_MAIN });
  runEnsure(noSw);
  const mt = read(noSw, 'src/main.ts');
  assert.ok(mt.includes("from '@nestjs/swagger'"), 'swagger importi qo\'shilishi kerak');
  assert.ok(mt.includes('SwaggerModule.setup('), 'SwaggerModule.setup qo\'shilishi kerak');
  assert.ok(mt.indexOf('SwaggerModule.setup(') < mt.indexOf('app.listen('), 'Swagger app.listen dan oldin bo\'lishi kerak');
});

test('idempotentlik: 2-marta ishlatish 2-marta diff bermaydi', () => {
  const dir = makeProject({ 'src/app.module.ts': ONLY_CONFIG, 'src/main.ts': PLAIN_MAIN });
  runEnsure(dir);
  const am1 = read(dir, 'src/app.module.ts');
  const mt1 = read(dir, 'src/main.ts');
  runEnsure(dir);
  assert.strictEqual(read(dir, 'src/app.module.ts'), am1, 'app.module.ts 2-marta o\'zgarmasligi kerak');
  assert.strictEqual(read(dir, 'src/main.ts'), mt1, 'main.ts 2-marta o\'zgarmasligi kerak');
  assert.strictEqual(count(am1, "from '@nestjs/typeorm'"), 1, 'typeorm import dublikat bo\'lmasligi kerak');
  assert.strictEqual(count(mt1, "from '@nestjs/swagger'"), 1, 'swagger import dublikat bo\'lmasligi kerak');
});

test('fayllar yo\'q -> to\'liq shablon yaratiladi va TS sifatida toza', () => {
  const dir = makeProject({});
  runEnsure(dir);
  const am = read(dir, 'src/app.module.ts');
  const mt = read(dir, 'src/main.ts');
  assert.ok(am.includes('TypeOrmModule.forRoot') && am.includes('ConfigModule.forRoot'));
  assert.ok(mt.includes('SwaggerModule.setup('));

  // Merge natijasi sintaksis xatosiz parse bo'lsin (modul/lib xatolari e'tiborsiz).
  const ts = require('ts-morph');
  const p = new ts.Project({
    useInMemoryFileSystem: true,
    compilerOptions: { target: ts.ts.ScriptTarget.ES2017, lib: ['lib.es2017.d.ts'], skipLibCheck: true, noEmit: true },
  });
  const ignore = new Set([2307, 2792, 2580]);
  const errs = [
    ...p.createSourceFile('a.ts', am).getPreEmitDiagnostics(),
    ...p.createSourceFile('m.ts', mt).getPreEmitDiagnostics(),
  ].filter((d) => d.getCategory() === ts.DiagnosticCategory.Error && !ignore.has(d.getCode()));
  assert.strictEqual(errs.length, 0, 'sintaksis xatosi bo\'lmasligi kerak: ' + errs.map((e) => e.getCode()).join(','));
});
