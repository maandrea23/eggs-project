package com.briannaeggs.interfaces.rest;

import com.briannaeggs.application.service.AuditService;
import com.briannaeggs.application.service.UserService;
import com.briannaeggs.domain.model.UserRole;
import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/users") @PreAuthorize("hasRole('OWNER')")
public class UserController {private final UserService users;private final AuditService audit;public UserController(UserService users,AuditService audit){this.users=users;this.audit=audit;}@GetMapping public List<UserResponse> list(){return users.list().stream().map(UserResponse::from).toList();}@PostMapping @ResponseStatus(HttpStatus.CREATED) public UserResponse create(@RequestBody CreateUserRequest request,Authentication auth){UserEntity user=users.create(request.username(),request.password(),request.role());audit.record(auth.getName(),"CREATE","USER",user.getId(),user.getRole().name());return UserResponse.from(user);}@PatchMapping("/{id}/active") public void setActive(@PathVariable long id,@RequestBody ActiveRequest request,Authentication auth){users.setActive(id,request.active());audit.record(auth.getName(),"UPDATE","USER",id,request.active()?"Activado":"Desactivado");}
 public record CreateUserRequest(String username,String password,UserRole role){} public record ActiveRequest(boolean active){} public record UserResponse(long id,String username,UserRole role,boolean active){static UserResponse from(UserEntity user){return new UserResponse(user.getId(),user.getUsername(),user.getRole(),user.isActive());}}
}
