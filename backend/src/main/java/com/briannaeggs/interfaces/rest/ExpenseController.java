package com.briannaeggs.interfaces.rest;
import com.briannaeggs.application.service.AuditService;
import com.briannaeggs.application.service.ExpenseService;
import com.briannaeggs.infrastructure.persistence.entity.ExpenseEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/expenses") @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
public class ExpenseController {private final ExpenseService expenses;private final AuditService audit;public ExpenseController(ExpenseService expenses,AuditService audit){this.expenses=expenses;this.audit=audit;}@GetMapping public List<ExpenseResponse> list(){return expenses.list().stream().map(ExpenseResponse::from).toList();}@PostMapping @ResponseStatus(HttpStatus.CREATED) public ExpenseResponse create(@RequestBody ExpenseRequest request,Authentication auth){ExpenseEntity expense=expenses.create(request.toCommand(),auth.getName());audit.record(auth.getName(),"CREATE","EXPENSE",expense.getId(),expense.getCategory());return ExpenseResponse.from(expense);}
  public record ExpenseRequest(LocalDate date,String category,BigDecimal amountCop,String description){ExpenseService.ExpenseCommand toCommand(){return new ExpenseService.ExpenseCommand(date,category,amountCop,description);}}
  public record ExpenseResponse(long id,LocalDate date,String category,BigDecimal amountCop,String description){static ExpenseResponse from(ExpenseEntity expense){return new ExpenseResponse(expense.getId(),expense.getDate(),expense.getCategory(),expense.getAmountCop(),expense.getDescription());}}
}
