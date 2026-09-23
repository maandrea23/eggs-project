package com.briannaeggs.infrastructure.persistence.repository;

import com.briannaeggs.infrastructure.persistence.entity.EggLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EggLogJpaRepository extends JpaRepository<EggLogEntity, Long> {
  List<EggLogEntity> findAllByOrderByDateDesc();
  Optional<EggLogEntity> findByDate(LocalDate date);
}
