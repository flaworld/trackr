import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/urls";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(absoluteUrl("/login"));
}

export async function GET() {
  await destroySession();
  return NextResponse.redirect(absoluteUrl("/login"));
}
