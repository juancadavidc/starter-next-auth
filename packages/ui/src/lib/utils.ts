import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Une clases condicionales y resuelve conflictos de Tailwind (p. ej. "p-2 p-4" → "p-4").
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
