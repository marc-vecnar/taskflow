// Shared API types. Every endpoint returns this envelope: { data, error, meta }.

export interface ApiError {
  code: string;
  message: string;
  // Optional field-level details, e.g. from Zod validation.
  details?: unknown;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

// Identity attached to the request by the auth middleware.
export interface AuthUser {
  id: string;
  email: string;
}

// JWT payload shape for access tokens.
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

// JWT payload shape for refresh tokens.
export interface RefreshTokenPayload {
  sub: string;
}
