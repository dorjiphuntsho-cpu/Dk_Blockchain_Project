# Security Guide

## Secret Management

- Keep all secrets out of source control.
- Use `backend/.env` and `DK_Token_Frontend/.env` for environment-specific secrets.
- Do not commit `.env` files or private key files.
- Use a secret manager for production deployments.

## API Security

- Authenticate users with JWT tokens.
- `JWT_SECRET` must be strong and rotated if compromised.
- Protect sensitive endpoints with `authMiddleware` and `roleMiddleware`.
- Use HTTPS for all API traffic.

## Validation and Error Handling

- Backend request validation is enforced through Zod schemas in `src/validators`.
- Validation errors return `400` and a structured error response.
- The global error middleware centralizes API error formatting.
- Prisma unique constraint failures return `409`.

## Password Security

- Passwords are hashed with bcrypt.
- `BCRYPT_SALT_ROUNDS` should be configured to balance security and performance.
- Never log plaintext passwords or token values.

## Wallet Security

- Browser wallet signing is done in the wallet extension; private keys never leave the browser.
- Use `window.solana` providers only after verifying wallet authenticity.
- Users should never enter private keys in the portal UI.

## Environment Variable Security

- Use `SOLANA_RPC_URL` to isolate the correct network.
- Protect `SOLANA_ADMIN_KEYPAIR_PATH` and file-system wallet keypaths.
- In production, use secure file permissions for keypair files.

## Rate Limiting

- The current codebase does not include rate limiting by default.
- Add request throttling or proxy-level rate limits for public endpoints.
- Protect authentication and payment endpoints first.

## Secure Headers

- The backend uses `helmet()` to add security headers.
- Use Nginx or the web server to enforce HSTS, CSP, and frame options.

## Logging and Monitoring

- Keep production logs centralized and redact secrets.
- Log audit events for role changes, approvals, and transaction execution.
- Monitor health checks and error rates.

## Deployment Security

- Use separate environments for local, staging, and production.
- Validate environment variables before startup.
- Avoid development RPC links in production builds.

## Blockchain Security Considerations

- Confirm the Solana program ID matches the deployed Anchor program.
- Validate destination accounts before on-chain transfers.
- Use ATA handling to avoid account collisions.
- Record transaction signatures and explorer URLs for troubleshooting.
