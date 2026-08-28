# Repository Guidelines

## Project Structure & Module Organization

The application lives in `web/`, a Vite-powered React and TypeScript SPA. Keep calculation logic in `web/src/engine/`, UI components in `web/src/ui/`, persisted user state in `web/src/state/`, and translations in `web/src/i18n/`. Game catalogs are JSON files under `web/src/data/`; matching building and research icons belong in `web/public/icons/`. Vitest files sit beside their domain in `__tests__/` directories.

Python utilities in `scripts/` scrape and validate wiki data. Their package code is in `scripts/rok_wiki/`, with pytest tests and fixtures under `scripts/tests/`. Design notes and implementation plans are stored in `docs/superpowers/`.

## Build, Test, and Development Commands

Run web commands from `web/`:

- `npm install` installs the locked frontend dependencies.
- `npm run dev` starts the local Vite development server.
- `npm run build` type-checks with strict TypeScript and creates `web/dist/`.
- `npm run lint` runs Oxlint.
- `npm test` runs the Vitest suite once.
- `npm run preview` serves the production build locally.

For data tooling, install dependencies with `python -m pip install -r scripts/requirements.txt`. From `scripts/`, use `python -m pytest tests/` for scraper tests, `python validate_data.py` to check catalog integrity, and `python scrape_wiki.py` only when intentionally refreshing source data and icons.

## Coding Style & Naming Conventions

Follow existing formatting: two-space indentation and single quotes in TypeScript; four spaces and PEP 8 conventions in Python. Use `PascalCase` for React components and exported types, `camelCase` for TypeScript functions and variables, and `snake_case` for Python modules and functions. Catalog IDs and asset filenames use lowercase `snake_case` (for example, `city_hall.png`). Keep engine functions deterministic and UI-independent. Run lint and build before submitting.

## Testing Guidelines

Use Vitest `*.test.ts` files under `web/src/**/__tests__/` and pytest `test_*.py` files under `scripts/tests/`. Add focused tests for scheduling, graph prerequisites, persistence migrations, parsing edge cases, and every bug fix. No numeric coverage threshold is configured; protect changed behavior with meaningful assertions and run both suites when data-model changes cross Python and TypeScript boundaries.

## Commit & Pull Request Guidelines

History follows concise Conventional Commit prefixes such as `feat:`, `fix:`, and `docs:`. Keep each commit scoped and use an imperative summary in English or Korean. Pull requests should explain the behavior change, list verification commands, link relevant issues, and include screenshots for visible UI changes. For catalog updates, identify the source and summarize validation warnings or intentional overrides.
