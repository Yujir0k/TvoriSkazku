export { registerAuthRoutes } from './auth.routes.js';
export { requireAuth, setSessionCookie, clearSessionCookie } from './auth.middleware.js';
export { authService, EmailAlreadyRegisteredError, InvalidCredentialsError } from './auth.service.js';
export { sessionService } from './session.service.js';
export { passwordHasher } from './password.service.js';
export { toPublicUser } from './types.js';
export type { PublicUser, SessionData, SessionRecord, AuthenticatedUser } from './types.js';
export type { AuthDependencies } from './auth.service.js';
export type { SessionService, SessionServiceOptions } from './session.service.js';
export type { PasswordHasher } from './password.service.js';
export type { AuthContext } from './auth.middleware.js';
export { signUpSchema, signInSchema } from './auth.schema.js';
export { normalizeEmail, normalizeName } from './normalize.js';

