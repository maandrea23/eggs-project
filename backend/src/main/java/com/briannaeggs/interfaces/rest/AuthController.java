package com.briannaeggs.interfaces.rest;

import com.briannaeggs.application.service.AuthService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  public AuthController(AuthService auth) { this.auth=auth; }
  @PostMapping("/login") public ResponseEntity<AuthService.LoginResult> login(@RequestBody LoginRequest request) { return ResponseEntity.ok(auth.login(request.username(), request.password())); }
  public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
}
