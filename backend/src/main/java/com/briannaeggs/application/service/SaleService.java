package com.briannaeggs.application.service;

import com.briannaeggs.domain.model.EggSaleType;
import com.briannaeggs.infrastructure.persistence.entity.EggSaleEntity;
import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import com.briannaeggs.infrastructure.persistence.repository.EggSaleJpaRepository;
import com.briannaeggs.infrastructure.persistence.repository.UserJpaRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class SaleService {
  private final EggSaleJpaRepository sales; private final UserJpaRepository users; private final InventoryService inventory;
  public SaleService(EggSaleJpaRepository sales, UserJpaRepository users, InventoryService inventory) { this.sales=sales; this.users=users; this.inventory=inventory; }
  public List<EggSaleEntity> list(){return sales.findAllByOrderByDateDesc();}
  public EggSaleEntity create(SaleCommand command, String username) {
    if(command.cartons() <= 0 || command.pricePerCartonCop().signum() <= 0 || command.customerName().isBlank() || command.purchaseLocation().isBlank()) throw new IllegalArgumentException("Completa los datos obligatorios de la venta.");
    int requested=command.cartons()*30; int available=inventory.stock().get(command.cartonType()); if(requested>available) throw new IllegalArgumentException("No hay inventario suficiente para esta venta.");
    UserEntity user=users.findByUsernameIgnoreCase(username).orElseThrow(); EggSaleEntity sale=new EggSaleEntity(); sale.apply(command.date(),command.cartons(),command.cartonType(),command.pricePerCartonCop(),command.customerName(),command.customerPhone(),command.purchaseLocation(),user); return sales.save(sale);
  }
  public void delete(long id){sales.deleteById(id);}
  public record SaleCommand(LocalDate date,int cartons,EggSaleType cartonType,BigDecimal pricePerCartonCop,String customerName,String customerPhone,String purchaseLocation){}
}
