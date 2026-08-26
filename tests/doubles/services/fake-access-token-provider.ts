import type {
  AccessTokenClaims,
  AccessTokenProvider,
} from '@/application/services/access-token-provider';

type IssuedAccessToken = {
  token: string;
  claims: AccessTokenClaims;
};

class FakeAccessTokenProvider implements AccessTokenProvider {
  public readonly issuedTokens: IssuedAccessToken[] = [];
  private nextTokenNumber = 1;

  async issue(claims: AccessTokenClaims): Promise<string> {
    const token = `access-token-${this.nextTokenNumber++}`;

    this.issuedTokens.push({
      token,
      claims: { ...claims },
    });

    return token;
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const issuedToken = this.issuedTokens.find((item) => item.token === token);

    if (!issuedToken) {
      throw new Error('Invalid access token.');
    }

    return { ...issuedToken.claims };
  }
}

export { FakeAccessTokenProvider };
export type { IssuedAccessToken };
