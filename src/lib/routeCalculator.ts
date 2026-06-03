export async function calculateRoute(addressA: string, addressB: string): Promise<{ distanceKm: number, durationMinutes: number } | null> {
  try {
    // 1. Geocode Address A
    const coordsA = await geocodeAddress(addressA);
    if (!coordsA) return null;

    // 2. Geocode Address B
    const coordsB = await geocodeAddress(addressB);
    if (!coordsB) return null;

    // 3. OSRM Routing
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsA.lon},${coordsA.lat};${coordsB.lon},${coordsB.lat}?overview=false`;
    const routeRes = await fetch(osrmUrl);
    
    if (!routeRes.ok) return null;
    const routeData = await routeRes.json();

    if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
      const route = routeData.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const durationMinutes = Math.round(route.duration / 60);
      return { distanceKm, durationMinutes };
    }
    
    return null;
  } catch (error) {
    console.error("Error calculating route:", error);
    return null;
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number, lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'User-Agent': 'Rothirsch-Umzuege-ERP/1.0'
      }
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding failed for address: " + address, error);
    return null;
  }
}
