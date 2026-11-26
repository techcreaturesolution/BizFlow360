// Access token (chhota, 15m) + Refresh token (lamba, 7d).
// tenantId token ke andar hota hai, frontend se kabhi nahi liya jaata.
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import { env } from "../config/env";
import { Errors } from "./errors";

const ISSUER = "bizflow360";

export interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string | null;
  roles: string[];
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tenantId: string | null;
  jti: string; // token ki unique id (DB mein session se match hoti hai)
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    issuer: ISSUER,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    if (
      typeof decoded === "string" ||
      !decoded.sub ||
      (decoded as JwtPayload).tenantId === undefined
    ) {
      throw new Error("bad payload");
    }
    return decoded as unknown as AccessTokenPayload;
  } catch {
    throw Errors.unauthorized("Invalid or expired token");
  }
}

export function signRefreshToken(userId: string, tenantId: string | null) {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, tenantId, jti }, env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    issuer: ISSUER,
    expiresIn: env.REFRESH_TOKEN_TTL as SignOptions["expiresIn"],
  });
  const { exp } = jwt.decode(token) as JwtPayload;
  return { token, jti, expiresAt: new Date((exp as number) * 1000) };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    if (typeof decoded === "string" || !decoded.sub || !(decoded as JwtPayload).jti) {
      throw new Error("bad payload");
    }
    return decoded as unknown as RefreshTokenPayload;
  } catch {
    throw Errors.unauthorized("Invalid or expired refresh token");
  }
}

// Refresh token DB mein seedha nahi, uska hash save hota hai
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}