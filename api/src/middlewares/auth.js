// auth.js
import 'dotenv/config';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

const KEYCLOAK_INTERNAL_URL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';
const KEYCLOAK_PUBLIC_URL = process.env.KEYCLOAK_PUBLIC_URL || 'http://localhost:8080';


export const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${KEYCLOAK_INTERNAL_URL}/realms/restaurant/protocol/openid-connect/certs`
  }),
  issuer: `${KEYCLOAK_PUBLIC_URL}/realms/restaurant`, 
  audience: false,
  algorithms: ['RS256']
});

// Versión opcional: no bloquea si no hay token (para /auth/register)
export const optionalJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${KEYCLOAK_INTERNAL_URL}/realms/restaurant/protocol/openid-connect/certs`
  }),
  issuer: `${KEYCLOAK_PUBLIC_URL}/realms/restaurant`,
  audience: false,
  algorithms: ['RS256'],
  credentialsRequired: false // clave: no falla si no hay token
});