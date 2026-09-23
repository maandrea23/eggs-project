package com.briannaeggs.infrastructure.persistence.repository;

import com.briannaeggs.infrastructure.persistence.entity.EggSaleEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EggSaleJpaRepository extends JpaRepository<EggSaleEntity, Long> { List<EggSaleEntity> findAllByOrderByDateDesc(); }
