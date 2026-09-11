import { NextResponse } from "next/server";

type TextRequest = { mode: "text"; lines: string[]; font: "mixed" | "cursive" | "serif"; extraPrompt?: string; variation?: boolean };
type ImageRequest = { mode: "image"; description: string; style: "watercolor" | "cartoon" | "baby" | "girly" | "storybook" | "paper-cut"; whiteStickerOffset: boolean };

const styleDirections: Record<ImageRequest["style"], string> = {
  watercolor: "A strongly hand-painted watercolor children's-book illustration, visible watercolor blooms and paper-like pigment variation, warm and whimsical, not photorealistic.",
  cartoon: "An original polished cinematic 3D animated-family-film character style, expressive and dimensional, without copying any existing studio or character.",
  baby: "A very simple baby-friendly illustration made from clean flat color blocks, rounded shapes, minimal shading, cheerful and easy to recognize.",
  girly: "A bright playful tween-girl aesthetic with pretty colors, tasteful sparkle accents and charming decorative detail.",
  storybook: "A premium handcrafted 3D storybook figurine style with soft studio lighting, tactile materials and friendly proportions.",
  "paper-cut": "A layered colored-cardstock paper-cut illustration with crisp cut-paper edges, subtle layer depth and simple printable shapes.",
};

const fontDirections: Record<TextRequest["font"], string> = {
  cursive: "Use one elegant, highly legible connected cursive display-lettering family.",
  serif: "Use one bold, elegant, highly legible classic serif display-lettering family.",
  mixed: "Mix a bold elegant serif display face with a complementary connected cursive face; keep the combination cohesive and highly legible.",
};

const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return jsonError("Please sign in again before generating an image.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hpjlfrfignozoldqnqft.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_MHBQEEt1oWki_dwUAgMZig_nlaqRKyv";
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) return jsonError("Image generation is not configured on the server.", 503);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey: supabaseKey } });
  if (!userResponse.ok) return jsonError("Your session has expired. Please sign in again.", 401);

  let body: TextRequest | ImageRequest;
  try { body = await request.json() as TextRequest | ImageRequest; }
  catch { return jsonError("The image request could not be read.", 400); }

  let prompt = "";
  if (body.mode === "text") {
    const lines = Array.isArray(body.lines) ? body.lines.map((line) => String(line).trim().slice(0, 80)).filter(Boolean).slice(0, 4) : [];
    if (!lines.length) return jsonError("Enter at least one line of text.", 400);
    if (!Object.hasOwn(fontDirections, body.font)) return jsonError("Choose a valid font style.", 400);
    const exactText = lines.map((line, index) => `Line ${index + 1}: ${JSON.stringify(line)}`).join("\n");
    prompt = `Create a single-color cake-topper lettering design as a transparent-background PNG. Render ONLY the requested lettering in near-black ink (#252826); no cake, stick, border, frame, scenery, mockup, paper, shadow, texture, background, or extra words. Preserve the spelling, capitalization, line order and line breaks EXACTLY. Center the composition and keep every letter fully inside the canvas with generous transparent padding. The letterforms must be smooth, clean, connected where practical, and suitable for conversion into a Cricut cut path. ${fontDirections[body.font]} ${body.variation ? "Create a distinctly different font treatment from the previous version while following every other instruction." : ""}\n\nEXACT TEXT:\n${exactText}${body.extraPrompt?.trim() ? `\n\nOptional decorative instruction, only if it does not alter the exact text: ${String(body.extraPrompt).trim().slice(0, 240)}` : ""}`;
  } else if (body.mode === "image") {
    const description = String(body.description || "").trim().slice(0, 500);
    if (!description) return jsonError("Describe the image you want.", 400);
    if (!Object.hasOwn(styleDirections, body.style)) return jsonError("Choose a valid image style.", 400);
    prompt = `Create one isolated cake-topper illustration of: ${description}. ${styleDirections[body.style]} Transparent background, no scene, no cake, no supporting stick, no text, no watermark, and no cropped or frame-touching parts. Keep the entire subject fully visible, centered, with generous transparent padding and a clean continuous silhouette suitable for Cricut cutting. Use crisp, smooth, high-resolution edges.${body.whiteStickerOffset ? " Add a clearly visible, even white sticker-like offset border around the complete outer silhouette; keep the area beyond that border transparent." : " Do not add a white sticker border."}`;
  } else return jsonError("Choose a valid generation type.", 400);

  const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAIKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2.5-sunburst", prompt, size: "1024x1024", quality: "medium", background: "transparent", output_format: "png" }),
  });
  const result = await imageResponse.json() as { data?: { b64_json?: string; revised_prompt?: string }[]; error?: { message?: string } };
  if (!imageResponse.ok) return jsonError(result.error?.message || "OpenAI could not generate the image.", imageResponse.status >= 500 ? 502 : imageResponse.status);
  const image = result.data?.[0]?.b64_json;
  if (!image) return jsonError("OpenAI returned no image data.", 502);
  return NextResponse.json({ image: `data:image/png;base64,${image}` });
}
