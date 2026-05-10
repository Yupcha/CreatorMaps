// SVGL Logo Fetcher — uses the free svgl.app API for tech/company SVG logos
// Docs: https://svgl.app

const logoCache = new Map<string, string | null>();

export interface SVGLogo {
  id: number;
  title: string;
  category: string;
  route: string | { light: string; dark: string };
  url: string;
}

/**
 * Fetch an SVG logo URL by company/tech name.
 * Returns the SVG URL string or null if not found.
 * Results are cached in-memory.
 */
export async function fetchLogo(name: string): Promise<string | null> {
  const key = name.toLowerCase().trim();
  if (logoCache.has(key)) return logoCache.get(key) ?? null;

  try {
    const res = await fetch(`https://api.svgl.app?search=${encodeURIComponent(key)}`);
    if (!res.ok) {
      logoCache.set(key, null);
      return null;
    }
    const data: SVGLogo[] = await res.json();
    if (data.length === 0) {
      logoCache.set(key, null);
      return null;
    }

    // Prefer the first match. Route can be a string or {light, dark} object.
    const logo = data[0];
    const url = typeof logo.route === 'string' ? logo.route : logo.route.dark ?? logo.route.light;
    logoCache.set(key, url);
    return url;
  } catch {
    logoCache.set(key, null);
    return null;
  }
}

/**
 * Fetch multiple logos in parallel.
 * Returns a Map of name → SVG URL.
 */
export async function fetchLogos(names: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const unique = [...new Set(names.map(n => n.toLowerCase().trim()))];

  await Promise.allSettled(
    unique.map(async (name) => {
      const url = await fetchLogo(name);
      results.set(name, url);
    })
  );

  return results;
}

// Common Indian tech companies for quick lookups
export const INDIAN_TECH_COMPANIES = [
  'Infosys', 'TCS', 'Wipro', 'HCL', 'Reliance', 'Tata',
  'Mahindra', 'Bajaj', 'Flipkart', 'Zomato', 'Swiggy',
  'PhonePe', 'Razorpay', 'Zerodha', 'CRED', 'Ola',
  'Paytm', 'Byju', 'Dream11', 'Freshworks',
];
