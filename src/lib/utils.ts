import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string | undefined): string {
  if (!phone) return '-';
  const cleaned = ('' + phone).replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  if (cleaned.length > 11) {
    // Handle cases with country code or more digits
    const offset = cleaned.length - 11;
    return `+${cleaned.substring(0, offset)} (${cleaned.substring(offset, offset + 2)}) ${cleaned.substring(offset + 2, offset + 7)}-${cleaned.substring(offset + 7)}`;
  }
  
  return phone;
}
