// Rich Indian city data — sourced from Census 2011, Wikipedia, UN World Urbanization Prospects
export type CityCategory = 'metro' | 'tier1' | 'tier2' | 'tier3' | 'ut_capital' | 'landmark';

export interface IndianCity {
  name: string;
  state: string;
  lat: number;
  lng: number;
  population: number;       // City proper (Census 2011 + estimates)
  metroPopulation?: number; // Metro/UA population 2024 estimate
  elevation: number;        // meters
  area: number;             // sq km
  category: CityCategory;
  industries: string[];
  famousFor: string[];
  filmIndustry?: string;    // Bollywood, Tollywood, Kollywood, etc.
  tags: string[];           // content-creator-relevant tags
}

export const indianCities: IndianCity[] = [
  // ─── MEGA CITIES (10M+) ───────────────────────────────
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777, population: 12442373, metroPopulation: 21700000, elevation: 14, area: 603, category: 'metro', industries: ['Finance', 'Entertainment', 'IT', 'Textiles'], famousFor: ['Gateway of India', 'Marine Drive', 'Bollywood', 'Dharavi', 'CST Station'], filmIndustry: 'Bollywood', tags: ['bollywood', 'finance', 'port', 'nightlife'] },
  { name: 'Delhi', state: 'Delhi NCT', lat: 28.6139, lng: 77.209, population: 16787941, metroPopulation: 33800000, elevation: 216, area: 1484, category: 'metro', industries: ['Government', 'IT', 'Tourism', 'Media'], famousFor: ['Red Fort', 'India Gate', 'Qutub Minar', 'Chandni Chowk', 'Lotus Temple'], tags: ['capital', 'history', 'politics', 'food', 'monuments'] },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, population: 8443675, metroPopulation: 14000000, elevation: 920, area: 741, category: 'metro', industries: ['IT', 'Biotech', 'Aerospace', 'Startups'], famousFor: ['Silicon Valley of India', 'Lalbagh', 'Cubbon Park', 'Vidhana Soudha'], filmIndustry: 'Sandalwood', tags: ['tech', 'startups', 'nightlife', 'weather'] },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867, population: 6809970, metroPopulation: 11100000, elevation: 542, area: 650, category: 'metro', industries: ['IT', 'Pharma', 'Film', 'Pearls'], famousFor: ['Charminar', 'Ramoji Film City', 'Biryani', 'HITEC City', 'Golconda Fort'], filmIndustry: 'Tollywood', tags: ['tech', 'food', 'heritage', 'film'] },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, population: 4681087, metroPopulation: 12100000, elevation: 6, area: 426, category: 'metro', industries: ['Auto', 'IT', 'Film', 'Healthcare'], famousFor: ['Marina Beach', 'Kapaleeshwarar Temple', 'Auto Hub', 'Filter Coffee'], filmIndustry: 'Kollywood', tags: ['culture', 'temples', 'auto', 'music'] },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, population: 4496694, metroPopulation: 15600000, elevation: 9, area: 205, category: 'metro', industries: ['Jute', 'IT', 'Culture', 'Publishing'], famousFor: ['Victoria Memorial', 'Howrah Bridge', 'Durga Puja', 'Rasgulla', 'Tram City'], filmIndustry: 'Tollywood (Bengali)', tags: ['culture', 'literature', 'food', 'festivals'] },

  // ─── MAJOR CITIES (3M-10M) ────────────────────────────
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, population: 5570585, metroPopulation: 8900000, elevation: 53, area: 464, category: 'metro', industries: ['Textiles', 'Pharma', 'Diamond', 'Chemical'], famousFor: ['Sabarmati Ashram', 'Kite Festival', 'Street Food', 'IIM-A', 'Adalaj Stepwell'], tags: ['heritage', 'food', 'business', 'gandhi'] },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, population: 3124458, metroPopulation: 7300000, elevation: 560, area: 331, category: 'tier1', industries: ['IT', 'Auto', 'Education', 'Defence'], famousFor: ['Oxford of the East', 'Shaniwar Wada', 'Aga Khan Palace', 'Lonavala'], tags: ['education', 'youth', 'tech', 'trekking'] },
  { name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311, population: 4462002, metroPopulation: 7500000, elevation: 13, area: 326, category: 'tier1', industries: ['Diamond', 'Textiles', 'IT'], famousFor: ['Diamond Capital', 'Textile Hub', 'Street Food', 'Dumas Beach'], tags: ['business', 'food', 'diamonds'] },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, population: 3046163, metroPopulation: 4300000, elevation: 431, area: 467, category: 'tier1', industries: ['Tourism', 'Gems', 'Textiles', 'IT'], famousFor: ['Pink City', 'Hawa Mahal', 'Amber Fort', 'City Palace', 'Nahargarh'], tags: ['heritage', 'tourism', 'royalty', 'photography'] },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, population: 2817105, metroPopulation: 3800000, elevation: 123, area: 349, category: 'tier1', industries: ['Government', 'IT', 'Handicrafts'], famousFor: ['Nawabi Culture', 'Tunday Kebab', 'Bara Imambara', 'Chikankari'], tags: ['food', 'culture', 'history', 'nawabi'] },

  // ─── TIER 2 CITIES ────────────────────────────────────
  { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lng: 80.3319, population: 2767031, elevation: 126, area: 403, category: 'tier2', industries: ['Leather', 'Textiles', 'Defence'], famousFor: ['IIT Kanpur', 'Leather Industry', 'Ganga Barrage'], tags: ['industry', 'education'] },
  { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882, population: 2405421, elevation: 310, area: 228, category: 'tier2', industries: ['Mining', 'IT', 'Government'], famousFor: ['Orange City', 'Geographic Center of India', 'Deekshabhoomi'], tags: ['oranges', 'geography', 'politics'] },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577, population: 1994397, elevation: 553, area: 530, category: 'tier2', industries: ['IT', 'Pharma', 'Auto'], famousFor: ['Cleanest City', 'Street Food Capital', 'Rajwada Palace'], tags: ['food', 'clean-city', 'culture'] },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185, population: 1728128, elevation: 45, area: 682, category: 'tier2', industries: ['Steel', 'Navy', 'Shipping', 'IT'], famousFor: ['Beach City', 'Eastern Naval Command', 'Araku Valley', 'Submarine Museum'], tags: ['navy', 'beaches', 'steel'] },
  { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126, population: 1798218, elevation: 527, area: 285, category: 'tier2', industries: ['Government', 'IT', 'Textiles'], famousFor: ['City of Lakes', 'Bharat Bhavan', 'Taj-ul-Masajid'], tags: ['lakes', 'history', 'culture'] },
  { name: 'Patna', state: 'Bihar', lat: 25.6093, lng: 85.1376, population: 1684222, elevation: 53, area: 136, category: 'tier2', industries: ['Government', 'Agriculture', 'Education'], famousFor: ['Ancient Pataliputra', 'Mahavir Mandir', 'Golghar', 'Nalanda nearby'], tags: ['history', 'ancient', 'education'] },
  { name: 'Vadodara', state: 'Gujarat', lat: 22.3072, lng: 73.1812, population: 1670806, elevation: 39, area: 235, category: 'tier2', industries: ['Petrochemical', 'Engineering', 'IT'], famousFor: ['Cultural Capital of Gujarat', 'Laxmi Vilas Palace', 'Navratri'], tags: ['culture', 'palaces', 'festivals'] },
  { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558, population: 1601438, elevation: 411, area: 257, category: 'tier2', industries: ['Textiles', 'Engineering', 'IT'], famousFor: ['Manchester of South India', 'Isha Foundation', 'Ooty Gateway'], tags: ['industry', 'temples', 'hill-stations'] },
  { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081, population: 1585704, elevation: 171, area: 188, category: 'tier2', industries: ['Tourism', 'Leather', 'Handicrafts'], famousFor: ['Taj Mahal', 'Agra Fort', 'Fatehpur Sikri', 'Petha Sweet'], tags: ['taj-mahal', 'tourism', 'mughal', 'photography'] },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198, population: 1465625, elevation: 101, area: 148, category: 'tier2', industries: ['Tourism', 'Textiles', 'Rubber'], famousFor: ['Meenakshi Temple', 'Temple City', 'Jallikattu', 'Jigarthanda'], tags: ['temples', 'culture', 'festivals'] },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739, population: 1201815, elevation: 81, area: 163, category: 'tier2', industries: ['Tourism', 'Silk', 'Handicrafts'], famousFor: ['Oldest Living City', 'Ganga Aarti', 'Kashi Vishwanath', 'BHU', 'Banarasi Silk'], tags: ['spiritual', 'ganga', 'culture', 'photography'] },
  { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673, population: 677381, metroPopulation: 2100000, elevation: 0, area: 94, category: 'tier2', industries: ['Shipping', 'IT', 'Tourism', 'Spices'], famousFor: ['Queen of Arabian Sea', 'Chinese Fishing Nets', 'Fort Kochi', 'Biennale'], tags: ['port', 'culture', 'backwaters', 'art'] },
  { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lng: 73.0243, population: 1033918, elevation: 231, area: 78, category: 'tier2', industries: ['Tourism', 'Handicrafts', 'Mining'], famousFor: ['Blue City', 'Mehrangarh Fort', 'Umaid Bhawan', 'Dark Knight Rises filming'], tags: ['heritage', 'photography', 'film-location', 'desert'] },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lng: 76.6394, population: 920550, elevation: 770, area: 128, category: 'tier2', industries: ['Tourism', 'IT', 'Silk'], famousFor: ['City of Palaces', 'Dasara Festival', 'Mysore Palace', 'Chamundi Hills'], tags: ['heritage', 'festivals', 'palaces'] },
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125, population: 451735, elevation: 598, area: 64, category: 'tier2', industries: ['Tourism', 'Mining', 'Handicrafts'], famousFor: ['City of Lakes', 'Lake Palace', 'Octopussy filming', 'Romantic City'], tags: ['lakes', 'romance', 'film-location', 'photography'] },
  { name: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lng: 76.9471, population: 957730, elevation: 10, area: 215, category: 'tier2', industries: ['IT', 'Tourism', 'Space (ISRO/VSSC)'], famousFor: ['Padmanabhaswamy Temple', 'Kovalam Beach', 'ISRO HQ'], tags: ['space', 'beaches', 'temples'] },

  // ─── UT CAPITALS & SPECIAL CITIES ─────────────────────
  { name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lng: 76.7794, population: 1055450, elevation: 321, area: 114, category: 'ut_capital', industries: ['Government', 'IT', 'Education'], famousFor: ['Planned City', 'Rock Garden', 'Sukhna Lake', 'Le Corbusier'], tags: ['architecture', 'planned-city', 'clean'] },
  { name: 'Port Blair', state: 'Andaman & Nicobar', lat: 11.6234, lng: 92.7265, population: 100608, elevation: 16, area: 17, category: 'ut_capital', industries: ['Tourism', 'Fishing', 'Government'], famousFor: ['Cellular Jail', 'Ross Island', 'Radhanagar Beach', 'Scuba Diving'], tags: ['islands', 'history', 'diving', 'beaches'] },
  { name: 'Puducherry', state: 'Puducherry', lat: 11.9416, lng: 79.8083, population: 244377, elevation: 1, area: 19, category: 'ut_capital', industries: ['Tourism', 'IT', 'Textiles'], famousFor: ['French Quarter', 'Auroville', 'Promenade Beach', 'Sri Aurobindo Ashram'], tags: ['french', 'spiritual', 'beaches', 'architecture'] },
  { name: 'Leh', state: 'Ladakh', lat: 34.1526, lng: 77.577, population: 30870, elevation: 3524, area: 45, category: 'ut_capital', industries: ['Tourism', 'Military', 'Agriculture'], famousFor: ['Pangong Lake', 'Khardung La', 'Monasteries', '3 Idiots filming', 'Magnetic Hill'], tags: ['adventure', 'mountains', 'film-location', 'photography'] },
  { name: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973, population: 1180570, elevation: 1585, area: 294, category: 'ut_capital', industries: ['Tourism', 'Handicrafts', 'Saffron', 'Horticulture'], famousFor: ['Dal Lake', 'Houseboats', 'Mughal Gardens', 'Shikara', 'Paradise on Earth'], tags: ['lakes', 'paradise', 'kashmir', 'photography'] },
  { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734, population: 169578, elevation: 2276, area: 36, category: 'tier3', industries: ['Tourism', 'Government', 'Education'], famousFor: ['Hill Station', 'Mall Road', 'Toy Train', 'British Colonial Architecture'], tags: ['hills', 'colonial', 'honeymoon'] },
  { name: 'Darjeeling', state: 'West Bengal', lat: 27.0360, lng: 88.2627, population: 132016, elevation: 2042, area: 10, category: 'tier3', industries: ['Tea', 'Tourism'], famousFor: ['Tea Gardens', 'Toy Train', 'Tiger Hill', 'Kanchenjunga View'], tags: ['tea', 'mountains', 'photography'] },
  { name: 'Rishikesh', state: 'Uttarakhand', lat: 30.0869, lng: 78.2676, population: 102138, elevation: 372, area: 11, category: 'tier3', industries: ['Tourism', 'Yoga', 'Adventure Sports'], famousFor: ['Yoga Capital', 'Beatles Ashram', 'Lakshman Jhula', 'River Rafting', 'Ganga Aarti'], tags: ['yoga', 'adventure', 'spiritual', 'beatles'] },
  { name: 'Goa (Panaji)', state: 'Goa', lat: 15.4909, lng: 73.8278, population: 114405, elevation: 7, area: 36, category: 'tier3', industries: ['Tourism', 'Mining', 'Fishing'], famousFor: ['Beaches', 'Nightlife', 'Portuguese Heritage', 'Carnival', 'Churches'], tags: ['beaches', 'nightlife', 'party', 'heritage'] },
  { name: 'Jaisalmer', state: 'Rajasthan', lat: 26.9157, lng: 70.9083, population: 65471, elevation: 225, area: 5, category: 'tier3', industries: ['Tourism', 'Defence'], famousFor: ['Golden City', 'Sand Dunes', 'Jaisalmer Fort', 'Desert Safari', 'Border'], tags: ['desert', 'photography', 'heritage', 'film-location'] },
  { name: 'Hampi', state: 'Karnataka', lat: 15.335, lng: 76.462, population: 3000, elevation: 467, area: 26, category: 'landmark', industries: ['Tourism'], famousFor: ['UNESCO Heritage', 'Vijayanagara Empire Ruins', 'Boulder Landscape', 'Vittala Temple'], tags: ['ruins', 'heritage', 'photography', 'history'] },
  { name: 'Amritsar', state: 'Punjab', lat: 31.634, lng: 74.8723, population: 1132761, elevation: 234, area: 139, category: 'tier2', industries: ['Tourism', 'Textiles', 'Agriculture'], famousFor: ['Golden Temple', 'Wagah Border', 'Jallianwala Bagh', 'Amritsari Kulcha'], tags: ['spiritual', 'border', 'food', 'photography'] },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362, population: 968549, elevation: 55, area: 328, category: 'tier2', industries: ['Oil', 'Tea', 'Tourism', 'IT'], famousFor: ['Gateway to Northeast', 'Kamakhya Temple', 'Brahmaputra River'], tags: ['northeast', 'temples', 'nature'] },
];

// Utility: find city by name
export function findCity(name: string): IndianCity | undefined {
  return indianCities.find(c => c.name.toLowerCase() === name.toLowerCase());
}

// Utility: cities by category
export function citiesByCategory(cat: CityCategory): IndianCity[] {
  return indianCities.filter(c => c.category === cat);
}

// Utility: cities with a specific tag
export function citiesByTag(tag: string): IndianCity[] {
  return indianCities.filter(c => c.tags.includes(tag));
}

// Utility: cities with film industry
export function filmCities(): IndianCity[] {
  return indianCities.filter(c => c.filmIndustry);
}
