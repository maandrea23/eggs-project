package com.briannaeggs.interfaces.rest;
import com.briannaeggs.application.service.AuditService;
import com.briannaeggs.application.service.SaleService;
import com.briannaeggs.domain.model.EggSaleType;
import com.briannaeggs.infrastructure.persistence.entity.EggSaleEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/sales") @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
public class SaleController { private final SaleService sales;private final AuditService audit;public SaleController(SaleService sales,AuditService audit){this.sales=sales;this.audit=audit;}@GetMapping public List<SaleResponse> list(){return sales.list().stream().map(SaleResponse::from).toList();}@PostMapping @ResponseStatus(HttpStatus.CREATED) public SaleResponse create(@RequestBody SaleRequest request,Authentication auth){EggSaleEntity sale=sales.create(request.toCommand(),auth.getName());audit.record(auth.getName(),"CREATE","SALE",sale.getId(),"Venta de huevos");return SaleResponse.from(sale);}@DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('OWNER')") public void delete(@PathVariable long id,Authentication auth){sales.delete(id);audit.record(auth.getName(),"DELETE","SALE",id,"Venta eliminada");}
  public record SaleRequest(LocalDate date,int cartons,EggSaleType cartonType,BigDecimal pricePerCartonCop,String customerName,String customerPhone,String purchaseLocation){SaleService.SaleCommand toCommand(){return new SaleService.SaleCommand(date,cartons,cartonType,pricePerCartonCop,customerName,customerPhone,purchaseLocation);}}
  public record SaleResponse(long id,LocalDate date,int cartons,EggSaleType cartonType,BigDecimal pricePerCartonCop,String customerName,String customerPhone,String purchaseLocation){static SaleResponse from(EggSaleEntity sale){return new SaleResponse(sale.getId(),sale.getDate(),sale.getCartons(),sale.getCartonType(),sale.getPricePerCartonCop(),sale.getCustomerName(),sale.getCustomerPhone(),sale.getPurchaseLocation());}}
}
