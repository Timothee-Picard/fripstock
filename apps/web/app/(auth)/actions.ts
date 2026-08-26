'use server';

import { redirect } from 'next/navigation';
import { publicApiFetch, ApiError } from '@/lib/api';
import { clearToken, setToken } from '@/lib/session';

export interface FormState {
  error?: string;
}

interface AuthResponse {
  accessToken: string;
}

export async function login(_state: FormState, data: FormData): Promise<FormState> {
  try {
    const response = await publicApiFetch<AuthResponse>('/auth/login', {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    });
    await setToken(response.accessToken);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Connexion impossible.' };
  }
  // Hors du try : redirect() lève une exception de contrôle que le catch
  // avalerait en la présentant comme une erreur de connexion.
  redirect('/dashboard');
}

export async function register(_state: FormState, data: FormData): Promise<FormState> {
  try {
    const response = await publicApiFetch<AuthResponse>('/auth/register', {
      companyName: String(data.get('companyName') ?? ''),
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      firstName: String(data.get('firstName') ?? ''),
      lastName: String(data.get('lastName') ?? ''),
    });
    await setToken(response.accessToken);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Inscription impossible.' };
  }
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  await clearToken();
  redirect('/login');
}
