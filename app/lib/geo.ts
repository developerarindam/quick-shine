"use client";

export type Position = { lat: number; lng: number; accuracy: number };

/** Current GPS position, with human messages for the usual failures. */
export function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This phone or browser can't share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Location permission is off. Allow location for this app in your browser / phone settings, then try again."));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("Couldn't get your location in time. Step near a window or turn on GPS and try again."));
        } else {
          reject(new Error("Couldn't get your location. Turn on GPS / location services and try again."));
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  });
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
