// El ID se interpola en un <script> inline: solo se acepta el formato de GA4.
export function isValidGaId(id: string | undefined): id is string {
  return !!id && /^G-[A-Z0-9]{4,}$/.test(id);
}
