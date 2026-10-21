/** Response — POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password */
export interface CurrentUser {
  userId: string;
  userName: string;
  /** Default (created / reset) password: every other API returns 403 until it is changed */
  mustChangePassword: boolean;
}

/** POST /api/auth/login */
export interface LoginRequest {
  userId: string;
  password: string;
}

/** POST /api/auth/change-password */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
