/**
 * Browser Geolocation & Reverse Geocoding Utility
 * Retrieves GPS coordinates and reverse-geocodes them into human-readable Indian addresses
 * using OpenStreetMap Nominatim with zero external secret key requirement.
 */

export interface GeocodedAddress {
  addressLine: string;
  landmark?: string;
  city: string;
  pincode: string;
  formattedAddress: string;
}

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  address?: GeocodedAddress;
  error?: string;
}

/**
 * Reverse geocodes coordinates into Indian address components.
 * Uses Nominatim with fallback gracefully handling network or throttling issues.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<GeocodedAddress | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Sahayak-Hyperlocal-Services-App/1.0',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data || !data.address) {
      return null;
    }

    const addr = data.address;

    // Extract building / road / street
    const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.residential || '';
    const houseNumber = addr.house_number || addr.building || '';
    const area = addr.suburb || addr.neighbourhood || addr.subdistrict || '';
    
    // Address Line composition
    let addressLine = [houseNumber, road].filter(Boolean).join(', ');
    if (!addressLine && area) {
      addressLine = area;
    } else if (!addressLine) {
      addressLine = data.name || (data.display_name ? data.display_name.split(',')[0] : '');
    }

    // Landmark / Colony
    const landmark = addr.commercial || addr.amenity || addr.landmark || (area !== addressLine ? area : '');

    // City determination: Indian cities, municipal corporations, or districts
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.city_district ||
      addr.state_district ||
      addr.county ||
      '';

    // Postal Pincode
    const pincode = addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : '';

    return {
      addressLine: addressLine || 'Detected Location',
      landmark: landmark || undefined,
      city: city || 'Mumbai',
      pincode: pincode && pincode.length === 6 ? pincode : '',
      formattedAddress: data.display_name || addressLine,
    };
  } catch (err) {
    console.warn('[ReverseGeocode] Notice:', err);
    return null;
  }
}
