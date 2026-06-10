import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

// Wrap a route handler so AuthError / ZodError map to proper status codes.
export function handle<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: err.flatten() },
          { status: 400 },
        );
      }
      console.error("[api] unhandled error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
