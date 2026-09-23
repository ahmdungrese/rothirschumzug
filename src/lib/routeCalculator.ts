export interface RouteSegment {
  distanceKm: number;
  durationMinutes: number;
}

export interface RouteCalculationResult {
  distanceKm: number;
  durationMinutes: number;
  direct: RouteSegment;
  roundTrip?: RouteSegment & {
    depotAddress: string;
    summary: string;
  };
}

const BOCHUM_DEPOT = {
  address: "Grillostr. 70, 44799 Bochum",
  lat: 51.4641,
  lon: 7.2289
};

export async function calculateRoute(
  addressA: string, 
  addressB: string,
  options?: { includeRoundTrip?: boolean }
): Promise<RouteCalculationResult | null> {
  try {
    const includeRoundTrip = options?.includeRoundTrip ?? true;

    // 1. Geocode Address A
    const coordsA = await geocodeAddress(addressA);
    if (!coordsA) return null;

    // 2. Geocode Address B
    const coordsB = await geocodeAddress(addressB);
    if (!coordsB) return null;

    // 3. Direct Route A -> B
    const directUrl = `https://router.project-osrm.org/route/v1/driving/${coordsA.lon},${coordsA.lat};${coordsB.lon},${coordsB.lat}?overview=false`;
    const directRes = await fetch(directUrl);
    if (!directRes.ok) return null;
    const directData = await directRes.json();

    if (directData.code !== 'Ok' || !directData.routes || directData.routes.length === 0) {
      return null;
    }

    const directRoute = directData.routes[0];
    const directDistanceKm = Math.round((directRoute.distance / 1000) * 10) / 10;
    const directDurationMinutes = Math.round(directRoute.duration / 60);

    const result: RouteCalculationResult = {
      distanceKm: directDistanceKm,
      durationMinutes: directDurationMinutes,
      direct: {
        distanceKm: directDistanceKm,
        durationMinutes: directDurationMinutes
      }
    };

    // 4. Multi-stop Roundtrip Route: Bochum Depot -> A -> B -> Bochum Depot
    if (includeRoundTrip) {
      try {
        const roundTripUrl = `https://router.project-osrm.org/route/v1/driving/${BOCHUM_DEPOT.lon},${BOCHUM_DEPOT.lat};${coordsA.lon},${coordsA.lat};${coordsB.lon},${coordsB.lat};${BOCHUM_DEPOT.lon},${BOCHUM_DEPOT.lat}?overview=false`;
        const rtRes = await fetch(roundTripUrl);
        if (rtRes.ok) {
          const rtData = await rtRes.json();
          if (rtData.code === 'Ok' && rtData.routes && rtData.routes.length > 0) {
            const rtRoute = rtData.routes[0];
            const rtDistanceKm = Math.round((rtRoute.distance / 1000) * 10) / 10;
            const rtDurationMinutes = Math.round(rtRoute.duration / 60);

            result.roundTrip = {
              distanceKm: rtDistanceKm,
              durationMinutes: rtDurationMinutes,
              depotAddress: BOCHUM_DEPOT.address,
              summary: `Bochum Depot ➔ ${addressA} ➔ ${addressB} ➔ Bochum Depot`
            };
          }
        }
      } catch (rtErr) {
        console.warn("Could not calculate Bochum depot roundtrip:", rtErr);
      }
    }

    return result;
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
