package com.briannaeggs.infrastructure.persistence.repository;

import com.briannaeggs.infrastructure.persistence.entity.ExpenseEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ExpenseJpaRepository extends JpaRepository<ExpenseEntity, Long> { List<ExpenseEntity> findAllByOrderByDateDesc(); }
