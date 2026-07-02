# Reglas de ramas y PR para agentes de IA (Claude Code / Copilot / Cursor / etc.)

> Pega este bloque (o linkéalo) dentro de tu archivo de instrucciones de IA — `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`, `AGENTS.md` — para que cualquier agente respete el flujo de integración del repo. El detalle operativo completo vive en [`git-workflow.md`](./git-workflow.md).

## Restricción dura — Flujo de ramas Git fijo

> Esta regla es **dura**. Un agente NUNCA debe proponer ni ejecutar un commit/push que la viole.

**Toda integración a `main` pasa por `dev` → `qa` → `main`.**

```
feature/* | fix/* | chore/* | refactor/* | docs/* | test/*
        │
        └── PR ──▶ dev ── PR ──▶ qa ── PR ──▶ main
                                                 ▲
              hotfix/* ── PR ─────────────────────┘
                   │
                   └── back-merge (main → qa → dev) el mismo día
```

- **Ramas largas (protegidas)**: `main`, `qa`, `dev`. **Commit directo prohibido.**
- **Ramas cortas (de trabajo)**: `<prefijo>/<kebab-case>` — minúsculas, guiones, sin tildes, sin espacios, sin underscores.
- **Prefijos válidos**: `feature/` `fix/` `chore/` `refactor/` `docs/` `test/` `hotfix/`.
- **`main` solo recibe de `qa` o de `hotfix/*`.** `qa` solo recibe de `dev`. `dev` recibe de cualquier rama corta válida.
- **Las ramas cortas se crean desde `dev` actualizado** (`hotfix/*` desde `main`).
- **`hotfix/*` exige back-merge a `qa` y `dev` el mismo día** (orden: `main → qa → dev`).
- **`--no-verify` está prohibido** salvo aprobación explícita del dueño del producto, documentando la razón.

## Cómo debe comportarse el agente

1. Antes de cualquier commit, verificar la rama actual. Si es `main`/`qa`/`dev` → **detenerse**, crear una rama corta y trabajar ahí (incluso para un typo).
2. Al abrir PR, dirigirlo a la rama correcta del flujo (rama corta → `dev`, nunca a `qa`/`main` directo).
3. Nunca usar flags interactivos (`git rebase -i`, `git add -i`) ni saltarse hooks.
4. Commit o push **solo cuando el humano lo pida**.

## Enforcement (3 capas, ninguna sustituye a otra)

| Capa | Archivo | Qué hace |
|---|---|---|
| Instrucciones de IA | este archivo + `CLAUDE.md` | El agente rebota la violación antes de ejecutar |
| Hook local pre-push | `.husky/pre-push` | Bloquea `git push` directo a rama protegida |
| Branch protection (opcional) | GitHub Settings → Branches | Rechaza server-side (no incluido por defecto) |
