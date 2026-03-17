import type { LoginRequest, RegisterRequest } from '@/types/auth.types';

import { apiClient } from './client';

export const authApi = {
	async login(payload: LoginRequest): Promise<{ accessToken: string }> {
		const { data } = await apiClient.post<{ access_token: string }>('/auth/login', payload);
		return { accessToken: data.access_token };
	},

	async register(payload: RegisterRequest): Promise<{ accessToken: string }> {
		const { data } = await apiClient.post<{ access_token: string }>('/auth/register', payload);
		return { accessToken: data.access_token };
	},
};
