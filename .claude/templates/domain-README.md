# [Domain Name] 

## Purpose
What this domain is responsible for and why it exists.

*Example: "Handles user authentication, authorization, and session management. Ensures secure access to protected resources."*

## Boundaries
What is inside/outside this domain's responsibility.

**Inside this domain:**
- User login/logout flows
- JWT token validation  
- Role-based permissions
- Session persistence

**Outside this domain:**
- User profile management (handled by `users` domain)
- Password reset emails (handled by `notifications` domain)
- Audit logging (handled by `audit` domain)

## Key Files
- `types.ts` - Core domain types and interfaces
- `service.ts` - Main business logic
- `api.ts` - External integrations  
- `handlers.ts` - HTTP request handlers
- `__tests__/` - Domain-specific tests

## Common Patterns

### Adding New Endpoints
1. Define types in `types.ts`
2. Add business logic to `service.ts`  
3. Create handler in `handlers.ts`
4. Wire up route in parent router
5. Add tests in `__tests__/`

### Error Handling
This domain uses `Result<T, E>` pattern for error handling:
```typescript
const result = await authenticate(token);
if (result.isError()) {
  return handleAuthError(result.error);
}
```

## Dependencies
- `shared/crypto` - For password hashing
- `shared/jwt` - For token operations
- `shared/db` - For user data access
- External: Redis for session storage