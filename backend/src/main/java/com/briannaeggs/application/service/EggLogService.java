package com.briannaeggs.application.service;

import com.briannaeggs.infrastructure.persistence.entity.EggLogEntity;
import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import com.briannaeggs.infrastructure.persistence.repository.EggLogJpaRepository;
import com.briannaeggs.infrastructure.persistence.repository.UserJpaRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class EggLogService {
  private final EggLogJpaRepository logs; private final UserJpaRepository users;
  public EggLogService(EggLogJpaRepository logs, UserJpaRepository users) { this.logs=logs; this.users=users; }
  public List<EggLogEntity> list() { return logs.findAllByOrderByDateDesc(); }
  public EggLogEntity create(EggLogCommand command, String username, boolean operator) {
    if (operator && !command.date().equals(LocalDate.now())) throw new AccessDeniedException("El operador solo puede registrar la recolección del día actual.");
    if (logs.findByDate(command.date()).isPresent()) throw new IllegalArgumentException("Ya existe una recolección para esa fecha.");
    EggLogEntity entity = new EggLogEntity(); apply(entity, command, findUser(username)); return logs.save(entity);
  }
  public EggLogEntity update(long id, EggLogCommand command, String username) { EggLogEntity entity=logs.findById(id).orElseThrow(() -> new IllegalArgumentException("Recolección no encontrada.")); apply(entity, command, findUser(username)); return entity; }
  public void delete(long id) { logs.deleteById(id); }
  private UserEntity findUser(String username) { return users.findByUsernameIgnoreCase(username).orElseThrow(); }
  private void apply(EggLogEntity entity, EggLogCommand command, UserEntity actor) {
    if (command.totalEggs() < 0 || command.crackedEggs() < 0 || command.feedConsumedKg().signum() <= 0) throw new IllegalArgumentException("El total, quebrados y alimento deben ser valores válidos.");
    int classified = command.typeC()+command.typeB()+command.typeA()+command.typeAa()+command.typeAaa()+command.typeJumbo();
    if (command.crackedEggs() > command.totalEggs() || classified > command.totalEggs()-command.crackedEggs()) throw new IllegalArgumentException("La clasificación no puede superar los huevos buenos disponibles.");
    entity.apply(command.date(), command.totalEggs(), command.crackedEggs(), command.feedConsumedKg(), command.vitaminInWater(), command.vitaminInFeed(), command.notes(), command.typeC(), command.typeB(), command.typeA(), command.typeAa(), command.typeAaa(), command.typeJumbo(), actor);
  }
  public record EggLogCommand(LocalDate date, int totalEggs, int crackedEggs, BigDecimal feedConsumedKg, String vitaminInWater, String vitaminInFeed, String notes, int typeC, int typeB, int typeA, int typeAa, int typeAaa, int typeJumbo) {}
}
