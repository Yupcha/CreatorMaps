export interface IndianLocation {
  name: string;
  state: string;
  lng: number;
  lat: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  description?: string;
}

export const indianLocations: IndianLocation[] = [
  { name: 'India — Overview', state: '', lng: 78.9629, lat: 22.0, zoom: 4.5, pitch: 0, bearing: 0, description: 'Full country view' },
  { name: 'India — Tilted', state: '', lng: 78.9629, lat: 20.0, zoom: 5, pitch: 50, bearing: -15, description: 'Dramatic angled view' },
  { name: 'India — Globe', state: '', lng: 78.9629, lat: 20.5937, zoom: 3, pitch: 0, bearing: 0, description: 'Globe perspective' },
  { name: 'Mumbai', state: 'Maharashtra', lng: 72.8777, lat: 19.076, zoom: 12, pitch: 60, description: 'Financial capital' },
  { name: 'Delhi', state: 'Delhi', lng: 77.209, lat: 28.6139, zoom: 12, pitch: 55, description: 'National capital' },
  { name: 'Bengaluru', state: 'Karnataka', lng: 77.5946, lat: 12.9716, zoom: 12, pitch: 50, description: 'Tech hub' },
  { name: 'Chennai', state: 'Tamil Nadu', lng: 80.2707, lat: 13.0827, zoom: 12, pitch: 50, description: 'Cultural capital of South' },
  { name: 'Kolkata', state: 'West Bengal', lng: 88.3639, lat: 22.5726, zoom: 12, pitch: 50, description: 'City of Joy' },
  { name: 'Hyderabad', state: 'Telangana', lng: 78.4867, lat: 17.385, zoom: 12, pitch: 50, description: 'City of Pearls' },
  { name: 'Jaipur', state: 'Rajasthan', lng: 75.7873, lat: 26.9124, zoom: 13, pitch: 45, description: 'The Pink City' },
  { name: 'Varanasi', state: 'Uttar Pradesh', lng: 83.0007, lat: 25.3176, zoom: 14, pitch: 60, description: 'Oldest living city' },
  { name: 'Agra', state: 'Uttar Pradesh', lng: 78.0081, lat: 27.1767, zoom: 14, pitch: 55, description: 'Home of the Taj Mahal' },
  { name: 'Udaipur', state: 'Rajasthan', lng: 73.7125, lat: 24.5854, zoom: 14, pitch: 50, description: 'City of Lakes' },
  { name: 'Goa', state: 'Goa', lng: 73.8278, lat: 15.2993, zoom: 11, description: 'Beach paradise' },
  { name: 'Amritsar', state: 'Punjab', lng: 74.8723, lat: 31.634, zoom: 14, pitch: 50, description: 'Golden Temple city' },
  { name: 'Leh', state: 'Ladakh', lng: 77.577, lat: 34.1526, zoom: 13, pitch: 65, description: 'Gateway to Himalayas' },
  { name: 'Manali', state: 'Himachal Pradesh', lng: 77.1892, lat: 32.2396, zoom: 13, pitch: 60, description: 'Mountain hub' },
  { name: 'Shimla', state: 'Himachal Pradesh', lng: 77.1734, lat: 31.1048, zoom: 13, pitch: 55, description: 'Queen of Hills' },
  { name: 'Darjeeling', state: 'West Bengal', lng: 88.2627, lat: 27.0361, zoom: 13, pitch: 60, description: 'Tea gardens & mountains' },
  { name: 'Munnar', state: 'Kerala', lng: 77.0595, lat: 10.0889, zoom: 13, pitch: 55, description: 'Tea plantations' },
  { name: 'Hampi', state: 'Karnataka', lng: 76.46, lat: 15.335, zoom: 14, pitch: 50, description: 'Ancient ruins' },
  { name: 'Rishikesh', state: 'Uttarakhand', lng: 78.2676, lat: 30.0869, zoom: 14, pitch: 55, description: 'Yoga capital on the Ganges' },
  { name: 'Rann of Kutch', state: 'Gujarat', lng: 69.86, lat: 23.73, zoom: 10, pitch: 30, description: 'White salt desert' },
  { name: 'Western Ghats', state: 'Karnataka', lng: 75.5, lat: 14.0, zoom: 10, pitch: 55, description: 'Biodiversity hotspot' },
  { name: 'Andaman Islands', state: 'Andaman & Nicobar', lng: 92.7265, lat: 11.7401, zoom: 9, description: 'Tropical archipelago' },
  { name: 'Pangong Lake', state: 'Ladakh', lng: 78.6406, lat: 33.759, zoom: 11, pitch: 60, bearing: 45, description: 'High-altitude lake' },
  { name: 'Himalayas', state: 'Border Region', lng: 86.925, lat: 27.988, zoom: 12, pitch: 75, bearing: -30, description: 'Roof of the world' },
  { name: 'Thar Desert', state: 'Rajasthan', lng: 71.0, lat: 27.0, zoom: 9, pitch: 35, description: 'Great Indian Desert' },
];

export function searchLocations(query: string): IndianLocation[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return indianLocations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.state.toLowerCase().includes(q) ||
      (loc.description?.toLowerCase().includes(q) ?? false)
  ).slice(0, 8);
}
