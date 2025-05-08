# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint Commands

- Build: `yarn build`
- Lint: `yarn lint`
- Type check: `yarn typecheck`
- Development: `yarn dev`
- Start production: `yarn start`

## Code Style Guidelines

- Use single quotes for strings
- Follow TypeScript strict mode guidelines
- Define types with interfaces in appropriate files under domain/types.ts
- Use explicit typing for all properties (avoid any)
- Mark optional properties with ? suffix
- Use ES modules import format
- Use kebab-case for file naming
- Organize imports: external dependencies first, then internal modules
- Handle errors with appropriate try/catch blocks and logging
- Follow functional programming principles where appropriate
- Keep functions small and focused on a single responsibility
