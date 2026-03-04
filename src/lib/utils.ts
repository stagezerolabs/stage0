import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A simple hash function to get a number from a string
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export function generateNameFromAddress(address: string): string {
  const adjectives = ['Electric', 'Cosmic', 'Cyber', 'Galactic', 'Quantum', 'Astro', 'Solar', 'Nebula', 'Stellar', 'Void'];
  const nouns = ['Voyager', 'Pioneer', 'Explorer', 'Drifter', 'Nomad', 'Jedi', 'Pilot', 'Captain', 'Android', 'Stargazer'];

  if (!address || typeof address !== 'string') {
    return 'Guest';
  }

  const trimmed = address.trim().toLowerCase();

  if (trimmed.length === 0) {
    return 'Guest';
  }

  // Use two independent hashes for better distribution
  // Hash the first half for adjective, second half for noun
  const midpoint = Math.floor(trimmed.length / 2);
  const firstHalf = trimmed.slice(0, midpoint) || trimmed;
  const secondHalf = trimmed.slice(midpoint) || trimmed;

  const adjHash = simpleHash(firstHalf + 'adj');
  const nounHash = simpleHash(secondHalf + 'noun');

  const adjIndex = adjHash % adjectives.length;
  const nounIndex = nounHash % nouns.length;

  return `${adjectives[adjIndex]} ${nouns[nounIndex]}`;
}
