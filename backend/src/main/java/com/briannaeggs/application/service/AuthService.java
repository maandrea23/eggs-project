package com.briannaeggs.application.service;

import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import com.briannaeggs.infrastructure.persistence.repository.UserJpaRepository;
import com.briannaeggs.infrastructure.security.JwtTokenService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final UserJpaRepository users; private final PasswordEncoder encoder; private final JwtTokenService tokens;
  public AuthService(UserJpaRepository users, PasswordEncoder encoder, JwtTokenService tokens) { this.users=users; this.encoder=encoder; this.tokens=tokens; }
  public LoginResult login(String username, String password) {
    UserEntity user = users.findByUsernameIgnoreCase(username.trim()).orElseThrow(() -> new AccessDeniedException("Credenciales inválidas."));
    if (!user.isActive() || !encoder.matches(password, user.getPasswordHash())) throw new AccessDeniedException("Credenciales inválidas.");
    return new LoginResult(tokens.create(user.getUsername(), user.getRole()), user.getUsername(), user.getRole().name());
  }
  public record LoginResult(String accessToken, String username, String role) {}
}
