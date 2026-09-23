package com.briannaeggs.application.service;

import com.briannaeggs.domain.model.UserRole;
import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import com.briannaeggs.infrastructure.persistence.repository.UserJpaRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
@Service @Transactional
public class UserService {
  private final UserJpaRepository users;private final PasswordEncoder encoder;
  public UserService(UserJpaRepository users,PasswordEncoder encoder){this.users=users;this.encoder=encoder;}
  public List<UserEntity> list(){return users.findAll();}
  public UserEntity create(String username,String password,UserRole role){if(users.findByUsernameIgnoreCase(username.trim()).isPresent())throw new IllegalArgumentException("Ese usuario ya existe.");if(password.length()<10)throw new IllegalArgumentException("La contraseña debe tener al menos 10 caracteres.");return users.save(new UserEntity(username.trim(),encoder.encode(password),role));}
  public void setActive(long id,boolean active){UserEntity user=users.findById(id).orElseThrow(()->new IllegalArgumentException("Usuario no encontrado."));user.setActive(active);}
}
