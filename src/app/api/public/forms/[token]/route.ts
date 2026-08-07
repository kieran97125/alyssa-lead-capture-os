import { NextRequest, NextResponse } from "next/server";
import { getPublicFormConfig } from "@/lib/data/publicFormConfig";

const PUBLIC_FORM_CONFIG_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const result = await getPublicFormConfig(token);

  return NextResponse.json(result.body, {
    status: result.status,
    headers: PUBLIC_FORM_CONFIG_HEADERS,
  });
}
