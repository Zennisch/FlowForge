import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth.api';
import { extractUserFromAccessToken } from '@/lib/utils/auth-token';
import { useAuthStore } from '@/store/auth.store';
import type {
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';

export function useLogin() {
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (data) => {
      setToken(data.accessToken);

      const user = extractUserFromAccessToken(data.accessToken);
      if (user) {
        setUser(user);
      }
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterRequest) => authApi.register(payload),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (payload: VerifyEmailRequest) => authApi.verifyEmail(payload),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (payload: ResendVerificationRequest) => authApi.resendVerification(payload),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordRequest) => authApi.forgotPassword(payload),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordRequest) => authApi.resetPassword(payload),
  });
}
