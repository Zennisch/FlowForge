import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import type { LoginRequest, RegisterRequest } from '@/types/auth.types';

export function useLogin() {
	const setToken = useAuthStore((state) => state.setToken);

	return useMutation({
		mutationFn: (payload: LoginRequest) => authApi.login(payload),
		onSuccess: (data) => {
			setToken(data.accessToken);
		},
	});
}

export function useRegister() {
	return useMutation({
		mutationFn: (payload: RegisterRequest) => authApi.register(payload),
	});
}
