import * as Location from 'expo-location';

import type { Gym, State } from './store';

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

export const hasGym = (s: State) => s.gyms.length > 0;

export const activeGym = (s: State): Gym | null => s.gyms.find((g) => g.id === s.activeGymId) ?? s.gyms[0] ?? null;

export const travelOf = (s: State) => activeGym(s)?.travelMin ?? 20;

/** You count as "left home" past this distance. A little wider than a room-sized GPS wobble. */
export const HOME_LEFT_M = 150;

/** Position without ever asking for permission. For background-style polling while the app is open. */
export async function quietPlace(): Promise<Point | null> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

/** Used by "I'm at the gym". Works at any saved gym. Returns a message when you are too far from all of them. */
export async function checkAtGym(s: State): Promise<{ ok: true; gymId?: string } | { ok: false; message: string }> {
  if (!s.verifyLocation || !hasGym(s)) return { ok: true };
  const here = await currentPlace();
  // Phone GPS is off by a few meters indoors; forgive up to 50 m of that.
  const slack = Math.min(here.accuracy, 50);
  const ranked = s.gyms
    .map((g) => ({ g, d: distanceM(here, { lat: g.lat, lng: g.lng }) }))
    .sort((a, b) => a.d - b.d);
  const best = ranked[0];
  if (best.d - slack <= s.gymRadius) return { ok: true, gymId: best.g.id };
  const far = best.d >= 1000 ? `${(best.d / 1000).toFixed(1)} km` : `${Math.round(best.d)} m`;
  return { ok: false, message: `You're ${far} from ${best.g.label}. Get within ${s.gymRadius} m, then tap again.` };
}
