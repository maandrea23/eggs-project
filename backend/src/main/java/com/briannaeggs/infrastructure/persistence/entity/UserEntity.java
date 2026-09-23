package com.briannaeggs.infrastructure.persistence.entity;

import com.briannaeggs.domain.model.UserRole;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class UserEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @Column(nullable = false, unique = true, length = 80) private String username;
  @Column(name = "password_hash", nullable = false, length = 100) private String passwordHash;
  @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private UserRole role;
  @Column(nullable = false) private boolean active = true;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

  protected UserEntity() {}
  public UserEntity(String username, String passwordHash, UserRole role) { this.username = username; this.passwordHash = passwordHash; this.role = role; }
  public Long getId() { return id; }
  public String getUsername() { return username; }
  public String getPasswordHash() { return passwordHash; }
  public UserRole getRole() { return role; }
  public boolean isActive() { return active; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
  public void setRole(UserRole role) { this.role = role; }
  public void setActive(boolean active) { this.active = active; }
}
