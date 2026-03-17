import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types/auth.types';

import { apiClient } from './client';

export const authApi = {
	async login(payload: LoginRequest): Promise<AuthResponse> {
		const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
		return data;
	},

	async register(payload: RegisterRequest): Promise<AuthResponse> {
		const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
		return data;
	},
};
