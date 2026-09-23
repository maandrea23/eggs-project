package com.briannaeggs.application.service;

import com.briannaeggs.domain.model.UserRole;
import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import com.briannaeggs.infrastructure.persistence.repository.UserJpaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class OwnerAccountBootstrap implements CommandLineRunner {
  private final UserJpaRepository users; private final PasswordEncoder encoder; private final String username; private final String password;
  public OwnerAccountBootstrap(UserJpaRepository users, PasswordEncoder encoder, @Value("${app.bootstrap.owner-username}") String username, @Value("${app.bootstrap.owner-password}") String password) { this.users=users; this.encoder=encoder; this.username=username; this.password=password; }
  @Override public void run(String... args) { if (users.findByUsernameIgnoreCase(username).isEmpty()) users.save(new UserEntity(username, encoder.encode(password), UserRole.OWNER)); }
}
