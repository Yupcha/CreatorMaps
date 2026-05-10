// Country data fetched from REST Countries API (free, no API key)
export interface CountryData {
  name: string;
  officialName: string;
  capital: string[];
  population: number;
  area: number;
  region: string;
  subregion: string;
  languages: Record<string, string>;
  currencies: Record<string, { name: string; symbol: string }>;
  timezones: string[];
  flag: string;
  coatOfArms: string;
  borders: string[];
  latlng: [number, number];
  maps: { googleMaps: string; openStreetMaps: string };
  gini?: Record<string, number>;
  demonyms?: Record<string, { f: string; m: string }>;
  car?: { side: string };
  fifa?: string;
  idd?: { root: string; suffixes: string[] };
  tld?: string[];
  independent?: boolean;
  unMember?: boolean;
  startOfWeek?: string;
}

export interface IndiaStateData {
  name: string;
  capital: string;
  population: number;
  area: number;
  language: string;
  literacy: number;
  gdpBillionUsd: number;
  description: string;
}

// Curated India state/UT data for instant display (no API needed)
// Complete: 28 States + 8 Union Territories = 36 entities
export const indiaStates: IndiaStateData[] = [
  // ─── 28 STATES ───────────────────────────────────────────
  { name: 'Maharashtra', capital: 'Mumbai', population: 123144223, area: 307713, language: 'Marathi', literacy: 82.9, gdpBillionUsd: 440, description: 'Financial & entertainment capital of India' },
  { name: 'Uttar Pradesh', capital: 'Lucknow', population: 199812341, area: 240928, language: 'Hindi', literacy: 67.7, gdpBillionUsd: 240, description: 'Most populous state, home to the Taj Mahal' },
  { name: 'Tamil Nadu', capital: 'Chennai', population: 72147030, area: 130060, language: 'Tamil', literacy: 80.3, gdpBillionUsd: 260, description: 'Automobile & IT hub of South India' },
  { name: 'Karnataka', capital: 'Bengaluru', population: 61095297, area: 191791, language: 'Kannada', literacy: 75.4, gdpBillionUsd: 230, description: 'Silicon Valley of India' },
  { name: 'Gujarat', capital: 'Gandhinagar', population: 60439692, area: 196024, language: 'Gujarati', literacy: 79.3, gdpBillionUsd: 230, description: 'Industrial powerhouse & textiles hub' },
  { name: 'Rajasthan', capital: 'Jaipur', population: 68548437, area: 342239, language: 'Hindi', literacy: 66.1, gdpBillionUsd: 130, description: 'Land of kings, forts, and deserts' },
  { name: 'West Bengal', capital: 'Kolkata', population: 91276115, area: 88752, language: 'Bengali', literacy: 77.1, gdpBillionUsd: 170, description: 'Cultural capital with rich literary heritage' },
  { name: 'Madhya Pradesh', capital: 'Bhopal', population: 72626809, area: 308252, language: 'Hindi', literacy: 69.3, gdpBillionUsd: 120, description: 'Heart of India — wildlife & temples' },
  { name: 'Kerala', capital: 'Thiruvananthapuram', population: 33406061, area: 38863, language: 'Malayalam', literacy: 94.0, gdpBillionUsd: 110, description: 'Highest literacy, backwaters & spice gardens' },
  { name: 'Telangana', capital: 'Hyderabad', population: 35003674, area: 114840, language: 'Telugu', literacy: 72.8, gdpBillionUsd: 140, description: 'Tech hub — Hyderabad & pharma capital' },
  { name: 'Andhra Pradesh', capital: 'Amaravati', population: 49577103, area: 162975, language: 'Telugu', literacy: 67.4, gdpBillionUsd: 130, description: 'Rice bowl of India & major port state' },
  { name: 'Punjab', capital: 'Chandigarh', population: 27743338, area: 50362, language: 'Punjabi', literacy: 76.7, gdpBillionUsd: 75, description: 'Breadbasket of India — agriculture & valor' },
  { name: 'Odisha', capital: 'Bhubaneswar', population: 41974218, area: 155707, language: 'Odia', literacy: 72.9, gdpBillionUsd: 70, description: 'Temple architecture & tribal heritage' },
  { name: 'Bihar', capital: 'Patna', population: 104099452, area: 94163, language: 'Hindi', literacy: 61.8, gdpBillionUsd: 75, description: 'Ancient seat of learning — Nalanda & Bodh Gaya' },
  { name: 'Assam', capital: 'Dispur', population: 31205576, area: 78438, language: 'Assamese', literacy: 72.2, gdpBillionUsd: 45, description: 'Tea gardens & one-horned rhinoceros' },
  { name: 'Goa', capital: 'Panaji', population: 1458545, area: 3702, language: 'Konkani', literacy: 88.7, gdpBillionUsd: 10, description: 'Beach paradise & Portuguese heritage' },
  { name: 'Himachal Pradesh', capital: 'Shimla', population: 6864602, area: 55673, language: 'Hindi', literacy: 82.8, gdpBillionUsd: 20, description: 'Hill stations & apple orchards' },
  { name: 'Uttarakhand', capital: 'Dehradun', population: 10086292, area: 53483, language: 'Hindi', literacy: 78.8, gdpBillionUsd: 30, description: 'Land of gods — Char Dham pilgrimage' },
  { name: 'Jharkhand', capital: 'Ranchi', population: 32988134, area: 79710, language: 'Hindi', literacy: 66.4, gdpBillionUsd: 45, description: 'Mineral-rich — coal & iron ore capital' },
  { name: 'Chhattisgarh', capital: 'Raipur', population: 25545198, area: 135194, language: 'Hindi', literacy: 70.3, gdpBillionUsd: 40, description: 'Tribal culture & dense forests' },
  { name: 'Haryana', capital: 'Chandigarh', population: 25351462, area: 44212, language: 'Hindi', literacy: 75.6, gdpBillionUsd: 100, description: 'Gurgaon tech corridor & dairy farming' },
  { name: 'Sikkim', capital: 'Gangtok', population: 610577, area: 7096, language: 'Nepali', literacy: 81.4, gdpBillionUsd: 4, description: 'Himalayan gem — Kanchenjunga views' },
  { name: 'Meghalaya', capital: 'Shillong', population: 2966889, area: 22429, language: 'Khasi', literacy: 74.4, gdpBillionUsd: 5, description: 'Abode of clouds — living root bridges' },
  { name: 'Manipur', capital: 'Imphal', population: 2855794, area: 22327, language: 'Meitei', literacy: 79.2, gdpBillionUsd: 4, description: 'Jewel of India — Loktak Lake & polo' },
  { name: 'Mizoram', capital: 'Aizawl', population: 1097206, area: 21081, language: 'Mizo', literacy: 91.3, gdpBillionUsd: 3, description: 'Second-highest literacy — bamboo hills' },
  { name: 'Nagaland', capital: 'Kohima', population: 1978502, area: 16579, language: 'English', literacy: 79.6, gdpBillionUsd: 4, description: 'Hornbill Festival & Naga heritage' },
  { name: 'Tripura', capital: 'Agartala', population: 3673917, area: 10486, language: 'Bengali', literacy: 87.2, gdpBillionUsd: 6, description: 'Rubber plantations & Ujjayanta Palace' },
  { name: 'Arunachal Pradesh', capital: 'Itanagar', population: 1383727, area: 83743, language: 'English', literacy: 65.4, gdpBillionUsd: 4, description: 'Land of the dawn-lit mountains' },

  // ─── 8 UNION TERRITORIES ─────────────────────────────────
  { name: 'Delhi NCT', capital: 'New Delhi', population: 16787941, area: 1484, language: 'Hindi', literacy: 86.2, gdpBillionUsd: 110, description: 'National capital — history & governance' },
  { name: 'Jammu & Kashmir', capital: 'Srinagar', population: 12267032, area: 42241, language: 'Urdu', literacy: 67.2, gdpBillionUsd: 20, description: 'Paradise on Earth — Dal Lake & snow peaks' },
  { name: 'Ladakh', capital: 'Leh', population: 274289, area: 59146, language: 'Ladakhi', literacy: 77.2, gdpBillionUsd: 1, description: 'Roof of the world — Pangong Lake & monasteries' },
  { name: 'Andaman & Nicobar', capital: 'Port Blair', population: 380581, area: 8249, language: 'Hindi', literacy: 86.6, gdpBillionUsd: 1, description: 'Tropical archipelago — pristine beaches & coral reefs' },
  { name: 'Chandigarh', capital: 'Chandigarh', population: 1055450, area: 114, language: 'Hindi', literacy: 86.1, gdpBillionUsd: 5, description: 'Le Corbusier\'s planned city — shared capital' },
  { name: 'Dadra & Nagar Haveli', capital: 'Daman', population: 586956, area: 603, language: 'Gujarati', literacy: 77.7, gdpBillionUsd: 3, description: 'Industrial hub — merged UT with coastal charm' },
  { name: 'Lakshadweep', capital: 'Kavaratti', population: 64473, area: 32, language: 'Malayalam', literacy: 91.9, gdpBillionUsd: 0.2, description: 'Coral paradise — India\'s smallest UT' },
  { name: 'Puducherry', capital: 'Puducherry', population: 1247953, area: 479, language: 'Tamil', literacy: 85.9, gdpBillionUsd: 8, description: 'French colonial heritage — Auroville & beaches' },
];

