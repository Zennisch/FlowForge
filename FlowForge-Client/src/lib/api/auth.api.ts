import type {
	AuthMessageResponse,
	ForgotPasswordRequest,
	LoginRequest,
	RegisterRequest,
	ResendVerificationRequest,
	ResetPasswordRequest,
	VerifyEmailRequest,
} from '@/types/auth.types';

import { apiClient } from './client';

export const authApi = {
	async login(payload: LoginRequest): Promise<{ accessToken: string }> {
		const { data } = await apiClient.post<{ access_token: string }>('/auth/login', payload);
		return { accessToken: data.access_token };
	},

	async register(payload: RegisterRequest): Promise<AuthMessageResponse> {
		const { data } = await apiClient.post<AuthMessageResponse>('/auth/register', payload);
		return data;
	},

	async verifyEmail(payload: VerifyEmailRequest): Promise<AuthMessageResponse> {
		const { data } = await apiClient.post<AuthMessageResponse>('/auth/verify-email', payload);
		return data;
	},

	async resendVerification(payload: ResendVerificationRequest): Promise<AuthMessageResponse> {
		const { data } = await apiClient.post<AuthMessageResponse>(
			'/auth/resend-verification',
			payload,
		);
		return data;
	},

	async forgotPassword(payload: ForgotPasswordRequest): Promise<AuthMessageResponse> {
		const { data } = await apiClient.post<AuthMessageResponse>('/auth/forgot-password', payload);
		return data;
	},

	async resetPassword(payload: ResetPasswordRequest): Promise<AuthMessageResponse> {
		const { data } = await apiClient.post<AuthMessageResponse>('/auth/reset-password', payload);
		return data;
	},
};
