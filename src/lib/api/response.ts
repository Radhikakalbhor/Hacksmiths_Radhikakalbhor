/**
 * Standardized API Response Utilities
 * Ensures consistent JSON responses across all marketplace endpoints.
 */

import { NextResponse } from 'next/server';

export interface ApiSuccessPayload<T> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorPayload {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  pagination?: ApiSuccessPayload<T>['pagination']
): NextResponse<ApiSuccessPayload<T>> {
  const payload: ApiSuccessPayload<T> = {
    success: true,
    data,
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return NextResponse.json(payload, { status });
}

export function apiError(
  message: string,
  status = 400,
  code?: string,
  details?: unknown
): NextResponse<ApiErrorPayload> {
  const payload: ApiErrorPayload = {
    success: false,
    error: message,
  };

  if (code) payload.code = code;
  if (details) payload.details = details;

  return NextResponse.json(payload, { status });
}
