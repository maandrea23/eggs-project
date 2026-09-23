package com.briannaeggs.infrastructure.security;

import com.briannaeggs.domain.model.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
  private final SecretKey key;
  private final long minutes;

  public JwtTokenService(@Value("${app.security.jwt-secret}") String secret, @Value("${app.security.access-token-minutes}") long minutes) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.minutes = minutes;
  }

  public String create(String username, UserRole role) {
    Instant now = Instant.now();
    return Jwts.builder().subject(username).claim("role", role.name()).issuedAt(Date.from(now)).expiration(Date.from(now.plus(minutes, ChronoUnit.MINUTES))).signWith(key).compact();
  }

  public Claims parse(String token) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload(); }
}
