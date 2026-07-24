import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";

// Text-based PDF extraction runs locally (no OpenAI, no coins). Scanned PDFs
// with no embedded text return the "no text" signal so the client can suggest
// uploading a photo of the page for image OCR instead.
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A PDF file is required" },
        { status: 400 },
      );
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF is too large" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Lazy import so the pdf.js runtime is only loaded when actually needed.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join("\n") : text).trim();

    if (!clean) {
      return NextResponse.json(
        { error: "There is no text in the document" },
        { status: 400 },
      );
    }

    return NextResponse.json({ text: clean });
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return NextResponse.json(
      { error: "Failed to extract text from the PDF" },
      { status: 500 },
    );
  }
}
