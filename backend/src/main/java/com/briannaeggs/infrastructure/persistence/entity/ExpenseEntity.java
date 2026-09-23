package com.briannaeggs.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expense")
public class ExpenseEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @Column(name = "expense_date", nullable = false) private LocalDate date;
  @Column(nullable = false) private String category;
  @Column(name = "amount_cop", nullable = false, precision = 14, scale = 2) private BigDecimal amountCop;
  @Column(nullable = false, length = 500) private String description;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by", nullable = false) private UserEntity createdBy;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
  public ExpenseEntity() {}
  public Long getId(){return id;} public LocalDate getDate(){return date;} public String getCategory(){return category;} public BigDecimal getAmountCop(){return amountCop;} public String getDescription(){return description;}
  public void apply(LocalDate date,String category,BigDecimal amountCop,String description,UserEntity createdBy){this.date=date;this.category=category;this.amountCop=amountCop;this.description=description;if(this.createdBy==null)this.createdBy=createdBy;}
}
