# Repository Guidelines

## Project Structure & Module Organization
This Nx monorepo is orchestrated through Bun. Core SDKs live in `packages/` (`classic`, `coder`, `kit`, `lib`), each splitting runtime code in `src/` and unit suites in `tests/`. Reference integrations and manual verification flows live in `examples/`, while release automation scripts stay in `scripts/`. Solana program artifacts required for runtime validation reside in `swig-program/` alongside the compiled `swig.so`; touch them only when coordinating with the on-chain team.

## Build, Test, and Development Commands
- `bun run build` runs `nx run-many -t build` for all publishable packages.
- `bun run dev` launches watch builds; scope with `bun --filter '@swig-wallet/lib' dev` for focused iterations.
- `bun run lint` / `bun run lint:fix` apply the shared ESLint rules and optional autofixes.
- `bun run format` / `bun run format:fix` validate or rewrite Prettier formatting within `packages/`.
- `bun run test` executes all unit suites; target a single package with `nx test @swig-wallet/lib`.

## Coding Style & Naming Conventions
Prettier enforces two-space indents, semicolons, single quotes, and trailing commas; run formatters before review. Write TypeScript ESM modules, exporting components and classes with `PascalCase`, utilities with `camelCase`, and constants in `UPPER_SNAKE_CASE`. Keep modules narrow in scope, colocate helper utilities near their consumers, and add concise comments when logic is non-obvious.

## Testing Guidelines
Unit tests sit beside sources as `packages/<pkg>/tests/<module>.test.ts`, using Bun’s Jest-compatible `describe`/`it`. Mirror the file structure of the implementation, favor deterministic fixtures, and reuse the provided Solana test addresses rather than inventing new ones. Always run `bun run test` (or the scoped equivalent) before requesting review, and update fixtures if protocol semantics change.

## Commit & Pull Request Guidelines
Follow conventional commits (`feat:`, `fix:`, `chore:`) with imperative summaries, e.g. `feat(lib): add escrow signer`. Bundle related work per commit, leave git operations to the repository owner, and document follow-up TODOs inline instead of in commit messages. Pull requests should link relevant issues, note test coverage, and attach screenshots or CLI logs when developer workflows change.

## Security & Configuration Tips
Keep secrets out of the repository; rely on local `.env` files ignored by git. Regenerate Solana program artifacts only through the approved release scripts, and review `swig-program/README` before altering on-chain interfaces. Use `bun install` to respect the existing lockfile and avoid drift in dependency graphs.
