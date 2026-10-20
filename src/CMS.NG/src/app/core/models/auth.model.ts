export interface LoginRequest {
  userId: string;
  password: string;
}

/** POST /api/auth/login response, kept in sessionStorage. */
export interface UserProfile {
  userId: string;
  userName: string;
  accessToken: string;
}

/** PUT /api/auth/profile — only UserName; the API takes the user from the token. */
export interface UpdateProfileRequest {
  userName: string;
}

export interface ProfileResponse {
  userId: string;
  userName: string;
}

/** POST /api/auth/change-password — plain passwords in, nothing back (no hash ever crosses the wire). */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
