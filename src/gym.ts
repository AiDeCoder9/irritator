import * as Location from 'expo-location';

import type { State } from './store';

export type Point = { lat: number; lng: number };

/** Straight-line distance in meters (haversine). */
export function distanceM(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export async function ensureLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location is off. Allow it in Android settings, Apps, IRRITATOR, Permissions, Location.');
  }
}

export async function currentPlace(): Promise<Point & { accuracy: number }> {
  await ensureLocationPermission();
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 0 };
}

export async function findAddress(query: string): Promise<Point> {
  await ensureLocationPermission();
  const [hit] = await Location.geocodeAsync(query);
  if (!hit) throw new Error('No place found for that address. Add the city or area, or use your current location.');
  return { lat: hit.latitude, lng: hit.longitude };
}

export const hasGym = (s: State) => s.gymLat != null && s.gymLng != null;

/** Used by "I'm at the gym". Returns a message when you are too far away. */
export async function checkAtGym(s: State): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!s.verifyLocation || !hasGym(s)) return { ok: true };
  const here = await currentPlace();
  const d = distanceM(here, { lat: s.gymLat!, lng: s.gymLng! });
  // Phone GPS is off by a few meters indoors; forgive up to 50 m of that.
  if (d - Math.min(here.accuracy, 50) <= s.gymRadius) return { ok: true };
  const far = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
  return { ok: false, message: `You're ${far} from ${s.gymLabel || 'your gym'}. Get within ${s.gymRadius} m, then tap again.` };
}
