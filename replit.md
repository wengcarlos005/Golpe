# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### GOLPE - Blefe e Poder (`artifacts/golpe`)
- **Type**: React + Vite frontend-only web app
- **Preview**: `/`
- **Description**: Brazilian multiplayer bluffing card game (similar to Coup). Players use characters like Político, Bicheiro, X9, Juiz, Miliciano, and Segurança to accumulate coins and eliminate opponents. Last player standing wins.
- **Realtime backend**: Firebase Realtime Database (project: golpe-63ee3)
- **Key features**:
  - Home screen with cinematic dark UI
  - Room creation/joining via 4-digit code
  - Lobby with player list and host controls
  - Full game table with 3-column grid layout: action log, game board, action panel
  - Timer-based turn system (30s for actions, 10s for reactions)
  - Actions: Político (+3 coins), Propina (steal), X9 (investigate), Trabalhar (+1), Golpe (eliminate)
  - Challenge/bluff mechanics (Duvidar, Bloquear)
  - Auto-pass on timer expiry
