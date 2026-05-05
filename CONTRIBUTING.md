# Contributing

## Branch Strategy

- `main` contains production-ready code.
- `develop` contains integration work and feature merges.
- Feature branches should be named `feature/<ticket>-summary`.
- Hotfixes should be named `hotfix/<ticket>-summary`.

## Commit Conventions

Use short, imperative commit messages. Examples:

- `feat: add token request approval endpoint`
- `fix: remove debug console log from dashboard`
- `chore: add eslint and prettier configuration`
- `docs: add API documentation`

## Formatting

- Use Prettier formatting.
- Follow the `.editorconfig` settings.
- Use `npm run lint` in each package before merging.

## Code Reviews

- PRs must include a short summary of changes.
- Include testing notes and any manual validation steps.
- Avoid large changes in a single PR when possible.

## Folder Structure Rules

- Keep backend logic in `backend/src`.
- Keep frontend logic in `DK_Token_Frontend/src`.
- Use service layers for business logic and utility modules for shared helpers.
- Avoid deeply nested component trees when a reusable component can be extracted.

## Testing

- Backend tests live in `backend/tests`.
- Validate new routes with API-level tests or manual test flows.
- Run `npm run test:backend` before merging backend changes.

## Documentation

- Keep docs in the repository root and `docs/` when appropriate.
- Update `README.md` and architecture docs for breaking changes.
- Add API documentation for new endpoints.
