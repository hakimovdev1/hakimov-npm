# hakimov

[![npm version](https://img.shields.io/npm/v/hakimov.svg)](https://www.npmjs.com/package/hakimov)
[![license](https://img.shields.io/npm/l/hakimov.svg)](https://github.com/hakimovdev1/hakimov-npm/blob/main/LICENSE)

> Do what takes long lines of code with one line of code.

A zero-config CLI that turns a fresh NestJS project into a production-ready setup — Swagger, TypeORM (PostgreSQL), ConfigModule, and all the dependencies you need — with a single command.

## Quick start

Inside your NestJS project folder:

```bash
npx hakimov nest-init
```

That's it. No installation required.

## What `nest-init` does

1. **Installs all dependencies** you'd otherwise add one by one:

   | Dependencies | Dev dependencies |
   | --- | --- |
   | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing` |
   | `@nestjs/swagger`, `@nestjs/typeorm`, `@nestjs/config` | `typescript`, `ts-node`, `ts-jest`, `ts-loader` |
   | `typeorm`, `pg` | `jest`, `supertest` + type packages |
   | `bcrypt`, `helmet`, `compression`, `cookie-parser` | `eslint`, `prettier` + configs/plugins |
   | `class-validator`, `class-transformer` | `@types/node`, `@types/express`, `@types/multer`, … |
   | `dotenv`, `rxjs`, `uuid`, `mime-types`, `reflect-metadata` | |

2. **Generates `src/main.ts`** with Swagger already wired up — docs served at `/api`.

3. **Generates `src/app.module.ts`** with TypeORM (PostgreSQL) and a global ConfigModule, all driven by environment variables.

4. **Sets up TypeScript for IntelliSense** — writes a `tsconfig.json` if one is missing, and repairs an existing one so editor autocomplete works for decorators like `@Column`, `@IsString`, `@Module`. Specifically it switches `module`/`moduleResolution` away from `nodenext`/`node16` (which break type resolution for typeorm and `@nestjs/*`) to `commonjs`/`node`, drops `resolvePackageJsonExports`, and ensures `experimentalDecorators` + `emitDecoratorMetadata` are enabled. Your other compiler options are preserved.

5. **Creates a `.env` file** (only if one doesn't exist — yours is never overwritten):

   ```env
   PORT=4040

   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_DATABASE=<your-project-name>
   ```

Then just review your `.env` and run:

```bash
npm run start:dev
```

Swagger UI will be available at `http://localhost:4040/api`.

## Always up to date

Every time you run `hakimov`, it checks npm for a newer version and, if one exists, re-runs your command with the latest release automatically — so you never get stale behavior from an old local/`npx` copy. The version check reads directly from the npm registry (bypassing the package-manager metadata cache, which is the usual cause of "stale latest"), and the re-run pins the exact newest version.

To skip self-updating (e.g. in CI or offline), set:

```bash
HAKIMOV_SKIP_SELF_UPDATE=1 npx hakimov nest-init
```

A network/registry failure never blocks the command — it just continues with the current version.

## Package manager friendly

The CLI auto-detects your package manager — **pnpm**, **yarn**, **bun**, or **npm** — by checking lockfiles, how it was launched (`npx`/`pnpx`/`bunx`), and what's installed on your system.

It also handles the pnpm v10+ `ERR_PNPM_IGNORED_BUILDS` issue automatically: blocked build scripts (e.g. `bcrypt`, `@nestjs/core`) are allowed in `pnpm-workspace.yaml` and the install is retried — no manual `pnpm approve-builds` needed.

## Commands

| Command | Description |
| --- | --- |
| `npx hakimov nest-init` | Set up a NestJS project: dependencies, Swagger, TypeORM, ConfigModule, `.env` |
| `npx hakimov help` | Show help |

## Requirements

- Node.js with `npx`
- An existing NestJS project (a folder with a `package.json` — e.g. created via `nest new`)
- PostgreSQL for the generated TypeORM config (you can change the driver in `src/app.module.ts`)

## Links

- [Source](https://github.com/hakimovdev1/hakimov-npm)
- [Issues](https://github.com/hakimovdev1/hakimov-npm/issues)

## License

ISC © [hakimovdev1](https://github.com/hakimovdev1)
