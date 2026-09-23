package com.briannaeggs.application.service;

import com.briannaeggs.domain.model.EggSaleType;
import com.briannaeggs.infrastructure.persistence.repository.EggLogJpaRepository;
import com.briannaeggs.infrastructure.persistence.repository.EggSaleJpaRepository;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class InventoryService {
  private final EggLogJpaRepository logs; private final EggSaleJpaRepository sales;
  public InventoryService(EggLogJpaRepository logs, EggSaleJpaRepository sales) { this.logs=logs; this.sales=sales; }
  public Map<EggSaleType, Integer> stock() {
    Map<EggSaleType, Integer> stock = new EnumMap<>(EggSaleType.class); for (EggSaleType type : EggSaleType.values()) stock.put(type, 0);
    logs.findAll().forEach(log -> {
      stock.compute(EggSaleType.C, (key,value)->value+log.getTypeC()); stock.compute(EggSaleType.B, (key,value)->value+log.getTypeB()); stock.compute(EggSaleType.A, (key,value)->value+log.getTypeA()); stock.compute(EggSaleType.AA, (key,value)->value+log.getTypeAa()); stock.compute(EggSaleType.AAA, (key,value)->value+log.getTypeAaa()); stock.compute(EggSaleType.JUMBO, (key,value)->value+log.getTypeJumbo());
      int classified=log.getTypeC()+log.getTypeB()+log.getTypeA()+log.getTypeAa()+log.getTypeAaa()+log.getTypeJumbo(); stock.compute(EggSaleType.UNCLASSIFIED, (key,value)->value+Math.max(log.getTotalEggs()-log.getCrackedEggs()-classified,0));
    });
    sales.findAll().forEach(sale -> stock.compute(sale.getCartonType(), (key,value)->Math.max(value-(sale.getCartons()*30),0)));
    return stock;
  }
}
