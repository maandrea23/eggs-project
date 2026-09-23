package com.briannaeggs.infrastructure.persistence.entity;

import com.briannaeggs.domain.model.EggSaleType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "egg_sale")
public class EggSaleEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @Column(name = "sale_date", nullable = false) private LocalDate date;
  @Column(nullable = false) private int cartons;
  @Enumerated(EnumType.STRING) @Column(name = "carton_type", nullable = false) private EggSaleType cartonType;
  @Column(name = "price_per_carton_cop", nullable = false, precision = 14, scale = 2) private BigDecimal pricePerCartonCop;
  @Column(name = "customer_name", nullable = false) private String customerName;
  @Column(name = "customer_phone") private String customerPhone;
  @Column(name = "purchase_location", nullable = false) private String purchaseLocation;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by", nullable = false) private UserEntity createdBy;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
  public EggSaleEntity() {}
  public Long getId() { return id; } public LocalDate getDate() { return date; } public int getCartons() { return cartons; } public EggSaleType getCartonType() { return cartonType; }
  public BigDecimal getPricePerCartonCop() { return pricePerCartonCop; } public String getCustomerName() { return customerName; } public String getCustomerPhone() { return customerPhone; } public String getPurchaseLocation() { return purchaseLocation; }
  public void apply(LocalDate date, int cartons, EggSaleType cartonType, BigDecimal price, String customerName, String customerPhone, String location, UserEntity createdBy) { this.date=date; this.cartons=cartons; this.cartonType=cartonType; this.pricePerCartonCop=price; this.customerName=customerName; this.customerPhone=customerPhone; this.purchaseLocation=location; if(this.createdBy==null) this.createdBy=createdBy; }
}
