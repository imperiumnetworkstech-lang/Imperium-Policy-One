import { Car, HeartPulse, Umbrella, Building2, ShieldCheck } from 'lucide-react';

export const CAT_ICON = { motor: Car, health: HeartPulse, life: Umbrella, non_motor: Building2 };
export const catIcon = (id) => CAT_ICON[id] || ShieldCheck;
export const CAT_TONE = { motor: 'brand', health: 'pink', life: 'periwinkle', non_motor: 'amber' };
