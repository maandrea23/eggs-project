package com.briannaeggs.infrastructure.persistence.repository;

import com.briannaeggs.infrastructure.persistence.entity.AuditEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AuditEventJpaRepository extends JpaRepository<AuditEventEntity, Long> {}
