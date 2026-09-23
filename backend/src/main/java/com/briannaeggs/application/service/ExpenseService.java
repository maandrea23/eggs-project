package com.briannaeggs.application.service;

import com.briannaeggs.infrastructure.persistence.entity.ExpenseEntity;
import com.briannaeggs.infrastructure.persistence.entity.UserEntity;
import com.briannaeggs.infrastructure.persistence.repository.ExpenseJpaRepository;
import com.briannaeggs.infrastructure.persistence.repository.UserJpaRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @Transactional
public class ExpenseService {
  private final ExpenseJpaRepository expenses; private final UserJpaRepository users;
  public ExpenseService(ExpenseJpaRepository expenses,UserJpaRepository users){this.expenses=expenses;this.users=users;}
  public List<ExpenseEntity> list(){return expenses.findAllByOrderByDateDesc();}
  public ExpenseEntity create(ExpenseCommand command,String username){if(command.amountCop().signum()<=0||command.description().isBlank())throw new IllegalArgumentException("El monto y la descripción son obligatorios."); UserEntity user=users.findByUsernameIgnoreCase(username).orElseThrow(); ExpenseEntity expense=new ExpenseEntity();expense.apply(command.date(),command.category(),command.amountCop(),command.description(),user);return expenses.save(expense);}
  public record ExpenseCommand(LocalDate date,String category,BigDecimal amountCop,String description){}
}
