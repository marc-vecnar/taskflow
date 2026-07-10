// Helpers for building the standard { data, error, meta } response envelope.
import type {
  ApiError,
  ApiMeta,
  ApiResponse,
  PaginationMeta,
} from "./types.js";

export function ok<T>(data: T, meta: ApiMeta = {}): ApiResponse<T> {
  return { data, error: null, meta };
}

export function paginated<T>(
  data: T,
  pagination: PaginationMeta,
): ApiResponse<T> {
  return { data, error: null, meta: { pagination } };
}

export function fail(error: ApiError): ApiResponse<never> {
  return { data: null, error, meta: {} };
}
