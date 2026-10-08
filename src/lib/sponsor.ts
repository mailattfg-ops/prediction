/** Event sponsor branding, configured through the environment so the platform stays reusable. */
export type Sponsor = { name: string; tagline: string; logoUrl: string | null; url: string | null };

export function getSponsor(): Sponsor | null {
  const name = process.env.SPONSOR_NAME?.trim();
  if (!name) return null;
  return {
    name,
    tagline: process.env.SPONSOR_TAGLINE?.trim() || "Presented by",
    logoUrl: process.env.SPONSOR_LOGO_URL?.trim() || null,
    url: process.env.SPONSOR_URL?.trim() || null,
  };
}
