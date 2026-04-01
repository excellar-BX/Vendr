import { router } from 'expo-router';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (path.includes('token=') && path.includes('type=signup')) {
      return '/confirm';
    }
    return path;
  } catch {
    return '/';
  }
}