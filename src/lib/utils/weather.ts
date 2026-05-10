export interface WeatherData {
  temp: string;
  condition: string;
}

const cache = new Map<string, { data: WeatherData; timestamp: number }>();

export async function fetchWeather(location: string): Promise<WeatherData | null> {
  const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
  const key = location.toLowerCase();

  if (cache.has(key)) {
    const cached = cache.get(key)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
    if (!res.ok) return null;
    const data = await res.json();
    
    const weather: WeatherData = {
      temp: data.current_condition[0].temp_C,
      condition: data.current_condition[0].weatherDesc[0].value,
    };
    
    cache.set(key, { data: weather, timestamp: Date.now() });
    return weather;
  } catch (e) {
    console.warn('Weather fetch failed for', location, e);
    return null;
  }
}
