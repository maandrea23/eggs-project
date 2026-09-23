package com.briannaeggs.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "egg_log")
public class EggLogEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @Column(name = "log_date", nullable = false, unique = true) private LocalDate date;
  @Column(name = "total_eggs", nullable = false) private int totalEggs;
  @Column(name = "cracked_eggs", nullable = false) private int crackedEggs;
  @Column(name = "feed_consumed_kg", nullable = false, precision = 10, scale = 2) private BigDecimal feedConsumedKg;
  @Column(name = "vitamin_in_water") private String vitaminInWater;
  @Column(name = "vitamin_in_feed") private String vitaminInFeed;
  @Column(columnDefinition = "TEXT") private String notes;
  @Column(name = "type_c", nullable = false) private int typeC;
  @Column(name = "type_b", nullable = false) private int typeB;
  @Column(name = "type_a", nullable = false) private int typeA;
  @Column(name = "type_aa", nullable = false) private int typeAa;
  @Column(name = "type_aaa", nullable = false) private int typeAaa;
  @Column(name = "type_jumbo", nullable = false) private int typeJumbo;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by", nullable = false) private UserEntity createdBy;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
  @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

  public EggLogEntity() {}
  public Long getId() { return id; }
  public LocalDate getDate() { return date; }
  public int getTotalEggs() { return totalEggs; }
  public int getCrackedEggs() { return crackedEggs; }
  public BigDecimal getFeedConsumedKg() { return feedConsumedKg; }
  public String getVitaminInWater() { return vitaminInWater; }
  public String getVitaminInFeed() { return vitaminInFeed; }
  public String getNotes() { return notes; }
  public int getTypeC() { return typeC; }
  public int getTypeB() { return typeB; }
  public int getTypeA() { return typeA; }
  public int getTypeAa() { return typeAa; }
  public int getTypeAaa() { return typeAaa; }
  public int getTypeJumbo() { return typeJumbo; }
  public UserEntity getCreatedBy() { return createdBy; }
  public void apply(LocalDate date, int totalEggs, int crackedEggs, BigDecimal feedConsumedKg, String vitaminInWater, String vitaminInFeed, String notes, int typeC, int typeB, int typeA, int typeAa, int typeAaa, int typeJumbo, UserEntity createdBy) {
    this.date = date; this.totalEggs = totalEggs; this.crackedEggs = crackedEggs; this.feedConsumedKg = feedConsumedKg;
    this.vitaminInWater = vitaminInWater; this.vitaminInFeed = vitaminInFeed; this.notes = notes;
    this.typeC = typeC; this.typeB = typeB; this.typeA = typeA; this.typeAa = typeAa; this.typeAaa = typeAaa; this.typeJumbo = typeJumbo;
    if (this.createdBy == null) this.createdBy = createdBy;
    this.updatedAt = Instant.now();
  }
}
