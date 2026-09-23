package com.briannaeggs.application.security;

import com.briannaeggs.domain.model.UserRole;
import java.util.Set;

public record CurrentActor(String username, Set<UserRole> roles) {
  public boolean has(UserRole role) { return roles.contains(role); }
}
