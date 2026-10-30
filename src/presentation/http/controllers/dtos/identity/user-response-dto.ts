export type UserResponseDTO = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  createdAt: Date;
  updatedAt: Date;
};

export type AuthenticateUserResponseDTO = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};
