package com.briannaeggs.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "audit_event")
public class AuditEventEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @Column(name = "actor_username", nullable = false) private String actorUsername;
  @Column(nullable = false) private String action;
  @Column(name = "entity_type", nullable = false) private String entityType;
  @Column(name = "entity_id") private String entityId;
  @Column(columnDefinition = "TEXT") private String detail;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
  protected AuditEventEntity() {}
  public AuditEventEntity(String actorUsername, String action, String entityType, String entityId, String detail) { this.actorUsername=actorUsername; this.action=action; this.entityType=entityType; this.entityId=entityId; this.detail=detail; }
}
