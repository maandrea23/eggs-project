package com.briannaeggs.interfaces.rest;

import com.briannaeggs.application.service.AuditService;
import com.briannaeggs.application.service.EggLogService;
import com.briannaeggs.infrastructure.persistence.entity.EggLogEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/egg-logs")
public class EggLogController {
  private final EggLogService logs; private final AuditService audit;
  public EggLogController(EggLogService logs,AuditService audit){this.logs=logs;this.audit=audit;}
  @GetMapping public List<EggLogResponse> list(){return logs.list().stream().map(EggLogResponse::from).toList();}
  @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('OPERATOR','ADMIN','OWNER')")
  public EggLogResponse create(@RequestBody EggLogRequest request, Authentication authentication){boolean operator=authentication.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_OPERATOR")); EggLogEntity log=logs.create(request.toCommand(),authentication.getName(),operator);audit.record(authentication.getName(),"CREATE","EGG_LOG",log.getId(),"Registro diario");return EggLogResponse.from(log);}
  @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
  public EggLogResponse update(@PathVariable long id,@RequestBody EggLogRequest request,Authentication authentication){EggLogEntity log=logs.update(id,request.toCommand(),authentication.getName());audit.record(authentication.getName(),"UPDATE","EGG_LOG",id,"Recolección corregida");return EggLogResponse.from(log);}
  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('OWNER')")
  public void delete(@PathVariable long id,Authentication authentication){logs.delete(id);audit.record(authentication.getName(),"DELETE","EGG_LOG",id,"Recolección eliminada");}

  public record EggLogRequest(LocalDate date,int totalEggs,int crackedEggs,BigDecimal feedConsumedKg,String vitaminInWater,String vitaminInFeed,String notes,int typeC,int typeB,int typeA,int typeAa,int typeAaa,int typeJumbo){ EggLogService.EggLogCommand toCommand(){return new EggLogService.EggLogCommand(date,totalEggs,crackedEggs,feedConsumedKg,vitaminInWater,vitaminInFeed,notes,typeC,typeB,typeA,typeAa,typeAaa,typeJumbo);} }
  public record EggLogResponse(long id,LocalDate date,int totalEggs,int crackedEggs,BigDecimal feedConsumedKg,String vitaminInWater,String vitaminInFeed,String notes,int typeC,int typeB,int typeA,int typeAa,int typeAaa,int typeJumbo,String createdBy){ static EggLogResponse from(EggLogEntity log){return new EggLogResponse(log.getId(),log.getDate(),log.getTotalEggs(),log.getCrackedEggs(),log.getFeedConsumedKg(),log.getVitaminInWater(),log.getVitaminInFeed(),log.getNotes(),log.getTypeC(),log.getTypeB(),log.getTypeA(),log.getTypeAa(),log.getTypeAaa(),log.getTypeJumbo(),log.getCreatedBy().getUsername());} }
}
