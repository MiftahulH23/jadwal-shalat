import { ImageResponse } from "next/og"

const SIZES = [192, 512] as const

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }))
}

/** PNG app icons for the web app manifest (installable PWA). */
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params
  const size = SIZES.find((s) => String(s) === raw) ?? 512
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #10b981, #065f46)",
        }}
      >
        <svg viewBox="0 0 64 64" width={size} height={size}>
          {/* Kept inside the maskable safe zone (centre 80%). */}
          <g transform="translate(9.6 9.6) scale(0.7)">
            <path d="M38 14a19 19 0 1 0 12 32A16 16 0 1 1 38 14z" fill="#fcd34d" />
            <path d="M46 16l1.6 3.9 4.1.3-3.2 2.6 1 4-3.5-2.2-3.5 2.2 1-4-3.2-2.6 4.1-.3z" fill="#fde68a" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