// Fetch India country-level data from REST Countries API
export async function fetchIndiaData(): Promise<CountryData> {
  const res = await fetch('https://restcountries.com/v3.1/alpha/IND?fields=name,capital,population,area,region,subregion,languages,currencies,timezones,flag,coatOfArms,borders,latlng,maps,gini,demonyms,car,fifa,idd,tld,independent,unMember,startOfWeek');
  if (!res.ok) throw new Error('Failed to fetch India data');
  const data = await res.json();
  return {
    name: data.name?.common ?? 'India',
    officialName: data.name?.official ?? 'Republic of India',
    capital: data.capital ?? ['New Delhi'],
    population: data.population ?? 1380004385,
    area: data.area ?? 3287263,
    region: data.region ?? 'Asia',
    subregion: data.subregion ?? 'Southern Asia',
    languages: data.languages ?? {},
    currencies: data.currencies ?? {},
    timezones: data.timezones ?? ['UTC+05:30'],
    flag: data.flag ?? '🇮🇳',
    coatOfArms: data.coatOfArms?.svg ?? '',
    borders: data.borders ?? [],
    latlng: data.latlng ?? [20, 77],
    maps: data.maps ?? {},
    gini: data.gini,
    demonyms: data.demonyms,
    car: data.car,
    fifa: data.fifa,
    idd: data.idd,
    tld: data.tld,
    independent: data.independent,
    unMember: data.unMember,
    startOfWeek: data.startOfWeek,
  };
}

// Format large numbers with Indian notation
export function formatIndianNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
}

export function formatArea(n: number): string {
  return n.toLocaleString('en-IN') + ' km²';
}
