package com.briannaeggs.application.service;

import com.briannaeggs.infrastructure.persistence.entity.AuditEventEntity;
import com.briannaeggs.infrastructure.persistence.repository.AuditEventJpaRepository;
import org.springframework.stereotype.Service;
@Service
public class AuditService {
  private final AuditEventJpaRepository events;
  public AuditService(AuditEventJpaRepository events) { this.events=events; }
  public void record(String actor, String action, String entity, Object id, String detail) { events.save(new AuditEventEntity(actor, action, entity, id == null ? null : id.toString(), detail)); }
}
